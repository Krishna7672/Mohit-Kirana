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
  formatQuantityWithSubUnit
} from '../utils/formatters';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { WeightPriceAdjustModal } from '../components/WeightPriceAdjustModal';
import { UpdatePreviousUdharModal } from '../components/UpdatePreviousUdharModal';
import {
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  UserCheck,
  UserPlus,
  Users,
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
  X,
  Package,
  ArrowRight,
  User,
  ChevronRight,
  Scale,
  Edit2
} from 'lucide-react';

interface Props {
  settings: StoreSettings;
  onOpenReceipt: (invoice: Invoice) => void;
  preselectedCustomerId?: number | null;
}

export const POSBillingView: React.FC<Props> = ({
  settings,
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

  // Mobile layout tab switcher ('catalog' vs 'cart')
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  // Customer state & Modals
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [customerModalSearch, setCustomerModalSearch] = useState('');

  // Weight & Price adjustment modal
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  const [isWeightPriceModalOpen, setIsWeightPriceModalOpen] = useState(false);

  // Update previous udhaar modal
  const [isUpdatePreviousUdharOpen, setIsUpdatePreviousUdharOpen] = useState(false);

  // Inline / Modal New Customer Form
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustPreviousUdhar, setNewCustPreviousUdhar] = useState('');

  // Walk-in customer name (optional)
  const [walkInName, setWalkInName] = useState('');

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

  // Filtered customers for customer selection modal
  const filteredModalCustomers = useMemo(() => {
    const q = customerModalSearch.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [customers, customerModalSearch]);

  // Add product to cart with optional sub-unit label (e.g. 250g, 25g)
  const addToCart = (product: Product, qtyToAdd: number = 1, subUnitLabel?: string) => {
    if (product.stockQuantity <= 0) {
      alert(`"${product.name}" is currently out of stock!`);
      return;
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const item = prevCart[existingIndex];
        const newQty = Math.round((item.quantity + qtyToAdd) * 1000) / 1000;
        if (newQty > product.stockQuantity) {
          alert(`Cannot add more than available stock (${product.stockQuantity} ${product.unit}).`);
          return prevCart;
        }
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...item,
          quantity: newQty,
          subUnitLabel: subUnitLabel || item.subUnitLabel,
          total: Math.round(((newQty * item.unitPrice) - item.discount) * 100) / 100,
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
            subUnitLabel,
            total: Math.round((initialQty * product.sellingPrice) * 100) / 100,
          },
        ];
      }
    });
  };

  // Modify quantity in cart
  const updateQuantity = (productId: number, newQty: number, subUnitLabel?: string) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const roundedQty = Math.round(newQty * 1000) / 1000;

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          if (roundedQty > item.product.stockQuantity) {
            alert(`Stock limit reached! Only ${item.product.stockQuantity} ${item.product.unit} available.`);
            return item;
          }
          return {
            ...item,
            quantity: roundedQty,
            subUnitLabel: subUnitLabel !== undefined ? subUnitLabel : item.subUnitLabel,
            total: Math.round(((roundedQty * item.unitPrice) - item.discount) * 100) / 100,
          };
        }
        return item;
      })
    );
  };

  // Apply full item updates from WeightPriceAdjustModal
  const updateCartItemFull = (updatedItem: CartItem) => {
    setCart((prevCart) =>
      prevCart.map((item) => (item.product.id === updatedItem.product.id ? updatedItem : item))
    );
  };

  // Quick preset selector (25g, 50g, 100g, 250g, etc.)
  const handleQuickPreset = (productId: number, presetQty: number, presetLabel: string) => {
    updateQuantity(productId, presetQty, presetLabel);
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

  // Quick customer creation
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
      setIsNewCustomerModalOpen(false);
      setIsCustomerModalOpen(false);
      return;
    }

    const prevAmt = parseFloat(newCustPreviousUdhar) || 0;
    const newCust: Omit<Customer, 'id'> = {
      name: newCustName.trim(),
      phone: cleanPhone,
      address: newCustAddress.trim(),
      registrationDate: new Date().toISOString(),
      purchaseCount: 0,
      totalSpending: 0,
      outstandingUdhar: prevAmt,
      communicationConsent: true,
      updatedAt: new Date().toISOString(),
    };

    const id = await db.customers.add(newCust as Customer);
    if (prevAmt > 0) {
      await db.udharLedger.add({
        customerId: id,
        customerName: newCust.name,
        customerPhone: newCust.phone,
        type: 'adjustment',
        amount: prevAmt,
        balanceAfter: prevAmt,
        notes: 'Previous Udhar / पिछला बकाया (Old Balance - Date Unknown)',
        date: new Date().toISOString(),
      });
    }

    const created = await db.customers.get(id);
    if (created) {
      setSelectedCustomer(created);
      setIsNewCustomerModalOpen(false);
      setIsCustomerModalOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNewCustPreviousUdhar('');
      setNotification({
        type: 'success',
        message: `Registered new customer: ${created.name}${prevAmt > 0 ? ` with previous udhar ${formatINR(prevAmt)}` : ''}`,
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  }, [cart]);

  const grandTotal = Math.max(0, subtotal - overallDiscount);

  const totalItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

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
      setIsCustomerModalOpen(true);
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

      const currentTerminal = settings?.posTerminalName || localStorage.getItem('kirana_pos_terminal') || 'POS-1';
      let createdInvoice: Invoice | null = null;

      // Execute atomic transaction across all related tables
      await db.transaction('rw', [
        db.invoices,
        db.products,
        db.stockMovements,
        db.customers,
        db.udharLedger,
      ], async () => {
        // 1. Create Invoice Record
        const finalCustomerName = selectedCustomer
          ? selectedCustomer.name
          : walkInName.trim()
          ? `${walkInName.trim()} (Walk-in)`
          : 'Walk-in Customer';

        const invoiceData: Omit<Invoice, 'id'> = {
          invoiceNumber,
          date: now,
          customerId: selectedCustomer?.id || null,
          customerName: finalCustomerName,
          customerPhone: selectedCustomer?.phone || '',
          walkInCustomerName: walkInName.trim() || undefined,
          posTerminalName: currentTerminal,
          items: cart.map((c) => ({
            productId: c.product.id!,
            name: c.product.name,
            unit: c.product.unit,
            quantity: c.quantity,
            purchasePrice: c.product.purchasePrice,
            sellingPrice: c.unitPrice,
            discount: c.discount,
            total: c.total,
            subUnitLabel: c.subUnitLabel,
            isCustomPrice: c.isCustomPrice,
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
        createdInvoice = { ...invoiceData, id: invoiceId };

        // 2. Deduct Stock & Record Audit Movement
        for (const item of cart) {
          const fresh = await db.products.get(item.product.id!);
          if (fresh) {
            const newStock = Math.max(0, Math.round((fresh.stockQuantity - item.quantity) * 1000) / 1000);
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
              reason: `Sold in Bill #${invoiceNumber} (${currentTerminal})`,
              posTerminalName: currentTerminal,
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

            // Record in Udhar Khata Ledger if credit was given
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
                notes: `Bill #${invoiceNumber} credit balance`,
                date: now,
              });
            }
          }
        }
      });

      // Trigger Confetti Celebration
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 },
      });

      // Clear Form State
      setCart([]);
      setOverallDiscount(0);
      setCashTendered('');
      setSplitPaidAmount('');
      setNotes('');
      setWalkInName('');
      setPaymentMethod('cash');

      setNotification({
        type: 'success',
        message: `Sale completed! Bill #${invoiceNumber} saved.`,
      });
      setTimeout(() => setNotification(null), 3500);

      // Auto Open Receipt Print Modal
      if (createdInvoice) {
        onOpenReceipt(createdInvoice);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown checkout error';
      alert(`Error during checkout: ${msg}`);
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  return (
    <div className="space-y-4 pb-28 lg:pb-8">
      {/* 1. TOP CUSTOMER SELECTION PANEL (Always Visible on Mobile & Desktop) */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Customer Info Display */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              selectedCustomer
                ? 'bg-kirana-600 text-white shadow-md shadow-kirana-600/30'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
            }`}>
              {selectedCustomer ? <UserCheck className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Customer / Party:
                </span>
                {selectedCustomer ? (
                  <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                    {selectedCustomer.name}
                  </span>
                ) : (
                  <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                    Walk-in Customer (General Bill)
                  </span>
                )}

                {selectedCustomer && selectedCustomer.outstandingUdhar > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300">
                    Udhar: {formatINR(selectedCustomer.outstandingUdhar)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                {selectedCustomer ? (
                  <>
                    <span className="font-mono">{selectedCustomer.phone}</span>
                    {selectedCustomer.address && (
                      <span className="truncate max-w-[180px] sm:max-w-xs text-slate-400 hidden xs:inline">
                        • {selectedCustomer.address}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-slate-500">Cash / Instant Payment • No Khata Record</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Add Walk-in Customer Name (Optional)"
                        value={walkInName}
                        onChange={(e) => setWalkInName(e.target.value)}
                        className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-kirana-500 w-56 sm:w-64"
                      />
                      {walkInName && (
                        <button
                          type="button"
                          onClick={() => setWalkInName('')}
                          className="text-[10px] text-slate-400 hover:text-slate-600 px-1"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Customer Action Buttons */}
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {selectedCustomer ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsUpdatePreviousUdharOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 dark:hover:bg-amber-900/70 text-amber-900 dark:text-amber-200 text-xs font-bold rounded-xl border border-amber-300 dark:border-amber-800 transition-all active:scale-95 shadow-xs"
                  title="Update customer previous udhaar without needing a date"
                >
                  <CreditCard className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>Update Udhar</span>
                </button>
                {lastCustomerInvoice && (
                  <button
                    onClick={handleRepeatPreviousBill}
                    className="flex items-center gap-1 px-3 py-1.5 bg-kirana-100 dark:bg-kirana-950 text-kirana-800 dark:text-kirana-300 hover:bg-kirana-200 text-xs font-bold rounded-xl transition-all"
                    title="Repeat previous order items"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Repeat Last Bill</span>
                  </button>
                )}
                <button
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all"
                >
                  Change
                </button>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-all"
                  title="Switch to Walk-in"
                >
                  Clear
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-kirana-700 hover:bg-kirana-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Select Customer</span>
                </button>
                <button
                  onClick={() => setIsNewCustomerModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ New Party</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick Customer Selection Chips (Top 4 Customers for 1-tap select) */}
        {!selectedCustomer && customers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            <span className="text-[11px] text-slate-400 font-medium shrink-0 mr-1">Quick Select:</span>
            {customers.slice(0, 5).map((cust) => (
              <button
                key={cust.id}
                onClick={() => setSelectedCustomer(cust)}
                className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900/60 hover:bg-kirana-50 hover:text-kirana-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 whitespace-nowrap text-xs font-medium transition-all flex items-center gap-1"
              >
                <span>{cust.name}</span>
                {cust.outstandingUdhar > 0 && (
                  <span className="text-[10px] text-red-600 font-bold">({formatINR(cust.outstandingUdhar)})</span>
                )}
              </button>
            ))}
            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className="text-[11px] text-kirana-700 dark:text-kirana-400 font-bold px-2 py-1 hover:underline whitespace-nowrap"
            >
              View All ({customers.length}) →
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
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

      {/* 2. MOBILE VIEW SWITCHER TABS (Only visible on screens < lg) */}
      <div className="lg:hidden flex items-center bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl shadow-inner">
        <button
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            mobileTab === 'catalog'
              ? 'bg-white dark:bg-slate-700 text-kirana-800 dark:text-white shadow-sm font-extrabold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Add Products ({filteredProducts.length})</span>
        </button>
        <button
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            mobileTab === 'cart'
              ? 'bg-kirana-700 text-white shadow-sm font-extrabold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Current Bill ({cart.length}) • {formatINR(grandTotal)}</span>
        </button>
      </div>

      {/* 3. MAIN SECTION GRID: Left (Catalog) & Right (Cart & Checkout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT SECTION: Products Catalog (Visible on desktop OR when mobileTab === 'catalog') */}
        <div className={`lg:col-span-7 flex-col space-y-4 ${mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'}`}>
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

              {/* Barcode Scanner Button */}
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-kirana-600 hover:bg-kirana-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all shrink-0 active:scale-95"
                title="Scan barcode with camera"
              >
                <Barcode className="w-4 h-4 text-amber-300" />
                <span>Scan Barcode</span>
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

          {/* Product Cards Grid */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex-1 min-h-[380px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Store Inventory ({filteredProducts.length})
              </h3>
              <span className="text-[11px] text-slate-400">Tap item to add to bill</span>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs space-y-2">
                <p>No products found matching &ldquo;{searchQuery}&rdquo;.</p>
                <p className="text-[11px] text-slate-500">Go to Inventory tab to add or select items from Master Catalog.</p>
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
                              {product.stockQuantity} left
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

                      {/* Quick fraction chips for kg, litre, g items right on catalog card */}
                      {['kg', 'litre', 'g'].includes(product.unit) && !isOutOfStock && (
                        <div
                          className="mt-2 pt-1.5 border-t border-dashed border-slate-100 dark:border-slate-700/80 flex items-center gap-1 overflow-x-auto scrollbar-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[9px] text-slate-400 font-bold shrink-0">Retail:</span>
                          {(product.unit === 'kg'
                            ? [
                                { label: '100g', qty: 0.1 },
                                { label: '250g', qty: 0.25 },
                                { label: '500g', qty: 0.5 },
                                { label: '1kg', qty: 1 },
                                { label: '2kg', qty: 2 },
                              ]
                            : product.unit === 'g'
                            ? [
                                { label: '50g', qty: 50 },
                                { label: '100g', qty: 100 },
                                { label: '250g', qty: 250 },
                                { label: '500g', qty: 500 },
                              ]
                            : [
                                { label: '100ml', qty: 0.1 },
                                { label: '250ml', qty: 0.25 },
                                { label: '500ml', qty: 0.5 },
                                { label: '1L', qty: 1 },
                                { label: '2L', qty: 2 },
                              ]
                          ).map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(product, preset.qty, preset.label);
                              }}
                              className="px-1.5 py-0.5 rounded bg-kirana-50 hover:bg-kirana-600 hover:text-white dark:bg-slate-700 dark:hover:bg-kirana-600 text-[10px] font-bold text-kirana-800 dark:text-kirana-300 transition-colors"
                              title={`Add ${preset.label} to bill`}
                            >
                              +{preset.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SECTION: Cart, Billing Calculation & Checkout (Visible on desktop OR when mobileTab === 'cart') */}
        <div className={`lg:col-span-5 flex-col space-y-4 ${mobileTab === 'cart' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Current Cart Items List */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col flex-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-kirana-600" />
                Items in Bill ({cart.length})
              </h3>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] text-red-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Cart
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[300px]">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <p>Your cart is empty.</p>
                  <button
                    onClick={() => setMobileTab('catalog')}
                    className="lg:hidden px-3 py-1.5 bg-kirana-700 text-white rounded-lg text-xs font-bold"
                  >
                    Browse Items to Add
                  </button>
                </div>
              ) : (
                cart.map((item) => {
                  const isKg = item.product.unit === 'kg';
                  const isLitre = item.product.unit === 'litre';
                  const isFractional = isKg || isLitre;

                  return (
                    <div
                      key={item.product.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        item.isCustomPrice
                          ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60'
                          : 'bg-slate-50 dark:bg-slate-750 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h5 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                              {item.product.name}
                            </h5>
                            {item.subUnitLabel && (
                              <span className="px-1.5 py-0.5 rounded-md bg-kirana-100 dark:bg-kirana-950 text-kirana-800 dark:text-kirana-300 text-[10px] font-black">
                                {item.subUnitLabel}
                              </span>
                            )}
                            {item.isCustomPrice && (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[9px] font-bold">
                                Adjusted Rate
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span>
                              {formatINR(item.unitPrice)} / {item.product.unit}
                            </span>
                            {item.isCustomPrice && (
                              <span className="line-through text-[10px] text-slate-400">
                                (Orig: {formatINR(item.product.sellingPrice)})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Item Total & Remove */}
                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-slate-900 dark:text-white block">
                            {formatINR(item.total)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id!)}
                            className="text-[10px] text-red-500 hover:text-red-700 hover:underline"
                          >
                            remove
                          </button>
                        </div>
                      </div>

                      {/* Stepper + Weight / Price Adjust Button */}
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 flex-wrap">
                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const step = isFractional ? 0.1 : 1;
                              const nextVal = Math.max(0.025, Math.round((item.quantity - step) * 1000) / 1000);
                              updateQuantity(item.product.id!, nextVal);
                            }}
                            className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-300 active:scale-95"
                            title="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>

                          <div className="relative">
                            <input
                              type="number"
                              step={isFractional ? '0.025' : '1'}
                              min="0.001"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) updateQuantity(item.product.id!, val);
                              }}
                              className="w-16 text-center text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg py-1 text-slate-900 dark:text-white"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const step = isFractional ? 0.1 : 1;
                              const nextVal = Math.round((item.quantity + step) * 1000) / 1000;
                              updateQuantity(item.product.id!, nextVal);
                            }}
                            className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-white hover:bg-slate-300 active:scale-95"
                            title="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>

                          <span className="text-[11px] font-semibold text-slate-500 ml-1">
                            {formatQuantityWithSubUnit(item.quantity, item.product.unit, item.subUnitLabel)}
                          </span>
                        </div>

                        {/* Adjust Price & Weight Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCartItem(item);
                            setIsWeightPriceModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-kirana-50 hover:text-kirana-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 shadow-xs transition-all active:scale-95"
                          title="Adjust weight in grams / ml or modify selling price"
                        >
                          <Scale className="w-3.5 h-3.5 text-kirana-600" />
                          <span>⚖️ Edit Weight / Price</span>
                        </button>
                      </div>

                      {/* Quick 1-Tap Weight Chips for kg & litre */}
                      {isFractional && (
                        <div className="mt-2 pt-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none">
                          <span className="text-[9px] font-bold text-slate-400 shrink-0">Retail:</span>
                          {(isKg
                            ? [
                                { label: '50g', qty: 0.05 },
                                { label: '100g', qty: 0.1 },
                                { label: '200g', qty: 0.2 },
                                { label: '250g', qty: 0.25 },
                                { label: '500g', qty: 0.5 },
                                { label: '1kg', qty: 1 },
                                { label: '2kg', qty: 2 },
                              ]
                            : [
                                { label: '50ml', qty: 0.05 },
                                { label: '100ml', qty: 0.1 },
                                { label: '200ml', qty: 0.2 },
                                { label: '250ml', qty: 0.25 },
                                { label: '500ml', qty: 0.5 },
                                { label: '1L', qty: 1 },
                                { label: '2L', qty: 2 },
                              ]
                          ).map((preset) => {
                            const isMatch = Math.abs(item.quantity - preset.qty) < 0.001;
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => handleQuickPreset(item.product.id!, preset.qty, preset.label)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap transition-all border ${
                                  isMatch
                                    ? 'bg-kirana-700 text-white border-kirana-700 shadow-xs'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Subtotal & Discounts Section */}
            <div className="p-4 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Items Subtotal ({totalItemCount} units):</span>
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
                  className="w-20 px-2 py-0.5 text-right border border-slate-300 dark:border-slate-600 rounded text-xs bg-white dark:bg-slate-800 font-bold"
                />
              </div>

              {/* Grand Total */}
              <div className="flex justify-between text-base font-black pt-2 border-t-2 border-slate-800 dark:border-slate-600 text-slate-900 dark:text-white">
                <span>GRAND TOTAL:</span>
                <span className="text-kirana-800 dark:text-kirana-400 text-lg">{formatINR(grandTotal)}</span>
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
                <div className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Cash Given:</span>
                    <input
                      type="number"
                      placeholder={grandTotal.toString()}
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-24 px-2 py-1 text-right border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 font-bold"
                    />
                  </div>

                  {/* Fast Denomination Chips */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                    {[100, 200, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashTendered(amt.toString())}
                        className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                      >
                        ₹{amt}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashTendered(grandTotal.toString())}
                      className="px-2 py-0.5 rounded bg-kirana-100 dark:bg-kirana-950 text-[10px] font-bold text-kirana-800 dark:text-kirana-300"
                    >
                      Exact
                    </button>
                  </div>

                  {changeDue > 0 && (
                    <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-emerald-700 dark:text-emerald-400">
                      <span>Change to Return:</span>
                      <span>{formatINR(changeDue)}</span>
                    </div>
                  )}
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
                  <span>Entire bill of {formatINR(grandTotal)} will be added to {selectedCustomer?.name || 'customer'}&apos;s credit ledger.</span>
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
      </div>

      {/* 4. MOBILE STICKY FLOATING BOTTOM BAR (Shown when on catalog tab and cart has items) */}
      {mobileTab === 'catalog' && cart.length > 0 && (
        <div className="lg:hidden fixed bottom-20 left-4 right-4 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={() => setMobileTab('cart')}
            className="w-full bg-kirana-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between font-bold text-xs border border-kirana-700 active:scale-98"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-kirana-600 flex items-center justify-center text-xs font-black">
                {totalItemCount}
              </span>
              <span className="text-sm font-extrabold">{formatINR(grandTotal)}</span>
            </div>
            <div className="flex items-center gap-1 text-kirana-200">
              <span>View Bill & Pay</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </div>
          </button>
        </div>
      )}

      {/* 5. CUSTOMER SELECTION MODAL */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-kirana-600" />
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Select Customer / Party
                  </h3>
                  <p className="text-[11px] text-slate-500">Pick a registered customer or add a new party</p>
                </div>
              </div>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar & New Customer Action */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, phone or address..."
                  value={customerModalSearch}
                  onChange={(e) => setCustomerModalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-kirana-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500 font-medium">
                  {filteredModalCustomers.length} parties registered
                </span>
                <button
                  onClick={() => {
                    setIsCustomerModalOpen(false);
                    setIsNewCustomerModalOpen(true);
                  }}
                  className="flex items-center gap-1 text-xs text-kirana-700 dark:text-kirana-400 font-bold hover:underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Create New Party</span>
                </button>
              </div>
            </div>

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-100 dark:divide-slate-800">
              {/* Option for Walk-in Customer */}
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setIsCustomerModalOpen(false);
                }}
                className="w-full p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">Walk-in Customer</h4>
                    <p className="text-[10px] text-slate-400">Cash / Default General Sale</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-kirana-700 dark:text-kirana-400">Select</span>
              </button>

              {filteredModalCustomers.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <p>No customer found matching &ldquo;{customerModalSearch}&rdquo;.</p>
                  <button
                    onClick={() => {
                      setIsCustomerModalOpen(false);
                      setIsNewCustomerModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-kirana-700 text-white rounded-lg font-bold text-xs"
                  >
                    + Add as New Customer
                  </button>
                </div>
              ) : (
                filteredModalCustomers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer(c);
                      setIsCustomerModalOpen(false);
                    }}
                    className="w-full pt-2 pb-2 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-xl transition-all"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {c.name}
                        </span>
                        {c.outstandingUdhar > 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 shrink-0">
                            Udhar: {formatINR(c.outstandingUdhar)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>{c.phone}</span>
                        {c.address && <span className="truncate max-w-[150px]">({c.address})</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. CREATE NEW CUSTOMER MODAL */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-kirana-600" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Add New Customer
                </h3>
              </div>
              <button
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-5 space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">10-Digit Mobile Number *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Address / Colony (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Gali No. 4, Main Bazar"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Previous Udhar / पिछला उधार (₹)
                  </label>
                  <span className="text-[10px] text-slate-400">Optional</span>
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00 (तारीख याद न हो तो भी भर सकते हैं)"
                  value={newCustPreviousUdhar}
                  onChange={(e) => setNewCustPreviousUdhar(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  💡 No date required. Records immediately in customer&apos;s khata.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-kirana-700 hover:bg-kirana-800 text-white font-bold rounded-xl shadow-sm"
                >
                  Save & Select for Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. WEIGHT & PRICE ADJUST MODAL */}
      <WeightPriceAdjustModal
        isOpen={isWeightPriceModalOpen}
        onClose={() => {
          setIsWeightPriceModalOpen(false);
          setEditingCartItem(null);
        }}
        item={editingCartItem}
        onSave={updateCartItemFull}
      />

      {/* 8. UPDATE PREVIOUS UDHAR MODAL */}
      <UpdatePreviousUdharModal
        isOpen={isUpdatePreviousUdharOpen}
        onClose={() => setIsUpdatePreviousUdharOpen(false)}
        customer={selectedCustomer}
        customersList={customers}
        onSuccess={(updated) => {
          setSelectedCustomer(updated);
          setNotification({
            type: 'success',
            message: `Updated Udhaar for ${updated.name}: ${formatINR(updated.outstandingUdhar)}`,
          });
          setTimeout(() => setNotification(null), 3000);
        }}
      />

      {/* 9. FAST BARCODE SCANNER MODAL */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
      />
    </div>
  );
};
