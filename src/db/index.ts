import Dexie, { type Table } from 'dexie';
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

export class MohitKiranaDB extends Dexie {
  products!: Table<Product, number>;
  customers!: Table<Customer, number>;
  invoices!: Table<Invoice, number>;
  udharLedger!: Table<UdharEntry, number>;
  stockMovements!: Table<StockMovement, number>;
  suppliers!: Table<Supplier, number>;
  purchases!: Table<Purchase, number>;
  storeSettings!: Table<StoreSettings, string>;

  constructor() {
    super('MohitKiranaDB');

    this.version(2).stores({
      products: '++id, name, category, sku, barcode, isArchived, stockQuantity',
      customers: '++id, &phone, name, totalSpending, outstandingUdhar, purchaseCount',
      invoices: '++id, &invoiceNumber, date, customerId, customerPhone, paymentMethod, status',
      udharLedger: '++id, customerId, invoiceId, date',
      stockMovements: '++id, productId, type, date',
      suppliers: '++id, name, phone',
      purchases: '++id, supplierId, purchaseInvoiceNo, date',
      storeSettings: 'id',
    });
  }
}

import sampleBackupData from '../data/sampleBackup.json';

export const db = new MohitKiranaDB();

export const DEFAULT_SETTINGS: StoreSettings = {
  id: 'main',
  shopName: 'Mohit Kirana',
  tagline: 'Aapki Apni Vishwasniya Kirana Dukan',
  ownerName: 'Mohit Jain',
  phone: '+91 9767160743',
  address: 'Santaji chowk varud',
  gstin: '',
  upiId: 'mohitkirana7600@ybl',
  receiptFooter: 'Dhanyawad! Please visit again. Note: Items returned within 7 days with bill.',
  thermalWidth: '80mm',
  ownerPin: '',
  pinEnabled: false,
  currencySymbol: '₹',
  posTerminalName: 'POS-1',
  forceMobileLayout: true,
  supabaseEmail: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseAutoSync: false,
};

