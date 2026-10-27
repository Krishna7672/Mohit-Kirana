import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from './index';
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

export function getSupabaseConfig(): SupabaseConfig {
  const url =
    localStorage.getItem('kirana_supabase_url') ||
    (import.meta.env.VITE_SUPABASE_URL as string) ||
    '';
  const anonKey =
    localStorage.getItem('kirana_supabase_anon_key') ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
    '';
  const email =
    localStorage.getItem('kirana_supabase_email') ||
    (import.meta.env.VITE_SUPABASE_EMAIL as string) ||
    '';
  const autoSyncStr = localStorage.getItem('kirana_supabase_auto_sync');
  const autoSync = autoSyncStr === null ? Boolean(url && anonKey) : autoSyncStr === 'true';

  return { url, anonKey, email, autoSync };
}

export function saveSupabaseConfig(config: Partial<SupabaseConfig>) {
  if (config.url !== undefined) {
    localStorage.setItem('kirana_supabase_url', config.url.trim());
  }
  if (config.anonKey !== undefined) {
    localStorage.setItem('kirana_supabase_anon_key', config.anonKey.trim());
  }
  if (config.email !== undefined) {
    localStorage.setItem('kirana_supabase_email', config.email.trim());
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
      message: 'Connected to Supabase Cloud successfully! Free tier active.',
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Connection failed';
    return { success: false, message: `Failed to connect: ${msg}` };
  }
}

/**
 * Sync all local Dexie (IndexedDB) data up to Supabase Cloud
 */
export async function syncLocalToSupabase(): Promise<{
  success: boolean;
  message: string;
  syncedCounts?: { products: number; customers: number; invoices: number };
}> {
  if (!isOnline()) {
    return {
      success: false,
      message: 'Offline: Data saved safely in local phone memory. Will auto-sync when online.',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase not configured. Add your Project URL & Anon Key in Settings.',
    };
  }

  try {
    // 1. Fetch current local tables from Dexie
    const [
      products,
      customers,
      invoices,
      udharLedger,
      stockMovements,
      suppliers,
      purchases,
      storeSettings,
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

    // 2. Upsert Store Settings
    if (storeSettings.length > 0) {
      const settingsPayload = storeSettings.map((s) => ({
        id: s.id,
        data: s,
        updated_at: new Date().toISOString(),
      }));
      await client.from('store_settings').upsert(settingsPayload);
    }

    // 3. Upsert Products
    if (products.length > 0) {
      const productsPayload = products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        barcode: p.barcode,
        selling_price: p.sellingPrice,
        stock_quantity: p.stockQuantity,
        unit: p.unit,
        data: p,
        updated_at: p.updatedAt || new Date().toISOString(),
      }));
      const { error } = await client.from('products').upsert(productsPayload);
      if (error) throw new Error(`Products sync error: ${error.message}`);
    }

    // 4. Upsert Customers
    if (customers.length > 0) {
      const customersPayload = customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        outstanding_udhar: c.outstandingUdhar,
        data: c,
        updated_at: c.updatedAt || new Date().toISOString(),
      }));
      const { error } = await client.from('customers').upsert(customersPayload);
      if (error) throw new Error(`Customers sync error: ${error.message}`);
    }

    // 5. Upsert Invoices
    if (invoices.length > 0) {
      const invoicesPayload = invoices.map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoiceNumber,
        customer_name: inv.customerName,
        customer_phone: inv.customerPhone,
        total_amount: inv.totalAmount,
        payment_method: inv.paymentMethod,
        date: inv.date,
        data: inv,
        created_at: inv.createdAt || inv.date,
      }));
      const { error } = await client.from('invoices').upsert(invoicesPayload, {
        onConflict: 'invoice_number',
      });
      if (error) throw new Error(`Invoices sync error: ${error.message}`);
    }

    // 6. Upsert Udhar Ledger
    if (udharLedger.length > 0) {
      const udharPayload = udharLedger.map((u) => ({
        id: u.id,
        customer_id: u.customerId,
        invoice_id: u.invoiceId,
        amount: u.amount,
        date: u.date,
        data: u,
      }));
      const { error } = await client.from('udhar_ledger').upsert(udharPayload);
      if (error) throw new Error(`Udhar sync error: ${error.message}`);
    }

    // 7. Upsert Stock Movements
    if (stockMovements.length > 0) {
      const movementsPayload = stockMovements.map((m) => ({
        id: m.id,
        product_id: m.productId,
        type: m.type,
        quantity_change: m.quantityChange,
        date: m.date,
        data: m,
      }));
      await client.from('stock_movements').upsert(movementsPayload);
    }

    // 8. Upsert Suppliers & Purchases
    if (suppliers.length > 0) {
      const suppliersPayload = suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        data: s,
      }));
      await client.from('suppliers').upsert(suppliersPayload);
    }

    if (purchases.length > 0) {
      const purchasesPayload = purchases.map((p) => ({
        id: p.id,
        supplier_id: p.supplierId,
        purchase_invoice_no: p.purchaseInvoiceNo,
        total_cost: p.totalCost,
        date: p.date,
        data: p,
      }));
      await client.from('purchases').upsert(purchasesPayload);
    }

    const timestamp = new Date().toISOString();
    localStorage.setItem('kirana_last_supabase_sync', timestamp);

    return {
      success: true,
      message: `Synced ${products.length} products, ${customers.length} parties, and ${invoices.length} bills to Supabase Cloud!`,
      syncedCounts: {
        products: products.length,
        customers: customers.length,
        invoices: invoices.length,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error syncing to Supabase';
    console.error('Supabase sync error:', err);
    return { success: false, message: msg };
  }
}

