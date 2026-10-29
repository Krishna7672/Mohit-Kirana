import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { triggerBackgroundCloudSync } from '../db/supabaseSync';
import type { Supplier, Purchase, PurchaseItem, Product, StoreSettings } from '../types';
import { formatINR, formatDate, formatDateTime } from '../utils/formatters';
import {
  Truck,
  Plus,
  Search,
  Building,
  Phone,
  FileText,
  DollarSign,
  Calendar,
  X,
  Trash2,
  CheckCircle2,
  Eye,
  AlertCircle
} from 'lucide-react';

interface Props {
  settings: StoreSettings;
}

export const PurchasesView: React.FC<Props> = () => {
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) || [];
  const purchases = useLiveQuery(() => db.purchases.reverse().toArray()) || [];
  const products = useLiveQuery(() => db.products.filter(p => !p.isArchived).toArray()) || [];

  const [activeTab, setActiveTab] = useState<'inward' | 'suppliers'>('inward');
  const [searchQuery, setSearchQuery] = useState('');

  // New Purchase (Stock Inward) Modal
  const [isNewInwardOpen, setIsNewInwardOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState('');
  const [inwardItems, setInwardItems] = useState<PurchaseItem[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending' | 'partial'>('paid');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [inwardNotes, setInwardNotes] = useState('');

  // Selected item to add to inward list
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [itemQuantity, setItemQuantity] = useState('10');
  const [itemCost, setItemCost] = useState('');

  // Supplier Add/Edit Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supGstin, setSupGstin] = useState('');

  // View Purchase Modal
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);

  // Add Item to current inward bill
  const handleAddItemToInward = () => {
    if (!selectedProductId) return;
    const prod = products.find((p) => p.id === Number(selectedProductId));
    if (!prod) return;

    const qty = parseFloat(itemQuantity);
    const cost = parseFloat(itemCost) || prod.purchasePrice;

    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }

    setInwardItems((prev) => [
      ...prev,
      {
        productId: prod.id!,
        productName: prod.name,
        unit: prod.unit,
        quantity: qty,
        costPrice: cost,
        total: qty * cost,
      },
    ]);

    setSelectedProductId('');
    setItemQuantity('10');
    setItemCost('');
  };

  const handleRemoveItem = (index: number) => {
    setInwardItems((prev) => prev.filter((_, i) => i !== index));
  };

  const inwardTotalCost = useMemo(() => {
    return inwardItems.reduce((sum, item) => sum + item.total, 0);
  }, [inwardItems]);

  // Complete Stock Inward
  const handleSaveStockInward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      alert('Please select a supplier.');
      return;
    }
    if (inwardItems.length === 0) {
      alert('Please add at least one item to inward stock.');
      return;
    }

    const supplier = suppliers.find((s) => s.id === Number(selectedSupplierId));
    if (!supplier) return;

    const now = new Date().toISOString();
    const invoiceNum = purchaseInvoiceNo.trim() || `PUR-${Date.now().toString().slice(-6)}`;
    const finalPaid = paymentStatus === 'paid' ? inwardTotalCost : parseFloat(paidAmount) || 0;

    // Atomic transaction: add purchase, update product stock, update supplier balance, record stock movement
    await db.transaction('rw', [
      db.purchases,
      db.products,
      db.stockMovements,
      db.suppliers,
    ], async () => {
      // 1. Add Purchase record
      await db.purchases.add({
        supplierId: supplier.id!,
        supplierName: supplier.name,
        purchaseInvoiceNo: invoiceNum,
        date: now,
        items: inwardItems,
        totalCost: inwardTotalCost,
        paymentStatus,
        paidAmount: finalPaid,
        notes: inwardNotes.trim(),
      });

      // 2. Increment product inventory stocks & audit trail
      for (const item of inwardItems) {
        const prod = await db.products.get(item.productId);
        if (prod) {
          const newQty = prod.stockQuantity + item.quantity;
          await db.products.update(prod.id!, {
            stockQuantity: newQty,
            purchasePrice: item.costPrice, // Update latest purchase cost
            updatedAt: now,
          });

          await db.stockMovements.add({
            productId: prod.id!,
            productName: prod.name,
            type: 'purchase',
            quantityChange: item.quantity,
            quantityAfter: newQty,
            referenceId: invoiceNum,
            reason: `Stock Inward from ${supplier.name} (Bill #${invoiceNum})`,
            date: now,
          });
        }
      }

      // 3. Update supplier total purchases & pending balance
      const pendingAdded = Math.max(0, inwardTotalCost - finalPaid);
      await db.suppliers.update(supplier.id!, {
        totalPurchases: (supplier.totalPurchases || 0) + inwardTotalCost,
        pendingBalance: (supplier.pendingBalance || 0) + pendingAdded,
      });
    });

    // Reset Form
    setIsNewInwardOpen(false);
    setSelectedSupplierId('');
    setPurchaseInvoiceNo('');
    setInwardItems([]);
    setPaidAmount('');
    setInwardNotes('');
    triggerBackgroundCloudSync();
    alert(`Stock inward successfully recorded! Stock quantities have been updated.`);
  };

  // Add Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) {
      alert('Supplier name is required');
      return;
    }

    const newSup: Omit<Supplier, 'id'> = {
      name: supName.trim(),
      phone: supPhone.trim(),
      address: supAddress.trim(),
      gstin: supGstin.trim(),
      totalPurchases: 0,
      pendingBalance: 0,
      createdAt: new Date().toISOString(),
    };

    await db.suppliers.add(newSup as Supplier);
    setIsSupplierModalOpen(false);
    setSupName('');
    setSupPhone('');
    setSupAddress('');
    setSupGstin('');
    triggerBackgroundCloudSync();
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-kirana-600" />
            Stock Inward & Supplier Management
          </h2>
          <p className="text-xs text-slate-500">
            Record wholesale purchase invoices, increase inventory stock automatically, track supplier balances
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSupplierModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
          >
            <Building className="w-4 h-4 text-slate-500" />
            <span>Add Supplier</span>
          </button>

          <button
            onClick={() => setIsNewInwardOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-kirana-700 hover:bg-kirana-800 text-white rounded-xl text-xs font-bold shadow-md shadow-kirana-700/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Stock Inward</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('inward')}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === 'inward'
              ? 'bg-kirana-700 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          Purchase Bills ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === 'suppliers'
              ? 'bg-kirana-700 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100'
          }`}
        >
          Suppliers Directory ({suppliers.length})
        </button>
      </div>

      {/* Inward Purchases Tab */}
      {activeTab === 'inward' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {purchases.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No stock purchases recorded yet. Click &ldquo;New Stock Inward&rdquo; to add wholesale purchases.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Items Received</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4 text-right">Total Cost</th>
                    <th className="py-3 px-4 text-center">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {purchases.map((pur) => (
                    <tr
                      key={pur.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {pur.purchaseInvoiceNo}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {formatDate(pur.date)}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {pur.supplierName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {pur.items.length} items
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                            pur.paymentStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {pur.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                        {formatINR(pur.totalCost)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setViewingPurchase(pur)}
                          className="p-1.5 text-kirana-700 hover:bg-kirana-50 rounded-lg transition-colors"
                          title="View Inward Items"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Suppliers Tab */}
      {activeTab === 'suppliers' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {suppliers.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No suppliers registered yet. Click &ldquo;Add Supplier&rdquo; to create wholesale distributors.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Supplier Name</th>
                    <th className="py-3 px-4">Contact Phone</th>
                    <th className="py-3 px-4">Address / Godown</th>
                    <th className="py-3 px-4">GSTIN</th>
                    <th className="py-3 px-4 text-right">Lifetime Purchases</th>
                    <th className="py-3 px-4 text-right">Pending Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {suppliers.map((sup) => (
                    <tr
                      key={sup.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {sup.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">
                        {sup.phone || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-[200px] truncate">
                        {sup.address || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 text-[10px]">
                        {sup.gstin || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                        {formatINR(sup.totalPurchases || 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-red-600">
                        {formatINR(sup.pendingBalance || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* New Stock Inward Modal */}
      {isNewInwardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full my-8 overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] text-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-kirana-50 dark:bg-kirana-950/40 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Truck className="w-4 h-4 text-kirana-700" />
                Record Stock Inward (Wholesale Purchase)
              </h3>
              <button
                onClick={() => setIsNewInwardOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStockInward} className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Supplier *</label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Supplier Invoice / Bill No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9842"
                    value={purchaseInvoiceNo}
                    onChange={(e) => setPurchaseInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Add Items to Inward Subform */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">
                  Add Product to Purchase Bill:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-6">
                    <select
                      value={selectedProductId}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : '';
                        setSelectedProductId(id);
                        if (id) {
                          const p = products.find((pr) => pr.id === id);
                          if (p) setItemCost(p.purchasePrice.toString());
                        }
                      }}
                      className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                    >
                      <option value="">Select Product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      placeholder="Qty"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 font-bold"
                    />
                  </div>

                  <div className="sm:col-span-3 flex gap-1">
                    <input
                      type="number"
                      step="any"
                      placeholder="Cost (₹)"
                      value={itemCost}
                      onChange={(e) => setItemCost(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                    />
                    <button
                      type="button"
                      onClick={handleAddItemToInward}
                      disabled={!selectedProductId}
                      className="px-3 py-1.5 bg-kirana-700 hover:bg-kirana-800 text-white rounded-lg font-bold disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Added Items List */}
              <div className="space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">
                  Items in this Inward ({inwardItems.length})
                </span>
                {inwardItems.length === 0 ? (
                  <p className="text-slate-400 py-3 text-center italic">No items added yet.</p>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {inwardItems.map((item, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between bg-white dark:bg-slate-800">
                        <div>
                          <span className="font-bold text-slate-800 dark:text-white">
                            {item.productName}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-2">
                            {item.quantity} {item.unit} @ {formatINR(item.costPrice)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 dark:text-white">
                            {formatINR(item.total)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
                  >
                    <option value="paid">Fully Paid</option>
                    <option value="partial">Partially Paid</option>
                    <option value="pending">Payment Pending (Supplier Credit)</option>
                  </select>
                </div>

                {paymentStatus === 'partial' && (
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Amount Paid Now (₹)
                    </label>
                    <input
                      type="number"
                      max={inwardTotalCost}
                      placeholder="e.g. 5000"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t font-black text-sm">
                <span>Total Inward Cost:</span>
                <span className="text-kirana-800 dark:text-kirana-400">
                  {formatINR(inwardTotalCost)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewInwardOpen(false)}
                  className="px-4 py-2 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inwardItems.length === 0}
                  className="px-5 py-2 bg-kirana-700 hover:bg-kirana-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-md"
                >
                  Confirm Inward & Increase Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Add New Supplier</h3>
              <button onClick={() => setIsSupplierModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Supplier / Firm Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Delhi Grain Traders"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Contact Phone</label>
                <input
                  type="tel"
                  placeholder="e.g. 9810012345"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Address / Wholesale Mandi</label>
                <input
                  type="text"
                  placeholder="e.g. Naya Bazar, Chandni Chowk"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">GSTIN</label>
                <input
                  type="text"
                  placeholder="e.g. 07AAACD1234F1Z9"
                  value={supGstin}
                  onChange={(e) => setSupGstin(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-kirana-700 text-white font-bold rounded-xl shadow-md"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Inward Modal */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-5 border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Inward Bill: {viewingPurchase.purchaseInvoiceNo}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Supplier: {viewingPurchase.supplierName} • {formatDate(viewingPurchase.date)}
                </p>
              </div>
              <button onClick={() => setViewingPurchase(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
              {viewingPurchase.items.map((it, idx) => (
                <div key={idx} className="py-2 flex justify-between">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white">{it.productName}</span>
                    <span className="text-[10px] text-slate-400 block">{it.quantity} {it.unit}</span>
                  </div>
                  <span className="font-black text-slate-900 dark:text-white">
                    {formatINR(it.total)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t flex justify-between font-black text-sm">
              <span>Total Bill Cost:</span>
              <span>{formatINR(viewingPurchase.totalCost)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