// Realistic grocery sample inventory
export const SAMPLE_PRODUCTS: Omit<Product, 'id'>[] = [
  {
    name: 'Aashirvaad Shudh Chakki Atta',
    category: 'Atta & Flours',
    brand: 'Aashirvaad',
    sku: 'ATT-ASH-10K',
    barcode: '8901030012341',
    unit: 'kg',
    purchasePrice: 380,
    sellingPrice: 425,
    stockQuantity: 45,
    minStockThreshold: 10,
    supplierName: 'Delhi Grain Traders',
    expiryDate: '2027-04-15',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Fortune Sunlite Refined Sunflower Oil (1L)',
    category: 'Edible Oils & Ghee',
    brand: 'Fortune',
    sku: 'OIL-FOR-1L',
    barcode: '8901030012342',
    unit: 'litre',
    purchasePrice: 125,
    sellingPrice: 145,
    stockQuantity: 60,
    minStockThreshold: 15,
    supplierName: 'Adani Wilmar Dist.',
    expiryDate: '2027-08-30',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Tata Sampann Unpolished Toor Dal',
    category: 'Pulses & Dals',
    brand: 'Tata Sampann',
    sku: 'DAL-TAT-1K',
    barcode: '8901030012343',
    unit: 'kg',
    purchasePrice: 150,
    sellingPrice: 175,
    stockQuantity: 32,
    minStockThreshold: 8,
    supplierName: 'Delhi Grain Traders',
    expiryDate: '2027-06-20',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Madhur Pure & Hygienic Sugar (M-30)',
    category: 'Grains & Sugar',
    brand: 'Madhur',
    sku: 'SUG-MAD-1K',
    barcode: '8901030012344',
    unit: 'kg',
    purchasePrice: 40,
    sellingPrice: 48,
    stockQuantity: 80,
    minStockThreshold: 20,
    supplierName: 'Kisan Sugar Mill Depot',
    expiryDate: '2027-10-10',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Tata Salt Vacuum Evaporated (1kg)',
    category: 'Spices & Seasonings',
    brand: 'Tata Salt',
    sku: 'SLT-TAT-1K',
    barcode: '8901030012345',
    unit: 'packet',
    purchasePrice: 22,
    sellingPrice: 28,
    stockQuantity: 110,
    minStockThreshold: 25,
    supplierName: 'Delhi FMCG Distributors',
    expiryDate: '2028-01-01',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Amul Butter Pasteurised (500g)',
    category: 'Dairy & Bakery',
    brand: 'Amul',
    sku: 'DAR-AMU-500G',
    barcode: '8901030012346',
    unit: 'packet',
    purchasePrice: 245,
    sellingPrice: 275,
    stockQuantity: 18,
    minStockThreshold: 5,
    supplierName: 'Amul Cold Chain Hub',
    expiryDate: '2026-12-15',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Maggi 2-Minute Masala Noodles (Pack of 4)',
    category: 'Snacks & Instant Food',
    brand: 'Nestle',
    sku: 'SNK-MAG-4PK',
    barcode: '8901030012347',
    unit: 'packet',
    purchasePrice: 50,
    sellingPrice: 58,
    stockQuantity: 50,
    minStockThreshold: 12,
    supplierName: 'Nestle C&F Agency',
    expiryDate: '2027-05-18',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Everest Turmeric Powder Haldi (200g)',
    category: 'Spices & Seasonings',
    brand: 'Everest',
    sku: 'SPC-EVR-HLD',
    barcode: '8901030012348',
    unit: 'packet',
    purchasePrice: 52,
    sellingPrice: 65,
    stockQuantity: 40,
    minStockThreshold: 10,
    supplierName: 'Masala Kendra',
    expiryDate: '2027-09-12',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Parle-G Gold Gluco Biscuits (1kg family pack)',
    category: 'Snacks & Biscuits',
    brand: 'Parle',
    sku: 'BSC-PRL-1K',
    barcode: '8901030012349',
    unit: 'packet',
    purchasePrice: 110,
    sellingPrice: 130,
    stockQuantity: 3,
    minStockThreshold: 10,
    supplierName: 'Delhi FMCG Distributors',
    expiryDate: '2027-04-05',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Surf Excel Quick Wash Detergent Powder (1kg)',
    category: 'Cleaning & Household',
    brand: 'Surf Excel',
    sku: 'CLN-SRF-1K',
    barcode: '8901030012350',
    unit: 'packet',
    purchasePrice: 132,
    sellingPrice: 155,
    stockQuantity: 0,
    minStockThreshold: 8,
    supplierName: 'Hindustan Unilever Depot',
    expiryDate: '2028-06-01',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Dettol Original Bathing Soap (Pack of 4x125g)',
    category: 'Personal Care',
    brand: 'Dettol',
    sku: 'PRS-DET-4PK',
    barcode: '8901030012351',
    unit: 'packet',
    purchasePrice: 175,
    sellingPrice: 210,
    stockQuantity: 24,
    minStockThreshold: 6,
    supplierName: 'Reckitt Benckiser Dist.',
    expiryDate: '2027-11-20',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'India Gate Basmati Rice Feast Rozzana',
    category: 'Grains & Sugar',
    brand: 'India Gate',
    sku: 'RIC-ING-5K',
    barcode: '8901030012352',
    unit: 'kg',
    purchasePrice: 85,
    sellingPrice: 105,
    stockQuantity: 55,
    minStockThreshold: 15,
    supplierName: 'Delhi Grain Traders',
    expiryDate: '2027-12-31',
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const SAMPLE_CUSTOMERS: Omit<Customer, 'id'>[] = [
  {
    name: 'Rahul Sharma',
    phone: '9876543210',
    address: 'Flat 402, Shanti Kunj, Sector 4',
    registrationDate: '2026-08-10T10:00:00.000Z',
    purchaseCount: 5,
    totalSpending: 4250,
    lastPurchaseDate: '2026-10-24T18:30:00.000Z',
    outstandingUdhar: 450,
    communicationConsent: true,
    notes: 'Regular customer, pays udhar on 1st of every month.',
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Pooja Verma',
    phone: '9811223344',
    address: 'House 14B, Gali No. 3, Main Market',
    registrationDate: '2026-09-02T14:15:00.000Z',
    purchaseCount: 3,
    totalSpending: 2180,
    lastPurchaseDate: '2026-10-20T11:45:00.000Z',
    outstandingUdhar: 0,
    communicationConsent: true,
    notes: 'Prefers Amul butter & Fortune oil.',
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Amit Kumar Singhal',
    phone: '9899112233',
    address: 'Singhal Sweets & Chaat, Market Gate',
    registrationDate: '2026-07-15T09:00:00.000Z',
    purchaseCount: 8,
    totalSpending: 8900,
    lastPurchaseDate: '2026-10-25T08:15:00.000Z',
    outstandingUdhar: 1200,
    communicationConsent: true,
    notes: 'Bulk purchaser for sugar and oil.',
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Sunita Devi',
    phone: '9822334455',
    address: 'Quarter 18, Railway Colony',
    registrationDate: '2026-05-10T12:00:00.000Z',
    purchaseCount: 1,
    totalSpending: 650,
    lastPurchaseDate: '2026-05-10T12:00:00.000Z',
    outstandingUdhar: 0,
    communicationConsent: false,
    notes: 'Occasional buyer.',
    updatedAt: new Date().toISOString()
  }
];

export const SAMPLE_SUPPLIERS: Omit<Supplier, 'id'>[] = [
  {
    name: 'Delhi Grain Traders',
    phone: '9810012345',
    address: 'Naya Bazar, Chandni Chowk, Delhi',
    gstin: '07AAACD1234F1Z9',
    totalPurchases: 45000,
    pendingBalance: 4000,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Adani Wilmar Dist.',
    phone: '9820054321',
    address: 'Godown No. 4, Lawrence Road, Delhi',
    gstin: '07AABCA5678G1Z2',
    totalPurchases: 32000,
    pendingBalance: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Delhi FMCG Distributors',
    phone: '9830098765',
    address: 'Okhla Industrial Area Phase II, Delhi',
    gstin: '07AACDE9012H1Z5',
    totalPurchases: 28000,
    pendingBalance: 1500,
    createdAt: new Date().toISOString()
  }
];

export async function purgeDemoData(): Promise<{ purgedCount: number; message: string }> {
  try {
    const demoBarcodes = new Set(SAMPLE_PRODUCTS.map((p) => p.barcode));
    const demoCustomerPhones = new Set(SAMPLE_CUSTOMERS.map((c) => c.phone));
    const demoInvoiceNumbers = new Set(['MK-20261024-0001', 'MK-20261025-0002']);
    const demoSupplierNames = new Set(SAMPLE_SUPPLIERS.map((s) => s.name));

    let purgedCount = 0;

    await db.transaction('rw', [
      db.products,
      db.customers,
      db.invoices,
      db.udharLedger,
      db.stockMovements,
      db.suppliers
    ], async () => {
      // 1. Purge Demo Products
      const allProducts = await db.products.toArray();
      const demoProdIds: number[] = [];
      for (const p of allProducts) {
        if (p.id && (demoBarcodes.has(p.barcode) || p.sku.startsWith('ATT-ASH') || p.sku.startsWith('OIL-FOR'))) {
          demoProdIds.push(p.id);
        }
      }
      if (demoProdIds.length > 0) {
        await db.products.bulkDelete(demoProdIds);
        purgedCount += demoProdIds.length;
      }

      // 2. Purge Demo Customers
      const allCustomers = await db.customers.toArray();
      const demoCustIds: number[] = [];
      for (const c of allCustomers) {
        if (c.id && demoCustomerPhones.has(c.phone)) {
          demoCustIds.push(c.id);
        }
      }
      if (demoCustIds.length > 0) {
        await db.customers.bulkDelete(demoCustIds);
        purgedCount += demoCustIds.length;
      }

      // 3. Purge Demo Invoices
      const allInvoices = await db.invoices.toArray();
      const demoInvIds: number[] = [];
      for (const inv of allInvoices) {
        if (inv.id && demoInvoiceNumbers.has(inv.invoiceNumber)) {
          demoInvIds.push(inv.id);
        }
      }
      if (demoInvIds.length > 0) {
        await db.invoices.bulkDelete(demoInvIds);
      }

      // 4. Purge Demo Udhar
      const allUdhar = await db.udharLedger.toArray();
      const demoUdharIds = allUdhar
        .filter((u) => u.id && u.invoiceNumber && demoInvoiceNumbers.has(u.invoiceNumber))
        .map((u) => u.id!);
      if (demoUdharIds.length > 0) {
        await db.udharLedger.bulkDelete(demoUdharIds);
      }

      // 5. Purge Demo Stock Movements
      const allMovements = await db.stockMovements.toArray();
      const demoMovIds = allMovements
        .filter((m) => m.id && m.reason === 'Initial store opening stock')
        .map((m) => m.id!);
      if (demoMovIds.length > 0) {
        await db.stockMovements.bulkDelete(demoMovIds);
      }

      // 6. Purge Demo Suppliers
      const allSuppliers = await db.suppliers.toArray();
      const demoSuppIds = allSuppliers
        .filter((s) => s.id && demoSupplierNames.has(s.name))
        .map((s) => s.id!);
      if (demoSuppIds.length > 0) {
        await db.suppliers.bulkDelete(demoSuppIds);
      }
    });

    localStorage.setItem('mohit_demo_purged_v1', 'true');
    return {
      purgedCount,
      message: 'All fake inventory and demo data removed successfully!'
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error purging demo data';
    return { purgedCount: 0, message: msg };
  }
}

export async function autoScanAndSyncData(): Promise<{
  success: boolean;
  productsCount: number;
  customersCount: number;
  invoicesCount: number;
  restoredFromSnapshot: boolean;
  message: string;
}> {
  try {
    const productsCount = await db.products.count();
    const customersCount = await db.customers.count();
    const invoicesCount = await db.invoices.count();

    const snapshotKey = 'mohit_kirana_offline_snapshot';
    const snapshotStr = localStorage.getItem(snapshotKey);

    // 1. If Dexie is completely empty but an offline snapshot exists in localStorage, restore it
    if (productsCount === 0 && customersCount === 0 && snapshotStr) {
      try {
        const parsed = JSON.parse(snapshotStr);
        if (parsed?.data?.products?.length) {
          const { data } = parsed;
          await db.transaction('rw', [
            db.products,
            db.customers,
            db.invoices,
            db.udharLedger,
            db.stockMovements,
            db.suppliers,
            db.purchases,
            db.storeSettings
          ], async () => {
            if (data.products?.length) await db.products.bulkAdd(data.products);
            if (data.customers?.length) await db.customers.bulkAdd(data.customers);
            if (data.invoices?.length) await db.invoices.bulkAdd(data.invoices);
            if (data.udharLedger?.length) await db.udharLedger.bulkAdd(data.udharLedger);
            if (data.stockMovements?.length) await db.stockMovements.bulkAdd(data.stockMovements);
            if (data.suppliers?.length) await db.suppliers.bulkAdd(data.suppliers);
            if (data.purchases?.length) await db.purchases.bulkAdd(data.purchases);
            if (data.storeSettings) {
              if (Array.isArray(data.storeSettings) && data.storeSettings.length) {
                await db.storeSettings.bulkPut(data.storeSettings);
              } else if (typeof data.storeSettings === 'object') {
                await db.storeSettings.put(data.storeSettings);
              }
            }
          });

          const newPCount = await db.products.count();
          const newCCount = await db.customers.count();
          const newICount = await db.invoices.count();

          return {
            success: true,
            productsCount: newPCount,
            customersCount: newCCount,
            invoicesCount: newICount,
            restoredFromSnapshot: true,
            message: `Restored ${newPCount} products and ${newCCount} parties from local snapshot.`
          };
        }
      } catch (e) {
        console.warn('Could not restore from snapshot:', e);
      }
    }

    // 2. If records exist, update local backup snapshot with current live database state
    if (productsCount > 0 || customersCount > 0 || invoicesCount > 0) {
      const currentBackup = await exportDatabaseBackup();
      localStorage.setItem(snapshotKey, currentBackup);
      localStorage.setItem('mohit_kirana_last_sync', new Date().toISOString());
    }

    return {
      success: true,
      productsCount,
      customersCount,
      invoicesCount,
      restoredFromSnapshot: false,
      message: `Verified: ${productsCount} products, ${customersCount} parties, ${invoicesCount} bills active.`
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error in data auto-sync';
    return {
      success: false,
      productsCount: 0,
      customersCount: 0,
      invoicesCount: 0,
      restoredFromSnapshot: false,
      message: msg
    };
  }
}

export async function initializeDatabase() {
  const settingsCount = await db.storeSettings.count();
  if (settingsCount === 0) {
    await db.storeSettings.put(DEFAULT_SETTINGS);
  }

  // Safe data verification on startup - NEVER clears or overwrites user data!
  await autoScanAndSyncData();
}

export async function seedDemoData() {
  await importDatabaseBackup(JSON.stringify(sampleBackupData));
}

export async function exportDatabaseBackup(): Promise<string> {
  const [
    products,
    customers,
    invoices,
    udharLedger,
    stockMovements,
    suppliers,
    purchases,
    storeSettings
  ] = await Promise.all([
    db.products.toArray(),
    db.customers.toArray(),
    db.invoices.toArray(),
    db.udharLedger.toArray(),
    db.stockMovements.toArray(),
    db.suppliers.toArray(),
    db.purchases.toArray(),
    db.storeSettings.toArray()
  ]);

  // Sanitize store settings to prevent leaking Supabase credentials or API keys in public backups
  const sanitizedStoreSettings = storeSettings.map((s) => ({
    ...s,
    supabaseUrl: '',
    supabaseAnonKey: '',
    supabaseEmail: '',
    geminiApiKey: ''
  }));

  const backupData = {
    appName: 'Mohit Kirana',
    version: '1.1.0',
    exportDate: new Date().toISOString(),
    data: {
      products,
      customers,
      invoices,
      udharLedger,
      stockMovements,
      suppliers,
      purchases,
      storeSettings: sanitizedStoreSettings
    }
  };

  return JSON.stringify(backupData, null, 2);
}

export async function importDatabaseBackup(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !parsed.data) {
      throw new Error('Invalid backup file structure: missing data root.');
    }

    const { data } = parsed;

    // Preserve existing local cloud & API credentials if backup file does not contain them
    const existingSettings = await db.storeSettings.get('main');

    await db.transaction('rw', [
      db.products,
      db.customers,
      db.invoices,
      db.udharLedger,
      db.stockMovements,
      db.suppliers,
      db.purchases,
      db.storeSettings
    ], async () => {
      await Promise.all([
        db.products.clear(),
        db.customers.clear(),
        db.invoices.clear(),
        db.udharLedger.clear(),
        db.stockMovements.clear(),
        db.suppliers.clear(),
        db.purchases.clear(),
        db.storeSettings.clear()
      ]);

      if (data.products?.length) await db.products.bulkAdd(data.products);
      if (data.customers?.length) await db.customers.bulkAdd(data.customers);
      if (data.invoices?.length) await db.invoices.bulkAdd(data.invoices);
      if (data.udharLedger?.length) await db.udharLedger.bulkAdd(data.udharLedger);
      if (data.stockMovements?.length) await db.stockMovements.bulkAdd(data.stockMovements);
      if (data.suppliers?.length) await db.suppliers.bulkAdd(data.suppliers);
      if (data.purchases?.length) await db.purchases.bulkAdd(data.purchases);
      if (data.storeSettings?.length) {
        const imported = data.storeSettings[0];
        const merged = {
          ...imported,
          supabaseUrl: imported.supabaseUrl || existingSettings?.supabaseUrl || '',
          supabaseAnonKey: imported.supabaseAnonKey || existingSettings?.supabaseAnonKey || '',
          supabaseEmail: imported.supabaseEmail || existingSettings?.supabaseEmail || '',
          geminiApiKey: imported.geminiApiKey || existingSettings?.geminiApiKey || ''
        };
        await db.storeSettings.put(merged);
      } else {
        await db.storeSettings.put(DEFAULT_SETTINGS);
      }
    });

    return {
      success: true,
      message: `Restored successfully: ${data.products?.length || 0} products, ${data.customers?.length || 0} customers, ${data.invoices?.length || 0} bills.`
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error during backup restore';
    return { success: false, message: msg };
  }
}
