import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import confetti from 'canvas-confetti';
import { db } from '../db';
import type {
  Product,
  Customer,
  CartItem,
  Invoice,
  PaymentMethod,
  StoreSettings
} from '../types';
import {
  formatINR,
  generateInvoiceNumber,
  formatDate
} from '../utils/formatters';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import {
  Search,
  Camera,
  Trash2,
  Plus,
  Minus,
  UserCheck,
  UserPlus,
  ShoppingCart,
  CreditCard,
  Banknote,
  QrCode,
  RotateCcw,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Percent,
  Receipt,
  X
} from 'lucide-react';

interface Props {
  settings: StoreSettings;
  onOpenReceipt: (invoice: Invoice) => void;
  preselectedCustomerId?: number | null;
}

export const POSBillingView: React.FC<Props> = ({
  onOpenReceipt,
  preselectedCustomerId
}) => {
  // Live products & customers from Dexie
  const products = useLiveQuery(() => db.products.filter(p => !p.isArchived).toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Store discount
  const [overallDiscount, setOverallDiscount] = useState<number>(0);

  // Payment details
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [splitPaidAmount, setSplitPaidAmount] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Checkout state lock
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Customer's last invoice for Repeat Previous Bill
  const [lastCustomerInvoice, setLastCustomerInvoice] = useState<Invoice | null>(null);

  // Auto-select preselected customer if provided
  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0) {
      const match = customers.find((c) => c.id === preselectedCustomerId);
      if (match) setSelectedCustomer(match);
    }
  }, [preselectedCustomerId, customers]);

  // Load previous bill when customer changes
  useEffect(() => {
    if (selectedCustomer?.id) {
      db.invoices
        .where('customerId')
        .equals(selectedCustomer.id)
        .reverse()
        .first()
        .then((inv) => setLastCustomerInvoice(inv || null));
    } else {
      setLastCustomerInvoice(null);
    }
  }, [selectedCustomer]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [products, searchQuery, selectedCategory]);

  // Customer search suggestions
  const customerSuggestions = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const q = customerSearch.toLowerCase().trim();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    ).slice(0, 5);
  }, [customers, customerSearch]);

  // Add product to cart
  const addToCart = (product: Product, qtyToAdd: number = 1) => {
    if (product.stockQuantity <= 0) {
      alert(`"${product.name}" is currently out of stock!`);
      return;
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const item = prevCart[existingIndex];
        const newQty = item.quantity + qtyToAdd;
        if (newQty > product.stockQuantity) {
          alert(`Cannot add more than available stock (${product.stockQuantity} ${product.unit}).`);
          return prevCart;
        }
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...item,
          quantity: newQty,
          total: (newQty * item.unitPrice) - item.discount,
        };
        return updated;
      } else {
        const initialQty = Math.min(qtyToAdd, product.stockQuantity);
        return [
          ...prevCart,
          {
            product,
            quantity: initialQty,
            unitPrice: product.sellingPrice,
            discount: 0,
            total: initialQty * product.sellingPrice,
          },
        ];
      }
    });
  };

  // Modify quantity in cart
  const updateQuantity = (productId: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          if (newQty > item.product.stockQuantity) {
            alert(`Stock limit reached! Only ${item.product.stockQuantity} ${item.product.unit} available.`);
            return item;
          }
          return {
            ...item,
            quantity: newQty,
            total: (newQty * item.unitPrice) - item.discount,
          };
        }
        return item;
      })
    );
  };

  // Remove item from cart
  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Barcode scanned handler
  const handleBarcodeScanned = (code: string) => {
    const match = products.find(
      (p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase()
    );
    if (match) {
      addToCart(match, 1);
      setNotification({
        type: 'success',
        message: `Added "${match.name}" to cart via barcode scan!`,
      });
      setTimeout(() => setNotification(null), 2500);
    } else {
      alert(`No product found with barcode: "${code}". You can add it in Inventory.`);
    }
  };

  // Repeat Previous Bill handler
  const handleRepeatPreviousBill = () => {
    if (!lastCustomerInvoice) return;
    const itemsToAdd: CartItem[] = [];
    const unavailable: string[] = [];

    lastCustomerInvoice.items.forEach((prevItem) => {
      const currentProduct = products.find((p) => p.id === prevItem.productId);
      if (currentProduct && currentProduct.stockQuantity > 0) {
        const qty = Math.min(prevItem.quantity, currentProduct.stockQuantity);
        itemsToAdd.push({
          product: currentProduct,
          quantity: qty,
          unitPrice: currentProduct.sellingPrice,
          discount: 0,
          total: qty * currentProduct.sellingPrice,
        });
      } else {
        unavailable.push(prevItem.name);
      }
    });

    if (itemsToAdd.length > 0) {
      setCart(itemsToAdd);
      if (unavailable.length > 0) {
        alert(
          `Loaded ${itemsToAdd.length} items from previous bill.\nNotice: ${unavailable.join(', ')} is out of stock and was skipped.`
        );
      }
    } else {
      alert('None of the items from the previous bill are currently in stock.');
    }
  };

  // Quick inline customer creation
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      alert('Please enter customer name and phone number.');
      return;
    }

    const cleanPhone = newCustPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      alert('Please enter a valid 10-digit Indian phone number.');
      return;
    }

    const existing = await db.customers.where('phone').equals(cleanPhone).first();
    if (existing) {
      alert(`Customer with phone number ${cleanPhone} already exists: ${existing.name}`);
      setSelectedCustomer(existing);
      setIsCreatingCustomer(false);
      return;
    }

    const newCust: Omit<Customer, 'id'> = {
      name: newCustName.trim(),
      phone: cleanPhone,
      address: newCustAddress.trim(),
      registrationDate: new Date().toISOString(),
      purchaseCount: 0,
      totalSpending: 0,
      outstandingUdhar: 0,
      communicationConsent: true,
      updatedAt: new Date().toISOString(),
    };

    const id = await db.customers.add(newCust as Customer);
    const created = await db.customers.get(id);
    if (created) {
      setSelectedCustomer(created);
      setIsCreatingCustomer(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNotification({
        type: 'success',
        message: `Registered new customer: ${created.name}`,
      });
      setTimeout(() => setNotification(null), 2500);
    }
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  }, [cart]);

  const grandTotal = Math.max(0, subtotal - overallDiscount);

  // Total cost amount for profit calculation
  const totalCost = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + item.quantity * item.product.purchasePrice,
      0
    );
  }, [cart]);

  const estimatedProfit = Math.max(0, grandTotal - totalCost);

  // Payment Breakdown
  const { paidAmount, udharAmount } = useMemo(() => {
    if (paymentMethod === 'udhar') {
      return { paidAmount: 0, udharAmount: grandTotal };
    }
    if (paymentMethod === 'split') {
      const splitPaid = parseFloat(splitPaidAmount) || 0;
      const safePaid = Math.min(splitPaid, grandTotal);
      return { paidAmount: safePaid, udharAmount: grandTotal - safePaid };
    }
    return { paidAmount: grandTotal, udharAmount: 0 };
  }, [paymentMethod, grandTotal, splitPaidAmount]);

  // Cash change calculation
  const changeDue = useMemo(() => {
    if (paymentMethod !== 'cash') return 0;
    const tendered = parseFloat(cashTendered) || 0;
    return Math.max(0, tendered - grandTotal);
  }, [paymentMethod, cashTendered, grandTotal]);

  // COMPLETE CHECKOUT TRANSACTION
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Add grocery items before checkout.');
      return;
    }

    if (udharAmount > 0 && !selectedCustomer) {
      alert('Credit (Udhar) sale requires selecting or adding a customer to record to their khata.');
      return;
    }

    if (isProcessingCheckout) return;

    try {
      setIsProcessingCheckout(true);

      const invoiceNumber = generateInvoiceNumber();
      const now = new Date().toISOString();

      // Check current stock availability one more time to avoid overselling
      for (const item of cart) {
        const fresh = await db.products.get(item.product.id!);
        if (!fresh || fresh.stockQuantity < item.quantity) {
          throw new Error(
            `Stock mismatch for ${item.product.name}. Available: ${fresh ? fresh.stockQuantity : 0}`
          );
        }
      }

      // Execute atomic transaction across all related tables
      await db.transaction('rw', [
        db.invoices,
        db.products,
        db.stockMovements,
        db.customers,
        db.udharLedger,
      ], async () => {
        // 1. Create Invoice Record
        const invoiceData: Omit<Invoice, 'id'> = {
          invoiceNumber,
          date: now,
          customerId: selectedCustomer?.id || null,
          customerName: selectedCustomer?.name || 'Walk-in Customer',
          customerPhone: selectedCustomer?.phone || '',
          items: cart.map((c) => ({
            productId: c.product.id!,
            name: c.product.name,
            unit: c.product.unit,
            quantity: c.quantity,
            purchasePrice: c.product.purchasePrice,
            sellingPrice: c.unitPrice,
            discount: c.discount,
            total: c.total,
          })),
          subtotal,
          discountAmount: overallDiscount,
          totalAmount: grandTotal,
          costAmount: totalCost,
          profit: estimatedProfit,
          paymentMethod,
          paidAmount,
          udharAmount,
          status: 'completed',
          notes: notes.trim(),
          createdAt: now,
        };

        const invoiceId = await db.invoices.add(invoiceData as Invoice);

        // 2. Deduct Stock & Record Audit Movement
        for (const item of cart) {
          const fresh = await db.products.get(item.product.id!);
          if (fresh) {
            const newStock = Math.max(0, fresh.stockQuantity - item.quantity);
            await db.products.update(fresh.id!, {
              stockQuantity: newStock,
              updatedAt: now,
            });

            await db.stockMovements.add({
              productId: fresh.id!,
              productName: fresh.name,
              type: 'sale',
              quantityChange: -item.quantity,
              quantityAfter: newStock,
              referenceId: invoiceNumber,
              reason: `Sold in Bill #${invoiceNumber}`,
              date: now,
            });
          }
        }

        // 3. Update Customer History & Udhar
        if (selectedCustomer?.id) {
          const freshCust = await db.customers.get(selectedCustomer.id);
          if (freshCust) {
            const newCount = freshCust.purchaseCount + 1;
            const newTotalSpend = freshCust.totalSpending + grandTotal;
            const newUdhar = freshCust.outstandingUdhar + udharAmount;

            await db.customers.update(freshCust.id!, {
              purchaseCount: newCount,
              totalSpending: newTotalSpend,
              lastPurchaseDate: now,
              outstandingUdhar: newUdhar,
              updatedAt: now,
            });

            // 4. Udhar Ledger entry if any credit
            if (udharAmount > 0) {
              await db.udharLedger.add({
                customerId: freshCust.id!,
                customerName: freshCust.name,
                customerPhone: freshCust.phone,
                invoiceId,
                invoiceNumber,
                type: 'credit_sale',
                amount: udharAmount,
                balanceAfter: newUdhar,
                notes: `Credit from bill #${invoiceNumber}`,
                date: now,
              });
            }
          }
        }

        // 5. Return saved invoice for immediate receipt
        const savedInvoice = await db.invoices.get(invoiceId);
        if (savedInvoice) {
          try {
            confetti({
              particleCount: 40,
              spread: 55,
              origin: { y: 0.7 },
            });
          } catch (e) {
            // non-fatal
          }

          onOpenReceipt(savedInvoice);

          // Reset cart & POS form
          setCart([]);
          setOverallDiscount(0);
          setCashTendered('');
          setSplitPaidAmount('');
          setNotes('');
          setSelectedCustomer(null);
          setCustomerSearch('');
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Checkout failed';
      alert(`Error during checkout: ${msg}`);
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pb-20 lg:pb-8">
      {/* LEFT SECTION: Product Catalog, Barcode Search & Categories (Cols 7) */}
      <div className="lg:col-span-7 flex flex-col space-y-4">
        {/* Search Bar & Barcode Scanner Button */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by name, brand, SKU or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kirana-500 text-slate-800 dark:text-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Camera Barcode Scanner Button */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-kirana-700 hover:bg-kirana-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all shrink-0 active:scale-95"
              title="Scan barcode with camera"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Scan Barcode</span>
            </button>
          </div>

          {/* Category Chips Carousel */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-kirana-700 text-white shadow-sm font-bold'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {notification && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notification.message}</span>
          </div>
        )}

        {/* Product Cards Grid */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex-1 min-h-[400px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Available Items ({filteredProducts.length})
            </h3>
            <span className="text-[11px] text-slate-400">Tap item to add to bill</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No products found matching &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[580px] overflow-y-auto pr-1">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stockQuantity <= 0;
                const isLowStock =
                  product.stockQuantity > 0 &&
                  product.stockQuantity <= product.minStockThreshold;

                return (
                  <button
                    key={product.id}
                    disabled={isOutOfStock}
                    onClick={() => addToCart(product, 1)}
                    className={`relative p-3 rounded-xl border text-left flex flex-col justify-between transition-all group ${
                      isOutOfStock
                        ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-kirana-500 hover:shadow-md active:scale-98'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[10px] text-slate-400 font-medium truncate">
                          {product.brand || product.category}
                        </span>
                        {isOutOfStock ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                            Out
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            {product.stockQuantity} {product.unit} left
                          </span>
                        ) : null}
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white line-clamp-2 mt-1 leading-snug">
                        {product.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <span className="font-extrabold text-sm text-kirana-800 dark:text-kirana-400">
                        {formatINR(product.sellingPrice)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        /{product.unit}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SECTION: Cart, Customer Selection, Billing Calculation & Checkout (Cols 5) */}
      <div className="lg:col-span-5 flex flex-col space-y-4">
        {/* Customer Header */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-kirana-600" />
              Customer Details
            </span>

            {selectedCustomer ? (
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-[11px] text-red-600 hover:underline"
              >
                Clear Customer
              </button>
            ) : (
              <button
                onClick={() => setIsCreatingCustomer(!isCreatingCustomer)}
                className="text-[11px] text-kirana-700 dark:text-kirana-400 font-bold hover:underline flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {isCreatingCustomer ? 'Cancel' : 'New Customer'}
              </button>
            )}
          </div>

          {/* Quick Customer Search or Selection */}
          {!selectedCustomer && !isCreatingCustomer && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search customer by name or 10-digit mobile..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-kirana-500"
              />

              {customerSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                  {customerSuggestions.map((cust) => (
                    <button
                      key={cust.id}
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setCustomerSearch('');
                      }}
                      className="w-full p-2.5 text-left text-xs hover:bg-kirana-50 dark:hover:bg-slate-700/50 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-white">{cust.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{cust.phone}</p>
                      </div>
                      <div className="text-right">
                        {cust.outstandingUdhar > 0 && (
                          <span className="text-[10px] font-bold text-red-600 block">
                            Udhar: {formatINR(cust.outstandingUdhar)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* New Customer Inline Form */}
          {isCreatingCustomer && !selectedCustomer && (
            <form onSubmit={handleCreateCustomer} className="space-y-2 mt-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Full Name *"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-800 dark:text-white"
                />
                <input
                  type="tel"
                  placeholder="10-digit Phone *"
                  required
                  maxLength={10}
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-800 dark:text-white font-mono"
                />
              </div>
              <input
                type="text"
                placeholder="Address / Colony (Optional)"
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 text-slate-800 dark:text-white"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingCustomer(false)}
                  className="px-3 py-1 text-xs text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-kirana-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Save & Select
                </button>
              </div>
            </form>
          )}

          {/* Selected Customer Card */}
          {selectedCustomer && (
            <div className="bg-kirana-50 dark:bg-kirana-950/40 border border-kirana-200 dark:border-kirana-800/80 p-3 rounded-xl mt-1 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    {selectedCustomer.name}
                    {selectedCustomer.purchaseCount >= 2 && (
                      <span className="text-[9px] font-black bg-kirana-600 text-white px-1.5 py-0.2 rounded-full uppercase">
                        Repeat Buyer
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-mono">{selectedCustomer.phone}</p>
                </div>
                <div className="text-right">
                  {selectedCustomer.outstandingUdhar > 0 ? (
                    <p className="text-xs font-bold text-red-600">
                      Udhar: {formatINR(selectedCustomer.outstandingUdhar)}
                    </p>
                  ) : (
                    <span className="text-[11px] text-emerald-700 font-bold">Khata Clear (₹0)</span>
                  )}
                </div>
              </div>

              {/* Repeat Previous Bill Button */}
              {lastCustomerInvoice && (
                <div className="pt-2 border-t border-kirana-200/80 dark:border-kirana-800/60 flex items-center justify-between">
                  <div className="text-[10px] text-slate-600 dark:text-slate-400">
                    Last Bill: {lastCustomerInvoice.invoiceNumber} ({formatDate(lastCustomerInvoice.date)})
                  </div>
                  <button
                    onClick={handleRepeatPreviousBill}
                    className="flex items-center gap-1 px-2.5 py-1 bg-kirana-700 hover:bg-kirana-800 text-white text-[11px] font-bold rounded-lg shadow-sm transition-all"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Repeat Previous Bill
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Current Cart Items List */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col flex-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-kirana-600" />
              Bill Cart ({cart.length})
            </h3>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-[11px] text-red-600 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[300px]">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Your cart is empty. Tap products on the left or scan barcode to begin billing.
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                      {item.product.name}
                    </h5>
                    <p className="text-[10px] text-slate-500">
                      {formatINR(item.unitPrice)} / {item.product.unit}
                    </p>
                  </div>

                  {/* Quantity Stepper with Decimal Input Support */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.product.id!, item.quantity - 1)}
                      className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-300"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      step={['kg', 'litre', 'g', 'ml'].includes(item.product.unit) ? '0.1' : '1'}
                      min="0.1"
                      value={item.quantity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) updateQuantity(item.product.id!, val);
                      }}
                      className="w-12 text-center text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded py-0.5"
                    />
                    <button
                      onClick={() => updateQuantity(item.product.id!, item.quantity + 1)}
                      className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-300"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Item Total */}
                  <div className="text-right min-w-[70px]">
                    <span className="text-xs font-black text-slate-900 dark:text-white block">
                      {formatINR(item.total)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.product.id!)}
                      className="text-[10px] text-red-500 hover:text-red-700"
                    >
                      remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Subtotal & Discounts Section */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Items Subtotal:</span>
              <span className="font-semibold text-slate-800 dark:text-white">{formatINR(subtotal)}</span>
            </div>

            {/* Discount field */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Percent className="w-3 h-3 text-slate-400" />
                Store Discount (₹):
              </span>
              <input
                type="number"
                min="0"
                max={subtotal}
                value={overallDiscount || ''}
                placeholder="0"
                onChange={(e) => setOverallDiscount(parseFloat(e.target.value) || 0)}
                className="w-20 px-2 py-0.5 text-right border border-slate-300 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-800"
              />
            </div>

            {/* Grand Total */}
            <div className="flex justify-between text-base font-black pt-2 border-t-2 border-slate-800 dark:border-slate-600 text-slate-900 dark:text-white">
              <span>GRAND TOTAL:</span>
              <span className="text-kirana-800 dark:text-kirana-400">{formatINR(grandTotal)}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Payment Method
            </span>

            <div className="grid grid-cols-4 gap-2 text-xs font-bold">
              {[
                { id: 'cash', label: 'Cash', icon: Banknote },
                { id: 'upi', label: 'UPI / QR', icon: QrCode },
                { id: 'split', label: 'Split', icon: CreditCard },
                { id: 'udhar', label: 'Udhar', icon: Receipt },
              ].map((pm) => {
                const Icon = pm.icon;
                const isSelected = paymentMethod === pm.id;
                return (
                  <button
                    key={pm.id}
                    onClick={() => setPaymentMethod(pm.id as PaymentMethod)}
                    className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 border transition-all ${
                      isSelected
                        ? pm.id === 'udhar'
                          ? 'bg-red-600 text-white border-red-600 shadow-md'
                          : 'bg-kirana-700 text-white border-kirana-700 shadow-md'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px]">{pm.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Cash Tendered Calculator */}
            {paymentMethod === 'cash' && (
              <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Cash Given by Customer:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder={grandTotal.toString()}
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-24 px-2 py-1 text-right border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 font-bold"
                  />
                  {changeDue > 0 && (
                    <span className="text-emerald-700 dark:text-emerald-400 font-black">
                      Return: {formatINR(changeDue)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Split Payment inputs */}
            {paymentMethod === 'split' && (
              <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>Paid Now (Cash / UPI):</span>
                  <input
                    type="number"
                    max={grandTotal}
                    placeholder="e.g. 500"
                    value={splitPaidAmount}
                    onChange={(e) => setSplitPaidAmount(e.target.value)}
                    className="w-24 px-2 py-1 text-right border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 font-bold"
                  />
                </div>
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Balance Added to Udhar Khata:</span>
                  <span>{formatINR(udharAmount)}</span>
                </div>
              </div>
            )}

            {/* Udhar Confirmation message */}
            {paymentMethod === 'udhar' && (
              <div className="bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Entire bill of {formatINR(grandTotal)} will be charged to {selectedCustomer?.name || 'customer'}&apos;s credit ledger.</span>
              </div>
            )}

            {/* Complete Sale Button */}
            <button
              onClick={handleCheckout}
              disabled={isProcessingCheckout || cart.length === 0}
              className="w-full py-3.5 bg-gradient-to-r from-kirana-700 via-kirana-600 to-emerald-600 hover:from-kirana-800 hover:to-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 active:scale-98"
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span>
                {isProcessingCheckout
                  ? 'Saving Bill...'
                  : `Complete Bill • ${formatINR(grandTotal)}`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
      />
    </div>
  );
};
