import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Product, UnitType, StockMovement, StoreSettings } from '../types';
import { formatINR, formatDate } from '../utils/formatters';
import { exportProductsCSV, parseProductsCSV } from '../utils/csv';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import {
  Package,
  Plus,
  Search,
  Camera,
  Download,
  Upload,
  AlertTriangle,
  History,
  Edit2,
  Archive,
  RotateCcw,
  SlidersHorizontal,
  X,
  Check,
  Calendar,
  Layers,
  ArrowUpDown
} from 'lucide-react';

interface Props {
  settings: StoreSettings;
  openNewProductModalOnMount?: boolean;
}

export const InventoryView: React.FC<Props> = ({ settings, openNewProductModalOnMount }) => {
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const stockMovements = useLiveQuery(() => db.stockMovements.reverse().limit(50).toArray()) || [];

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'out' | 'expiring' | 'archived'>('all');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(openNewProductModalOnMount || false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Form state for Add/Edit Product
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formUnit, setFormUnit] = useState<UnitType>('packet');
  const [formPurchasePrice, setFormPurchasePrice] = useState<string>('');
  const [formSellingPrice, setFormSellingPrice] = useState<string>('');
  const [formStockQuantity, setFormStockQuantity] = useState<string>('');
  const [formMinThreshold, setFormMinThreshold] = useState<string>('5');
  const [formSupplierName, setFormSupplierName] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');

  // Stock Adjustment form state
  const [adjustType, setAdjustType] = useState<'manual_in' | 'manual_out' | 'damage'>('manual_in');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // CSV Import file input ref
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Pre-fill edit modal
  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormBrand(p.brand);
    setFormSku(p.sku);
    setFormBarcode(p.barcode);
    setFormUnit(p.unit);
    setFormPurchasePrice(p.purchasePrice.toString());
    setFormSellingPrice(p.sellingPrice.toString());
    setFormStockQuantity(p.stockQuantity.toString());
    setFormMinThreshold(p.minStockThreshold.toString());
    setFormSupplierName(p.supplierName || '');
    setFormExpiryDate(p.expiryDate || '');
    setIsAddEditOpen(true);
  };

  const openNewModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCategory('');
    setFormBrand('');
    setFormSku(`SKU-${Date.now().toString().slice(-6)}`);
    setFormBarcode('');
    setFormUnit('packet');
    setFormPurchasePrice('');
    setFormSellingPrice('');
    setFormStockQuantity('10');
    setFormMinThreshold('5');
    setFormSupplierName('');
    setFormExpiryDate('');
    setIsAddEditOpen(true);
  };

  // Save product (Add or Update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Product name is required');
      return;
    }

    const purchasePrice = parseFloat(formPurchasePrice) || 0;
    const sellingPrice = parseFloat(formSellingPrice) || 0;
    const stockQty = parseFloat(formStockQuantity) || 0;
    const minThreshold = parseFloat(formMinThreshold) || 5;
    const now = new Date().toISOString();

    if (editingProduct && editingProduct.id) {
      // Update
      const prevQty = editingProduct.stockQuantity;
      await db.products.update(editingProduct.id, {
        name: formName.trim(),
        category: formCategory.trim() || 'General',
        brand: formBrand.trim(),
        sku: formSku.trim() || editingProduct.sku,
        barcode: formBarcode.trim(),
        unit: formUnit,
        purchasePrice,
        sellingPrice,
        stockQuantity: stockQty,
        minStockThreshold: minThreshold,
        supplierName: formSupplierName.trim(),
        expiryDate: formExpiryDate.trim(),
        updatedAt: now,
      });

      // Record movement if quantity manually updated
      if (prevQty !== stockQty) {
        await db.stockMovements.add({
          productId: editingProduct.id,
          productName: formName.trim(),
          type: stockQty > prevQty ? 'manual_in' : 'manual_out',
          quantityChange: stockQty - prevQty,
          quantityAfter: stockQty,
          reason: 'Manual stock adjustment during product edit',
          date: now,
        });
      }
    } else {
      // Create new
      const newProduct: Omit<Product, 'id'> = {
        name: formName.trim(),
        category: formCategory.trim() || 'General',
        brand: formBrand.trim(),
        sku: formSku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
        barcode: formBarcode.trim(),
        unit: formUnit,
        purchasePrice,
        sellingPrice,
        stockQuantity: stockQty,
        minStockThreshold: minThreshold,
        supplierName: formSupplierName.trim(),
        expiryDate: formExpiryDate.trim(),
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      };

      const id = await db.products.add(newProduct as Product);
      if (stockQty > 0) {
        await db.stockMovements.add({
          productId: id,
          productName: formName.trim(),
          type: 'manual_in',
          quantityChange: stockQty,
          quantityAfter: stockQty,
          reason: 'Opening stock for newly added product',
          date: now,
        });
      }
    }

    setIsAddEditOpen(false);
  };

  // Toggle archive
  const handleToggleArchive = async (product: Product) => {
    if (!product.id) return;
    const newStatus = !product.isArchived;
    await db.products.update(product.id, {
      isArchived: newStatus,
      updatedAt: new Date().toISOString(),
    });
  };

  // Save stock adjustment
  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct?.id) return;

    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid positive quantity.');
      return;
    }

    const currentStock = adjustingProduct.stockQuantity;
    let newStock = currentStock;
    let change = 0;

    if (adjustType === 'manual_in') {
      newStock = currentStock + qty;
      change = qty;
    } else {
      if (qty > currentStock) {
        alert(`Cannot reduce more than current stock (${currentStock} ${adjustingProduct.unit}).`);
        return;
      }
      newStock = currentStock - qty;
      change = -qty;
    }

    const now = new Date().toISOString();
    await db.products.update(adjustingProduct.id, {
      stockQuantity: newStock,
      updatedAt: now,
    });

    await db.stockMovements.add({
      productId: adjustingProduct.id,
      productName: adjustingProduct.name,
      type: adjustType,
      quantityChange: change,
      quantityAfter: newStock,
      reason: adjustReason.trim() || `Manual ${adjustType.replace('_', ' ')}`,
      date: now,
    });

    setIsAdjustStockOpen(false);
    setAdjustQty('');
    setAdjustReason('');
    setAdjustingProduct(null);
  };

  // CSV Import handler
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    parseProductsCSV(file, async (importedProducts, errors) => {
      if (errors.length > 0) {
        alert(`CSV Import warnings/errors:\n${errors.slice(0, 5).join('\n')}`);
      }

      if (importedProducts.length > 0) {
        try {
          await db.products.bulkAdd(importedProducts as Product[]);
          alert(`Successfully imported ${importedProducts.length} products!`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Error importing CSV';
          alert(`Failed to save imported products: ${msg}`);
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  // Barcode scanned from camera in inventory
  const handleBarcodeScanned = (code: string) => {
    setSearchQuery(code);
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [products]);

  // Inventory valuation calculations
  const valuation = useMemo(() => {
    const active = products.filter((p) => !p.isArchived);
    const totalCostValue = active.reduce(
      (sum, p) => sum + p.stockQuantity * p.purchasePrice,
      0
    );
    const totalRetailValue = active.reduce(
      (sum, p) => sum + p.stockQuantity * p.sellingPrice,
      0
    );
    const estimatedMargin = totalRetailValue - totalCostValue;

    return {
      activeCount: active.length,
      totalCostValue,
      totalRetailValue,
      estimatedMargin,
      marginPercent:
        totalRetailValue > 0 ? (estimatedMargin / totalRetailValue) * 100 : 0,
    };
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const today = new Date();
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(today.getDate() + 30);

    return products.filter((p) => {
      // Category filter
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;

      // Status filter
      if (stockStatusFilter === 'archived') {
        if (!p.isArchived) return false;
      } else {
        if (p.isArchived) return false;
        if (stockStatusFilter === 'low' && (p.stockQuantity <= 0 || p.stockQuantity > p.minStockThreshold)) {
          return false;
        }
        if (stockStatusFilter === 'out' && p.stockQuantity > 0) {
          return false;
        }
        if (stockStatusFilter === 'expiring') {
          if (!p.expiryDate) return false;
          const exp = new Date(p.expiryDate);
          if (isNaN(exp.getTime()) || exp > thirtyDaysAhead) return false;
        }
      }

      // Query filter
      if (q) {
        const matchName = p.name.toLowerCase().includes(q);
        const matchBrand = p.brand.toLowerCase().includes(q);
        const matchBarcode = p.barcode.includes(q);
        const matchSku = p.sku.toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchBarcode && !matchSku) return false;
      }

      return true;
    });
  }, [products, searchQuery, categoryFilter, stockStatusFilter]);

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Header and Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-kirana-600" />
            Inventory & Stock Management
          </h2>
          <p className="text-xs text-slate-500">
            Track grocery products, categories, purchase prices, stock adjustments and expiry dates
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Stock History Button */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>Audit Log</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={() => exportProductsCSV(products)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
            title="Export products to CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Import CSV Hidden Input & Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleCSVImport}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
            title="Import products from CSV"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Import CSV</span>
          </button>

          {/* Add Product Button */}
          <button
            onClick={openNewModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-kirana-700 hover:bg-kirana-800 text-white rounded-xl text-xs font-bold shadow-md shadow-kirana-700/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Inventory Valuation Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Active Items</span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {valuation.activeCount} <span className="text-xs font-normal text-slate-400">SKUs</span>
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Stock Cost Value</span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {formatINR(valuation.totalCostValue)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Stock Retail Value (MRP)</span>
          <p className="text-xl font-black text-kirana-700 dark:text-kirana-400 mt-1">
            {formatINR(valuation.totalRetailValue)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Expected Gross Profit</span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatINR(valuation.estimatedMargin)}{' '}
            <span className="text-xs font-bold text-emerald-700">
              ({valuation.marginPercent.toFixed(1)}%)
            </span>
          </p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search products by name, brand, SKU or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-kirana-500 text-slate-800 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Barcode scanner button */}
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-kirana-50 dark:bg-kirana-950/40 text-kirana-700 dark:text-kirana-300 border border-kirana-200 dark:border-kirana-800/80 rounded-xl text-xs font-bold shrink-0 hover:bg-kirana-100 transition-colors"
          >
            <Camera className="w-4 h-4" />
            <span>Scan to Find</span>
          </button>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                Category: {c}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Status Tabs */}
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold pt-1 border-t border-slate-100 dark:border-slate-700">
          {[
            { id: 'all', label: 'All Products' },
            { id: 'low', label: 'Low Stock' },
            { id: 'out', label: 'Out of Stock' },
            { id: 'expiring', label: 'Expiring Soon (30d)' },
            { id: 'archived', label: 'Archived' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStockStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                stockStatusFilter === tab.id
                  ? 'bg-kirana-700 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No products found matching the criteria.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Item & Brand</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Barcode / SKU</th>
                  <th className="py-3 px-4 text-right">Cost Price</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  <th className="py-3 px-4 text-center">Current Stock</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredProducts.map((product) => {
                  const isOutOfStock = product.stockQuantity <= 0;
                  const isLowStock =
                    product.stockQuantity > 0 &&
                    product.stockQuantity <= product.minStockThreshold;

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors ${
                        product.isArchived ? 'opacity-60 bg-slate-50 dark:bg-slate-900/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {product.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {product.brand ? `Brand: ${product.brand}` : 'Unbranded'}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-medium">
                          {product.category}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                        {product.barcode ? (
                          <div>{product.barcode}</div>
                        ) : (
                          <span className="text-[10px] text-slate-400">No barcode</span>
                        )}
                        <span className="text-[10px] text-slate-400 block">{product.sku}</span>
                      </td>

                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300 font-medium">
                        {formatINR(product.purchasePrice)}
                      </td>

                      <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                        {formatINR(product.sellingPrice)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-black text-xs ${
                              isOutOfStock
                                ? 'bg-red-100 text-red-800'
                                : isLowStock
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {product.stockQuantity} {product.unit}
                          </span>
                          <button
                            onClick={() => {
                              setAdjustingProduct(product);
                              setIsAdjustStockOpen(true);
                            }}
                            title="Adjust Stock"
                            className="p-1 text-slate-400 hover:text-kirana-700 hover:bg-slate-100 rounded"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {product.expiryDate ? formatDate(product.expiryDate) : '—'}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-1.5 text-slate-600 hover:text-kirana-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Product"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleArchive(product)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            product.isArchived
                              ? 'text-emerald-600 hover:bg-emerald-50'
                              : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={product.isArchived ? 'Restore Product' : 'Archive Product'}
                        >
                          {product.isArchived ? (
                            <RotateCcw className="w-3.5 h-3.5" />
                          ) : (
                            <Archive className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-xl w-full my-8 overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-kirana-50 dark:bg-kirana-950/40">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-kirana-700" />
                {editingProduct ? 'Edit Grocery Product' : 'Add New Grocery Product'}
              </h3>
              <button
                onClick={() => setIsAddEditOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aashirvaad Shudh Chakki Atta"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Category</label>
                  <input
                    type="text"
                    list="category-suggestions"
                    placeholder="e.g. Atta & Flours"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                  <datalist id="category-suggestions">
                    <option value="Atta & Flours" />
                    <option value="Edible Oils & Ghee" />
                    <option value="Pulses & Dals" />
                    <option value="Grains & Sugar" />
                    <option value="Spices & Seasonings" />
                    <option value="Snacks & Biscuits" />
                    <option value="Dairy & Bakery" />
                    <option value="Cleaning & Household" />
                    <option value="Personal Care" />
                    <option value="Beverages & Tea" />
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. Aashirvaad, Fortune, Amul"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Unit Type</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value as UnitType)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="packet">packet</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="litre">litre</option>
                    <option value="ml">ml</option>
                    <option value="piece">piece</option>
                    <option value="dozen">dozen</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Purchase Price (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 380"
                    value={formPurchasePrice}
                    onChange={(e) => setFormPurchasePrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 425"
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Current Stock Quantity
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formStockQuantity}
                    onChange={(e) => setFormStockQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    value={formMinThreshold}
                    onChange={(e) => setFormMinThreshold(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Barcode</label>
                  <input
                    type="text"
                    placeholder="Scan or enter barcode"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">SKU Code</label>
                  <input
                    type="text"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Supplier Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Delhi Grain Traders"
                    value={formSupplierName}
                    onChange={(e) => setFormSupplierName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Expiry Date</label>
                  <input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-4 py-2 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-kirana-700 hover:bg-kirana-800 text-white font-bold rounded-xl shadow-md"
                >
                  {editingProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Stock Adjustment Modal */}
      {isAdjustStockOpen && adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Adjust Stock: {adjustingProduct.name}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Current Stock: <strong>{adjustingProduct.stockQuantity} {adjustingProduct.unit}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsAdjustStockOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStockAdjustment} className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Adjustment Type</label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
                >
                  <option value="manual_in">Stock Inward (Add +)</option>
                  <option value="manual_out">Stock Outward (Subtract -)</option>
                  <option value="damage">Damage / Expired / Shrinkage (Subtract -)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Quantity ({adjustingProduct.unit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  placeholder="e.g. 5"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Reason / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Physical inventory count correction"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustStockOpen(false)}
                  className="px-4 py-2 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-kirana-700 text-white font-bold rounded-xl shadow-md"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Movement Audit Log Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full my-8 border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-kirana-700" />
                Stock Movement Audit Trail (Last 50 changes)
              </h3>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Event Type</th>
                    <th className="py-2.5 px-3 text-right">Change</th>
                    <th className="py-2.5 px-3 text-right">Balance</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {stockMovements.map((mov) => (
                    <tr key={mov.id}>
                      <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                        {formatDate(mov.date)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800 dark:text-white">
                        {mov.productName}
                      </td>
                      <td className="py-2 px-3">
                        <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {mov.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className={`py-2 px-3 text-right font-bold ${
                        mov.quantityChange > 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}>
                        {mov.quantityChange > 0 ? `+${mov.quantityChange}` : mov.quantityChange}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {mov.quantityAfter}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {mov.reason || mov.referenceId || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Camera Scanner */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
      />
    </div>
  );
};
