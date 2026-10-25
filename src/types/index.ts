export type UnitType = 'kg' | 'g' | 'litre' | 'ml' | 'packet' | 'piece' | 'dozen' | 'box' | 'bottle' | 'carton';

export type PaymentMethod = 'cash' | 'upi' | 'split' | 'udhar';

export interface Product {
  id?: number;
  name: string;
  category: string;
  brand: string;
  sku: string;
  barcode: string;
  unit: UnitType;
  purchasePrice: number;
  sellingPrice: number;
  stockQuantity: number;
  minStockThreshold: number;
  supplierId?: number;
  supplierName?: string;
  expiryDate?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  address?: string;
  registrationDate: string;
  purchaseCount: number;
  totalSpending: number;
  lastPurchaseDate?: string;
  outstandingUdhar: number;
  communicationConsent: boolean;
  notes?: string;
  updatedAt: string;
}

export interface InvoiceItem {
  productId: number;
  name: string;
  unit: UnitType;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  discount: number;
  total: number;
}

export interface Invoice {
  id?: number;
  invoiceNumber: string;
  date: string;
  customerId?: number | null;
  customerName: string;
  customerPhone: string;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  costAmount: number;
  profit: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  udharAmount: number;
  status: 'completed' | 'refunded' | 'cancelled';
  notes?: string;
  createdAt: string;
}

export interface UdharEntry {
  id?: number;
  customerId: number;
  customerName: string;
  customerPhone: string;
  invoiceId?: number;
  invoiceNumber?: string;
  type: 'credit_sale' | 'repayment' | 'adjustment';
  amount: number;
  balanceAfter: number;
  paymentMethod?: 'cash' | 'upi';
  notes?: string;
  date: string;
}

export interface StockMovement {
  id?: number;
  productId: number;
  productName: string;
  type: 'sale' | 'purchase' | 'manual_in' | 'manual_out' | 'refund_restock' | 'damage';
  quantityChange: number;
  quantityAfter: number;
  referenceId?: string;
  reason: string;
  date: string;
}

export interface Supplier {
  id?: number;
  name: string;
  phone: string;
  address?: string;
  gstin?: string;
  totalPurchases: number;
  pendingBalance: number;
  createdAt: string;
}

export interface PurchaseItem {
  productId: number;
  productName: string;
  unit: UnitType;
  quantity: number;
  costPrice: number;
  total: number;
}

export interface Purchase {
  id?: number;
  supplierId: number;
  supplierName: string;
  purchaseInvoiceNo: string;
  date: string;
  items: PurchaseItem[];
  totalCost: number;
  paymentStatus: 'paid' | 'pending' | 'partial';
  paidAmount: number;
  notes?: string;
}

export interface StoreSettings {
  id: string; // 'main'
  shopName: string;
  tagline: string;
  ownerName: string;
  phone: string;
  address: string;
  gstin: string;
  upiId: string;
  receiptFooter: string;
  thermalWidth: '58mm' | '80mm';
  ownerPin: string;
  pinEnabled: boolean;
  currencySymbol: string;
  lastBackupDate?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}
