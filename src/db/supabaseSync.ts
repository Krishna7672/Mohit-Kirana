import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { db, SAMPLE_PRODUCTS, SAMPLE_CUSTOMERS, exportDatabaseBackup } from './index';
import type {
  Product,
  Customer,
  Invoice,
  UdharEntry,
  StockMovement,
  Supplier,
  Purchase,
  StoreSettings
} from '../types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  email: string;
  autoSync: boolean;
}

import {
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_SUPABASE_EMAIL
} from './constants';

export { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_EMAIL };

export function getSupabaseConfig(): SupabaseConfig {
  const storedUrl = localStorage.getItem('kirana_supabase_url');
  const storedAnonKey = localStorage.getItem('kirana_supabase_anon_key');
  const storedEmail = localStorage.getItem('kirana_supabase_email');

  const url = storedUrl && storedUrl.trim() ? storedUrl.trim() : DEFAULT_SUPABASE_URL;
  const anonKey = storedAnonKey && storedAnonKey.trim() ? storedAnonKey.trim() : DEFAULT_SUPABASE_ANON_KEY;
  const email = storedEmail && storedEmail.trim() ? storedEmail.trim() : DEFAULT_SUPABASE_EMAIL;

  const autoSyncStr = localStorage.getItem('kirana_supabase_auto_sync');
  const autoSync = autoSyncStr === null ? Boolean(url && anonKey) : autoSyncStr === 'true';

  return { url, anonKey, email, autoSync };
}

export function saveSupabaseConfig(config: Partial<SupabaseConfig>) {
  if (config.url !== undefined) {
    const val = config.url.trim() || DEFAULT_SUPABASE_URL;
    localStorage.setItem('kirana_supabase_url', val);
  }
  if (config.anonKey !== undefined) {
    const val = config.anonKey.trim() || DEFAULT_SUPABASE_ANON_KEY;
    localStorage.setItem('kirana_supabase_anon_key', val);
  }
  if (config.email !== undefined) {
    const val = config.email.trim() || DEFAULT_SUPABASE_EMAIL;
    localStorage.setItem('kirana_supabase_email', val);
  }
  if (config.autoSync !== undefined) {
    localStorage.setItem('kirana_supabase_auto_sync', String(config.autoSync));
  }
}

let cachedClient: { client: SupabaseClient; url: string; key: string } | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;

  if (cachedClient && cachedClient.url === url && cachedClient.key === anonKey) {
    return cachedClient.client;
  }

  try {
    const client = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: { 'x-application-name': 'mohit-kirana' },
      },
    });
    cachedClient = { client, url, key: anonKey };
    return client;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!isOnline()) {
    return { success: false, message: 'Device is offline. Please connect to internet to test Supabase.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase URL or Anon Key is missing. Please configure them in Settings.',
    };
  }

  try {
    const { error } = await client.from('store_settings').select('id').limit(1);
    if (error) {
      if (error.code === '42P01') {
        return {
          success: false,
          message:
            'Connected to Supabase, but tables are not yet created! Run supabase_schema.sql in your Supabase SQL Editor.',
        };
      }
      return { success: false, message: `Supabase error: ${error.message}` };
    }

    return {
      success: true,
      message: 'Connected to Supabase Cloud successfully! Multi-device sync active.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Connection failed';
    return { success: false, message: `Failed to connect: ${msg}` };
  }
}

// Helper: Filter out demo records so local demo data never pollutes cloud
const demoBarcodesSet = new Set(SAMPLE_PRODUCTS.map((p) => p.barcode));
const demoPhonesSet = new Set(SAMPLE_CUSTOMERS.map((c) => c.phone.trim()));

function isDemoProduct(p: Product): boolean {
  return Boolean(p.barcode && demoBarcodesSet.has(p.barcode));
}

function isDemoCustomer(c: Customer): boolean {
  return Boolean(c.phone && demoPhonesSet.has(c.phone.trim()));
}

// Concurrency lock for sync
let isSyncInProgress = false;

/**
 * Smart Bidirectional Sync
 * - Compares cloud and local timestamps
 * - Pulls newest stock & udhaar updates from other devices into local Dexie
 * - Pushes newest local sales, stock & udhaar adjustments up to Supabase
 * - Safely handles Dexie unique constraints (&phone, &invoiceNumber)
 * - NEVER deletes or harms existing data!
 */