/**
 * Restore data from Supabase Cloud back into local Dexie (without deleting existing records)
 */
export async function restoreFromSupabase(): Promise<{
  success: boolean;
  message: string;
  restoredCounts?: { products: number; customers: number; invoices: number };
}> {
  if (!isOnline()) {
    return { success: false, message: 'Device is offline. Connect to internet to restore from cloud.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase URL or Anon Key is missing.' };
  }

  try {
    const [
      { data: productsRows },
      { data: customersRows },
      { data: invoicesRows },
      { data: udharRows },
      { data: movementsRows },
      { data: suppliersRows },
      { data: purchasesRows },
      { data: settingsRows },
    ] = await Promise.all([
      client.from('products').select('data'),
      client.from('customers').select('data'),
      client.from('invoices').select('data'),
      client.from('udhar_ledger').select('data'),
      client.from('stock_movements').select('data'),
      client.from('suppliers').select('data'),
      client.from('purchases').select('data'),
      client.from('store_settings').select('data'),
    ]);

    let restoredP = 0;
    let restoredC = 0;
    let restoredI = 0;

    await db.transaction('rw', [
      db.products,
      db.customers,
      db.invoices,
      db.udharLedger,
      db.stockMovements,
      db.suppliers,
      db.purchases,
      db.storeSettings,
    ], async () => {
      if (productsRows?.length) {
        const prods = productsRows.map((r) => r.data as Product).filter(Boolean);
        await db.products.bulkPut(prods);
        restoredP = prods.length;
      }

      if (customersRows?.length) {
        const custs = customersRows.map((r) => r.data as Customer).filter(Boolean);
        await db.customers.bulkPut(custs);
        restoredC = custs.length;
      }

      if (invoicesRows?.length) {
        const invs = invoicesRows.map((r) => r.data as Invoice).filter(Boolean);
        await db.invoices.bulkPut(invs);
        restoredI = invs.length;
      }

      if (udharRows?.length) {
        const udhars = udharRows.map((r) => r.data as UdharEntry).filter(Boolean);
        await db.udharLedger.bulkPut(udhars);
      }

      if (movementsRows?.length) {
        const movs = movementsRows.map((r) => r.data as StockMovement).filter(Boolean);
        await db.stockMovements.bulkPut(movs);
      }

      if (suppliersRows?.length) {
        const supps = suppliersRows.map((r) => r.data as Supplier).filter(Boolean);
        await db.suppliers.bulkPut(supps);
      }

      if (purchasesRows?.length) {
        const purches = purchasesRows.map((r) => r.data as Purchase).filter(Boolean);
        await db.purchases.bulkPut(purches);
      }

      if (settingsRows?.length) {
        for (const s of settingsRows) {
          if (s.data) await db.storeSettings.put(s.data as StoreSettings);
        }
      }
    });

    return {
      success: true,
      message: `Restored ${restoredP} products, ${restoredC} customers, and ${restoredI} bills from Supabase Cloud!`,
      restoredCounts: {
        products: restoredP,
        customers: restoredC,
        invoices: restoredI,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error restoring from Supabase';
    return { success: false, message: msg };
  }
}

/**
 * Setup listeners for online/offline and app resume events to trigger auto-sync
 */
let isAutoSyncRegistered = false;

export function setupAutoOnlineSync(onStatusChange?: (status: { online: boolean; message?: string }) => void) {
  if (typeof window === 'undefined' || isAutoSyncRegistered) return;
  isAutoSyncRegistered = true;

  const handleOnline = async () => {
    const { autoSync, url, anonKey } = getSupabaseConfig();
    if (!autoSync || !url || !anonKey) return;

    if (onStatusChange) {
      onStatusChange({ online: true, message: 'Online detected: Syncing to cloud...' });
    }

    try {
      const res = await syncLocalToSupabase();
      if (onStatusChange) {
        onStatusChange({ online: true, message: res.message });
      }
    } catch (e) {
      console.warn('Auto-sync on online failed:', e);
    }
  };

  const handleOffline = () => {
    if (onStatusChange) {
      onStatusChange({ online: false, message: 'Offline mode: saving records locally on phone.' });
    }
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && isOnline()) {
      handleOnline();
    }
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  document.addEventListener('visibilitychange', handleVisibility);
}

/**
 * Trigger debounced cloud synchronization in the background after any write action
 */
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function triggerBackgroundCloudSync(delayMs = 2500) {
  if (typeof window === 'undefined') return;
  const { url, anonKey, autoSync } = getSupabaseConfig();
  if (!url || !anonKey || !autoSync || !isOnline()) return;

  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  syncDebounceTimer = setTimeout(() => {
    syncLocalToSupabase().catch((err) => {
      console.warn('Background auto-sync failed:', err);
    });
  }, delayMs);
}