export async function syncBidirectional(): Promise<{
  success: boolean;
  message: string;
  syncedCounts?: {
    products: number;
    customers: number;
    invoices: number;
  };
}> {
  if (!isOnline()) {
    return {
      success: false,
      message: 'Device is offline. Changes saved locally and will sync when internet connects.',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase not configured. Add Project URL & Anon Key in Settings.',
    };
  }

  if (isSyncInProgress) {
    return { success: true, message: 'Sync already in progress...' };
  }

  isSyncInProgress = true;

  try {
    // 0. Safety snapshot before modifying local DB
    try {
      const backupJson = await exportDatabaseBackup();
      localStorage.setItem('mohit_kirana_offline_snapshot', backupJson);
    } catch (e) {
      console.warn('Pre-sync snapshot warning:', e);
    }

    // 1. Fetch Cloud tables in parallel (up to 50,000 rows each to prevent truncation)
    const [
      { data: cloudProducts, error: prodErr },
      { data: cloudCustomers, error: custErr },
      { data: cloudInvoices, error: invErr },
      { data: cloudUdhar, error: udharErr },
      { data: cloudMovements, error: movErr },
      { data: cloudSuppliers, error: suppErr },
      { data: cloudPurchases, error: purErr },
      { data: cloudSettings, error: setErr },
    ] = await Promise.all([
      client.from('products').select('*').limit(50000),
      client.from('customers').select('*').limit(50000),
      client.from('invoices').select('*').limit(50000),
      client.from('udhar_ledger').select('*').limit(50000),
      client.from('stock_movements').select('*').limit(50000),
      client.from('suppliers').select('*').limit(50000),
      client.from('purchases').select('*').limit(50000),
      client.from('store_settings').select('*').limit(10),
    ]);

    if (prodErr || custErr || invErr) {
      const err = prodErr || custErr || invErr;
      throw new Error(`Cloud query error: ${err?.message}`);
    }

    // 2. Fetch all local tables from Dexie
    const [
      localProducts,
      localCustomers,
      localInvoices,
      localUdhar,
      localMovements,
      localSuppliers,
      localPurchases,
      localSettings,
    ] = await Promise.all([
      db.products.toArray(),
      db.customers.toArray(),
      db.invoices.toArray(),
      db.udharLedger.toArray(),
      db.stockMovements.toArray(),
      db.suppliers.toArray(),
      db.purchases.toArray(),
      db.storeSettings.toArray(),
    ]);

    // =========================================================================
    // A. SYNC CUSTOMERS & UDHAAR BALANCE
    // =========================================================================
    const localCustMapById = new Map<number, Customer>();
    const localCustMapByPhone = new Map<string, Customer>();
    for (const c of localCustomers) {
      if (c.id) localCustMapById.set(c.id, c);
      if (c.phone) localCustMapByPhone.set(c.phone.trim(), c);
    }

    const localCustToPut: Customer[] = [];
    const localCustToDeleteOldIds: number[] = [];
    const cloudCustToUpsert: any[] = [];
    const processedCustLocalIds = new Set<number>();

    if (cloudCustomers) {
      for (const cRow of cloudCustomers) {
        const cloudId = Number(cRow.id);
        const cloudPhone = (cRow.phone || cRow.data?.phone || '').trim();
        const cloudUdhar = cRow.outstanding_udhar !== null && cRow.outstanding_udhar !== undefined
          ? Number(cRow.outstanding_udhar)
          : Number(cRow.data?.outstandingUdhar ?? 0);
        const cloudUpdatedTime = new Date(cRow.updated_at || cRow.data?.updatedAt || 0).getTime();

        // Match local by ID first, then by Phone (Dexie unique constraint &phone)
        const localMatch = localCustMapById.get(cloudId) || (cloudPhone ? localCustMapByPhone.get(cloudPhone) : undefined);

        if (localMatch) {
          if (localMatch.id) processedCustLocalIds.add(localMatch.id);
          const localUpdatedTime = new Date(localMatch.updatedAt || localMatch.registrationDate || 0).getTime();

          const hasIdMismatch = localMatch.id !== cloudId;

          if (cloudUpdatedTime >= localUpdatedTime || hasIdMismatch) {
            // Cloud has newer udhaar/data OR we must align local ID to cloud ID to prevent phone collision
            if (hasIdMismatch && localMatch.id) {
              localCustToDeleteOldIds.push(localMatch.id);
            }

            const mergedCustomer: Customer = {
              ...localMatch,
              ...(cRow.data || {}),
              id: cloudId,
              name: cRow.name || cRow.data?.name || localMatch.name,
              phone: cloudPhone || localMatch.phone,
              outstandingUdhar: cloudUdhar,
              purchaseCount: Math.max(localMatch.purchaseCount || 0, Number(cRow.data?.purchaseCount ?? 0)),
              totalSpending: Math.max(localMatch.totalSpending || 0, Number(cRow.data?.totalSpending ?? 0)),
              lastPurchaseDate: cRow.data?.lastPurchaseDate || localMatch.lastPurchaseDate,
              updatedAt: cRow.updated_at || cRow.data?.updatedAt || new Date().toISOString(),
            };
            localCustToPut.push(mergedCustomer);
          } else {
            // Local device has a newer update (e.g. repayment or udhar given offline on this device)
            if (!isDemoCustomer(localMatch)) {
              cloudCustToUpsert.push({
                id: localMatch.id,
                name: localMatch.name,
                phone: localMatch.phone,
                outstanding_udhar: localMatch.outstandingUdhar,
                data: localMatch,
                updated_at: localMatch.updatedAt || new Date().toISOString(),
              });
            }
          }
        } else {
          // Cloud has a customer that does not exist locally -> Safely add to local Dexie
          const newCustomer: Customer = {
            ...(cRow.data || {}),
            id: cloudId,
            name: cRow.name || cRow.data?.name || 'Customer',
            phone: cloudPhone,
            outstandingUdhar: cloudUdhar,
            purchaseCount: Number(cRow.data?.purchaseCount ?? 0),
            totalSpending: Number(cRow.data?.totalSpending ?? 0),
            registrationDate: cRow.data?.registrationDate || cRow.updated_at || new Date().toISOString(),
            communicationConsent: Boolean(cRow.data?.communicationConsent ?? true),
            notes: cRow.data?.notes || '',
            address: cRow.data?.address || '',
            updatedAt: cRow.updated_at || cRow.data?.updatedAt || new Date().toISOString(),
          };
          localCustToPut.push(newCustomer);
        }
      }
    }

    // Local customers not yet in Cloud -> Upload to Cloud (protecting demo data)
    for (const lCust of localCustomers) {
      if (lCust.id && !processedCustLocalIds.has(lCust.id) && !isDemoCustomer(lCust)) {
        cloudCustToUpsert.push({
          id: lCust.id,
          name: lCust.name,
          phone: lCust.phone,
          outstanding_udhar: lCust.outstandingUdhar,
          data: lCust,
          updated_at: lCust.updatedAt || new Date().toISOString(),
        });
      }
    }

    // Execute Customers DB Updates
    if (localCustToDeleteOldIds.length > 0) {
      await db.customers.bulkDelete(localCustToDeleteOldIds);
    }
    if (localCustToPut.length > 0) {
      await db.customers.bulkPut(localCustToPut);
    }
    if (cloudCustToUpsert.length > 0) {
      await client.from('customers').upsert(cloudCustToUpsert);
    }

    // =========================================================================
    // B. SYNC PRODUCTS & STOCK QUANTITY
    // =========================================================================
    const localProdMapById = new Map<number, Product>();
    const localProdMapByBarcode = new Map<string, Product>();
    for (const p of localProducts) {
      if (p.id) localProdMapById.set(p.id, p);
      if (p.barcode && p.barcode.trim()) localProdMapByBarcode.set(p.barcode.trim(), p);
    }

    const localProdToPut: Product[] = [];
    const localProdToDeleteOldIds: number[] = [];
    const cloudProdToUpsert: any[] = [];
    const processedProdLocalIds = new Set<number>();

    if (cloudProducts) {
      for (const pRow of cloudProducts) {
        const cloudId = Number(pRow.id);
        const cloudStock = pRow.stock_quantity !== null && pRow.stock_quantity !== undefined
          ? Number(pRow.stock_quantity)
          : Number(pRow.data?.stockQuantity ?? 0);
        const cloudPrice = pRow.selling_price !== null && pRow.selling_price !== undefined
          ? Number(pRow.selling_price)
          : Number(pRow.data?.sellingPrice ?? 0);
        const cloudBarcode = (pRow.barcode || pRow.data?.barcode || '').trim();
        const cloudUpdatedTime = new Date(pRow.updated_at || pRow.data?.updatedAt || 0).getTime();

        const localMatch = localProdMapById.get(cloudId) || (cloudBarcode ? localProdMapByBarcode.get(cloudBarcode) : undefined);

        if (localMatch) {
          if (localMatch.id) processedProdLocalIds.add(localMatch.id);
          const localUpdatedTime = new Date(localMatch.updatedAt || localMatch.createdAt || 0).getTime();

          const hasIdMismatch = localMatch.id !== cloudId;

          if (cloudUpdatedTime >= localUpdatedTime || hasIdMismatch) {
            // Cloud has newer stock or details (e.g. Device 1 made sale or updated stock)
            if (hasIdMismatch && localMatch.id) {
              localProdToDeleteOldIds.push(localMatch.id);
            }

            const mergedProduct: Product = {
              ...localMatch,
              ...(pRow.data || {}),
              id: cloudId,
              name: pRow.name || pRow.data?.name || localMatch.name,
              category: pRow.category || pRow.data?.category || localMatch.category,
              barcode: cloudBarcode || localMatch.barcode,
              sellingPrice: cloudPrice,
              stockQuantity: cloudStock,
              unit: (pRow.unit || pRow.data?.unit || localMatch.unit) as any,
              updatedAt: pRow.updated_at || pRow.data?.updatedAt || new Date().toISOString(),
            };
            localProdToPut.push(mergedProduct);
          } else {
            // Local product has newer update
            if (!isDemoProduct(localMatch)) {
              cloudProdToUpsert.push({
                id: localMatch.id,
                name: localMatch.name,
                category: localMatch.category,
                barcode: localMatch.barcode,
                selling_price: localMatch.sellingPrice,
                stock_quantity: localMatch.stockQuantity,
                unit: localMatch.unit,
                data: localMatch,
                updated_at: localMatch.updatedAt || new Date().toISOString(),
              });
            }
          }
        } else {
          // Cloud product does not exist locally -> Safely add to local Dexie
          const newProduct: Product = {
            ...(pRow.data || {}),
            id: cloudId,
            name: pRow.name || pRow.data?.name || 'Item',
            category: pRow.category || pRow.data?.category || 'General',
            brand: pRow.data?.brand || '',
            sku: pRow.data?.sku || `SKU-${cloudId}`,
            barcode: cloudBarcode,
            unit: (pRow.unit || pRow.data?.unit || 'piece') as any,
            purchasePrice: Number(pRow.data?.purchasePrice ?? 0),
            sellingPrice: cloudPrice,
            stockQuantity: cloudStock,
            minStockThreshold: Number(pRow.data?.minStockThreshold ?? 5),
            supplierName: pRow.data?.supplierName || '',
            expiryDate: pRow.data?.expiryDate || '',
            isArchived: Boolean(pRow.data?.isArchived),
            createdAt: pRow.data?.createdAt || pRow.updated_at || new Date().toISOString(),
            updatedAt: pRow.updated_at || pRow.data?.updatedAt || new Date().toISOString(),
          };
          localProdToPut.push(newProduct);
        }
      }
    }

    // Local products not yet in Cloud -> Upload to Cloud
    for (const lProd of localProducts) {
      if (lProd.id && !processedProdLocalIds.has(lProd.id) && !isDemoProduct(lProd)) {
        cloudProdToUpsert.push({
          id: lProd.id,
          name: lProd.name,
          category: lProd.category,
          barcode: lProd.barcode,
          selling_price: lProd.sellingPrice,
          stock_quantity: lProd.stockQuantity,
          unit: lProd.unit,
          data: lProd,
          updated_at: lProd.updatedAt || new Date().toISOString(),
        });
      }
    }

    // Execute Products DB Updates
    if (localProdToDeleteOldIds.length > 0) {
      await db.products.bulkDelete(localProdToDeleteOldIds);
    }
    if (localProdToPut.length > 0) {
      await db.products.bulkPut(localProdToPut);
    }
    if (cloudProdToUpsert.length > 0) {
      await client.from('products').upsert(cloudProdToUpsert);
    }

    // =========================================================================
    // C. SYNC INVOICES / BILLS (Match by invoiceNumber to respect &invoiceNumber)
    // =========================================================================
    const localInvMapByNumber = new Map<string, Invoice>();
    for (const inv of localInvoices) {
      if (inv.invoiceNumber) localInvMapByNumber.set(inv.invoiceNumber.trim(), inv);
    }

    const localInvToPut: Invoice[] = [];
    const localInvToDeleteOldIds: number[] = [];
    const cloudInvToUpsert: any[] = [];
    const processedInvNumbers = new Set<string>();

    if (cloudInvoices) {
      for (const iRow of cloudInvoices) {
        const invNum = (iRow.invoice_number || iRow.data?.invoiceNumber || '').trim();
        if (!invNum) continue;
        processedInvNumbers.add(invNum);
        const cloudId = Number(iRow.id);

        const localMatch = localInvMapByNumber.get(invNum);

        if (localMatch) {
          // If invoice exists in both, check if ID needs alignment or status changed
          if (localMatch.id !== cloudId && localMatch.id) {
            localInvToDeleteOldIds.push(localMatch.id);
          }
          if (iRow.data?.status && iRow.data.status !== localMatch.status) {
            localInvToPut.push({
              ...localMatch,
              ...(iRow.data || {}),
              id: cloudId,
              invoiceNumber: invNum,
              status: iRow.data.status,
            });
          }
        } else {
          // New invoice from another device -> Add to local Dexie
          const newInv: Invoice = {
            ...(iRow.data || {}),
            id: cloudId,
            invoiceNumber: invNum,
            date: iRow.date || iRow.data?.date || new Date().toISOString(),
            customerName: iRow.customer_name || iRow.data?.customerName || 'Walk-in Customer',
            customerPhone: iRow.customer_phone || iRow.data?.customerPhone || '',
            items: iRow.data?.items || [],
            subtotal: Number(iRow.data?.subtotal ?? iRow.total_amount ?? 0),
            discountAmount: Number(iRow.data?.discountAmount ?? 0),
            totalAmount: Number(iRow.total_amount ?? iRow.data?.totalAmount ?? 0),
            costAmount: Number(iRow.data?.costAmount ?? 0),
            profit: Number(iRow.data?.profit ?? 0),
            paymentMethod: (iRow.payment_method || iRow.data?.paymentMethod || 'cash') as any,
            paidAmount: Number(iRow.data?.paidAmount ?? iRow.total_amount ?? 0),
            udharAmount: Number(iRow.data?.udharAmount ?? 0),
            status: (iRow.data?.status || 'completed') as any,
            createdAt: iRow.created_at || iRow.data?.createdAt || new Date().toISOString(),
          };
          localInvToPut.push(newInv);
        }
      }
    }

    // Local invoices not in cloud -> Upload to Cloud
    for (const lInv of localInvoices) {
      if (lInv.invoiceNumber && !processedInvNumbers.has(lInv.invoiceNumber.trim())) {
        cloudInvToUpsert.push({
          id: lInv.id,
          invoice_number: lInv.invoiceNumber,
          customer_name: lInv.customerName,
          customer_phone: lInv.customerPhone,
          total_amount: lInv.totalAmount,
          payment_method: lInv.paymentMethod,
          date: lInv.date,
          data: lInv,
          created_at: lInv.createdAt || lInv.date,
        });
      }
    }

    if (localInvToDeleteOldIds.length > 0) {
      await db.invoices.bulkDelete(localInvToDeleteOldIds);
    }
    if (localInvToPut.length > 0) {
      await db.invoices.bulkPut(localInvToPut);
    }
    if (cloudInvToUpsert.length > 0) {
      await client.from('invoices').upsert(cloudInvToUpsert, { onConflict: 'invoice_number' });
    }

    // =========================================================================
    // D. SYNC UDHAR LEDGER ENTRIES
    // =========================================================================
    const localUdharMap = new Map<number, UdharEntry>();
    for (const u of localUdhar) {
      if (u.id) localUdharMap.set(u.id, u);
    }

    const localUdharToPut: UdharEntry[] = [];
    const cloudUdharToUpsert: any[] = [];
    const processedUdharIds = new Set<number>();

    if (cloudUdhar) {
      for (const uRow of cloudUdhar) {
        const cloudId = Number(uRow.id);
        processedUdharIds.add(cloudId);

        if (!localUdharMap.has(cloudId)) {
          localUdharToPut.push({
            ...(uRow.data || {}),
            id: cloudId,
            customerId: Number(uRow.customer_id || uRow.data?.customerId),
            invoiceId: uRow.invoice_id ? Number(uRow.invoice_id) : undefined,
            amount: Number(uRow.amount ?? uRow.data?.amount ?? 0),
            date: uRow.date || uRow.data?.date || new Date().toISOString(),
            customerName: uRow.data?.customerName || '',
            customerPhone: uRow.data?.customerPhone || '',
            type: uRow.data?.type || 'credit_sale',
            balanceAfter: Number(uRow.data?.balanceAfter ?? 0),
          });
        }
      }
    }

    for (const lU of localUdhar) {
      if (lU.id && !processedUdharIds.has(lU.id)) {
        cloudUdharToUpsert.push({
          id: lU.id,
          customer_id: lU.customerId,
          invoice_id: lU.invoiceId || null,
          amount: lU.amount,
          date: lU.date,
          data: lU,
        });
      }
    }

    if (localUdharToPut.length > 0) {
      await db.udharLedger.bulkPut(localUdharToPut);
    }
    if (cloudUdharToUpsert.length > 0) {
      await client.from('udhar_ledger').upsert(cloudUdharToUpsert);
    }

    // =========================================================================
    // E. SYNC STOCK MOVEMENTS
    // =========================================================================
    const localMovMap = new Map<number, StockMovement>();
    for (const m of localMovements) {
      if (m.id) localMovMap.set(m.id, m);
    }

    const localMovToPut: StockMovement[] = [];
    const cloudMovToUpsert: any[] = [];
    const processedMovIds = new Set<number>();

    if (cloudMovements) {
      for (const mRow of cloudMovements) {
        const cloudId = Number(mRow.id);
        processedMovIds.add(cloudId);

        if (!localMovMap.has(cloudId)) {
          localMovToPut.push({
            ...(mRow.data || {}),
            id: cloudId,
            productId: Number(mRow.product_id || mRow.data?.productId),
            type: mRow.type || mRow.data?.type || 'manual_in',
            quantityChange: Number(mRow.quantity_change ?? mRow.data?.quantityChange ?? 0),
            date: mRow.date || mRow.data?.date || new Date().toISOString(),
            productName: mRow.data?.productName || '',
            quantityAfter: Number(mRow.data?.quantityAfter ?? 0),
            reason: mRow.data?.reason || '',
          });
        }
      }
    }

    for (const lM of localMovements) {
      if (lM.id && !processedMovIds.has(lM.id)) {
        cloudMovToUpsert.push({
          id: lM.id,
          product_id: lM.productId,
          type: lM.type,
          quantity_change: lM.quantityChange,
          date: lM.date,
          data: lM,
        });
      }
    }

    if (localMovToPut.length > 0) {
      await db.stockMovements.bulkPut(localMovToPut);
    }
    if (cloudMovToUpsert.length > 0) {
      await client.from('stock_movements').upsert(cloudMovToUpsert);
    }

    // =========================================================================
    // F. SYNC SUPPLIERS & PURCHASES
    // =========================================================================
    const localSuppMap = new Map<number, Supplier>();
    for (const s of localSuppliers) {
      if (s.id) localSuppMap.set(s.id, s);
    }

    const localSuppToPut: Supplier[] = [];
    const cloudSuppToUpsert: any[] = [];
    const processedSuppIds = new Set<number>();

    if (cloudSuppliers) {
      for (const sRow of cloudSuppliers) {
        const cloudId = Number(sRow.id);
        processedSuppIds.add(cloudId);
        if (!localSuppMap.has(cloudId)) {
          localSuppToPut.push({
            ...(sRow.data || {}),
            id: cloudId,
            name: sRow.name || sRow.data?.name || 'Supplier',
            phone: sRow.phone || sRow.data?.phone || '',
          });
        }
      }
    }

    for (const lS of localSuppliers) {
      if (lS.id && !processedSuppIds.has(lS.id)) {
        cloudSuppToUpsert.push({
          id: lS.id,
          name: lS.name,
          phone: lS.phone,
          data: lS,
        });
      }
    }

    if (localSuppToPut.length > 0) await db.suppliers.bulkPut(localSuppToPut);
    if (cloudSuppToUpsert.length > 0) await client.from('suppliers').upsert(cloudSuppToUpsert);

    // Purchases
    const localPurMap = new Map<number, Purchase>();
    for (const p of localPurchases) {
      if (p.id) localPurMap.set(p.id, p);
    }

    const localPurToPut: Purchase[] = [];
    const cloudPurToUpsert: any[] = [];
    const processedPurIds = new Set<number>();

    if (cloudPurchases) {
      for (const pRow of cloudPurchases) {
        const cloudId = Number(pRow.id);
        processedPurIds.add(cloudId);
        if (!localPurMap.has(cloudId)) {
          localPurToPut.push({
            ...(pRow.data || {}),
            id: cloudId,
            supplierId: Number(pRow.supplier_id || pRow.data?.supplierId),
            purchaseInvoiceNo: pRow.purchase_invoice_no || pRow.data?.purchaseInvoiceNo || '',
            totalCost: Number(pRow.total_cost ?? pRow.data?.totalCost ?? 0),
            date: pRow.date || pRow.data?.date || new Date().toISOString(),
          });
        }
      }
    }

    for (const lP of localPurchases) {
      if (lP.id && !processedPurIds.has(lP.id)) {
        cloudPurToUpsert.push({
          id: lP.id,
          supplier_id: lP.supplierId,
          purchase_invoice_no: lP.purchaseInvoiceNo,
          total_cost: lP.totalCost,
          date: lP.date,
          data: lP,
        });
      }
    }

    if (localPurToPut.length > 0) await db.purchases.bulkPut(localPurToPut);
    if (cloudPurToUpsert.length > 0) await client.from('purchases').upsert(cloudPurToUpsert);

    // =========================================================================
    // G. SYNC STORE SETTINGS (preserve local credentials)
    // =========================================================================
    if (cloudSettings && cloudSettings.length > 0) {
      const cSet = cloudSettings[0];
      const lSet = localSettings[0];
      if (cSet && cSet.data) {
        const cloudSetData = cSet.data as StoreSettings;
        const mergedSettings: StoreSettings = {
          ...cloudSetData,
          supabaseUrl: lSet?.supabaseUrl || cloudSetData.supabaseUrl || DEFAULT_SUPABASE_URL,
          supabaseAnonKey: lSet?.supabaseAnonKey || cloudSetData.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY,
          supabaseEmail: lSet?.supabaseEmail || cloudSetData.supabaseEmail || DEFAULT_SUPABASE_EMAIL,
          supabaseAutoSync: lSet?.supabaseAutoSync ?? cloudSetData.supabaseAutoSync ?? true,
        };
        await db.storeSettings.put(mergedSettings);
      }
    }

    const timestamp = new Date().toISOString();
    localStorage.setItem('kirana_last_supabase_sync', timestamp);

    const totalProducts = await db.products.count();
    const totalCustomers = await db.customers.count();
    const totalInvoices = await db.invoices.count();

    return {
      success: true,
      message: `Two-way sync complete: ${totalProducts} products, ${totalCustomers} customers & udhaar up to date!`,
      syncedCounts: {
        products: totalProducts,
        customers: totalCustomers,
        invoices: totalInvoices,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error during bidirectional sync';
    console.error('Bidirectional sync failed:', err);
    return { success: false, message: msg };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Backward-compatible syncLocalToSupabase
 * Calls smart bidirectional sync to safely keep both local & cloud updated without data destruction
 */
export async function syncLocalToSupabase(): Promise<{
  success: boolean;
  message: string;
  syncedCounts?: { products: number; customers: number; invoices: number };
}> {
  return syncBidirectional();
}

/**
 * Restore data from Supabase Cloud back into local Dexie safely
 * Uses bidirectional logic with cloud precedence, preventing phone/invoice constraint crashes
 */
export async function restoreFromSupabase(): Promise<{
  success: boolean;
  message: string;
  restoredCounts?: { products: number; customers: number; invoices: number };
}> {
  const res = await syncBidirectional();
  return {
    success: res.success,
    message: res.message,
    restoredCounts: res.syncedCounts,
  };
}

/**
 * Supabase Realtime Multi-Device Live Sync
 * Receives instant Postgres row events when another device updates stock or udhaar
 */
let realtimeChannel: RealtimeChannel | null = null;

export function setupSupabaseRealtime(onRealtimeUpdate?: (tableName: string) => void) {
  if (typeof window === 'undefined') return;
  const client = getSupabaseClient();
  if (!client) return;

  if (realtimeChannel) {
    try {
      client.removeChannel(realtimeChannel);
    } catch (e) {
      console.warn('Realtime cleanup warning:', e);
    }
    realtimeChannel = null;
  }

  try {
    realtimeChannel = client
      .channel('mohit-kirana-realtime-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, async (payload) => {
        try {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as any;
            if (row && row.id) {
              const cId = Number(row.id);
              const cloudUdhar = row.outstanding_udhar !== null && row.outstanding_udhar !== undefined
                ? Number(row.outstanding_udhar)
                : Number(row.data?.outstandingUdhar ?? 0);
              const phone = (row.phone || row.data?.phone || '').trim();

              const existing = await db.customers.get(cId);

              // Check if any different local customer has the same phone (unique constraint)
              if (phone) {
                const withSamePhone = await db.customers.where('phone').equals(phone).first();
                if (withSamePhone && withSamePhone.id !== cId) {
                  await db.customers.delete(withSamePhone.id!);
                }
              }

              await db.customers.put({
                ...(existing || {}),
                ...(row.data || {}),
                id: cId,
                name: row.name || row.data?.name || existing?.name || 'Customer',
                phone: phone || existing?.phone || '',
                outstandingUdhar: cloudUdhar,
                updatedAt: row.updated_at || row.data?.updatedAt || new Date().toISOString(),
              });

              if (onRealtimeUpdate) onRealtimeUpdate('customers');
            }
          }
        } catch (err) {
          console.warn('Realtime customer update error:', err);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async (payload) => {
        try {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as any;
            if (row && row.id) {
              const pId = Number(row.id);
              const cloudStock = row.stock_quantity !== null && row.stock_quantity !== undefined
                ? Number(row.stock_quantity)
                : Number(row.data?.stockQuantity ?? 0);
              const cloudPrice = row.selling_price !== null && row.selling_price !== undefined
                ? Number(row.selling_price)
                : Number(row.data?.sellingPrice ?? 0);

              const existing = await db.products.get(pId);

              await db.products.put({
                ...(existing || {}),
                ...(row.data || {}),
                id: pId,
                name: row.name || row.data?.name || existing?.name || 'Item',
                category: row.category || row.data?.category || existing?.category || 'General',
                barcode: row.barcode || row.data?.barcode || existing?.barcode || '',
                stockQuantity: cloudStock,
                sellingPrice: cloudPrice,
                unit: (row.unit || row.data?.unit || existing?.unit || 'piece') as any,
                updatedAt: row.updated_at || row.data?.updatedAt || new Date().toISOString(),
              });

              if (onRealtimeUpdate) onRealtimeUpdate('products');
            }
          }
        } catch (err) {
          console.warn('Realtime product update error:', err);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'udhar_ledger' }, async (payload) => {
        try {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as any;
            if (row && row.id) {
              const uId = Number(row.id);
              await db.udharLedger.put({
                ...(row.data || {}),
                id: uId,
                customerId: Number(row.customer_id || row.data?.customerId),
                invoiceId: row.invoice_id ? Number(row.invoice_id) : undefined,
                amount: Number(row.amount ?? row.data?.amount ?? 0),
                date: row.date || row.data?.date || new Date().toISOString(),
              });
              if (onRealtimeUpdate) onRealtimeUpdate('udhar_ledger');
            }
          }
        } catch (err) {
          console.warn('Realtime udhar_ledger update error:', err);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, async (payload) => {
        try {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as any;
            if (row && row.id) {
              await db.stockMovements.put({
                ...(row.data || {}),
                id: Number(row.id),
                productId: Number(row.product_id || row.data?.productId),
                type: row.type || row.data?.type || 'manual_in',
                quantityChange: Number(row.quantity_change ?? row.data?.quantityChange ?? 0),
                date: row.date || row.data?.date || new Date().toISOString(),
              });
              if (onRealtimeUpdate) onRealtimeUpdate('stock_movements');
            }
          }
        } catch (err) {
          console.warn('Realtime stock_movements update error:', err);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, async (payload) => {
        try {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as any;
            if (row && row.invoice_number) {
              const invNum = row.invoice_number.trim();
              const existing = await db.invoices.where('invoiceNumber').equals(invNum).first();
              if (existing && existing.id !== Number(row.id)) {
                await db.invoices.delete(existing.id!);
              }
              await db.invoices.put({
                ...(existing || {}),
                ...(row.data || {}),
                id: Number(row.id),
                invoiceNumber: invNum,
                totalAmount: Number(row.total_amount ?? row.data?.totalAmount ?? 0),
                paymentMethod: (row.payment_method || row.data?.paymentMethod || 'cash') as any,
                date: row.date || row.data?.date || new Date().toISOString(),
              });
              if (onRealtimeUpdate) onRealtimeUpdate('invoices');
            }
          }
        } catch (err) {
          console.warn('Realtime invoices update error:', err);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('⚡ Supabase Realtime multi-device sync active');
        }
      });
  } catch (err) {
    console.warn('Failed to setup Supabase Realtime channel:', err);
  }
}

/**
 * Setup listeners for online/offline and app resume events to trigger auto-sync
 */
let isAutoSyncRegistered = false;

export function setupAutoOnlineSync(onStatusChange?: (status: { online: boolean; message?: string }) => void) {
  if (typeof window === 'undefined' || isAutoSyncRegistered) return;
  isAutoSyncRegistered = true;

  const handleSync = async () => {
    const { autoSync, url, anonKey } = getSupabaseConfig();
    if (!autoSync || !url || !anonKey || !isOnline()) return;

    if (onStatusChange) {
      onStatusChange({ online: true, message: 'Syncing live store data...' });
    }

    try {
      const res = await syncBidirectional();
      if (onStatusChange) {
        onStatusChange({ online: true, message: res.message });
      }
    } catch (e) {
      console.warn('Auto-sync execution failed:', e);
    }
  };

  const handleOffline = () => {
    if (onStatusChange) {
      onStatusChange({ online: false, message: 'Offline mode: saving records locally on phone.' });
    }
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && isOnline()) {
      handleSync();
    }
  };

  window.addEventListener('online', handleSync);
  window.addEventListener('offline', handleOffline);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('focus', () => {
    if (isOnline()) handleSync();
  });

  // Setup Realtime live stream
  setupSupabaseRealtime((table) => {
    if (onStatusChange) {
      onStatusChange({ online: true, message: `Live update received from other device: ${table}` });
    }
  });
}

/**
 * Trigger debounced cloud synchronization in the background after any write action
 */
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function triggerBackgroundCloudSync(delayMs = 1200) {
  if (typeof window === 'undefined') return;
  const { url, anonKey, autoSync } = getSupabaseConfig();
  if (!url || !anonKey || !autoSync || !isOnline()) return;

  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  syncDebounceTimer = setTimeout(() => {
    syncBidirectional().catch((err) => {
      console.warn('Background auto-sync failed:', err);
    });
  }, delayMs);
}
