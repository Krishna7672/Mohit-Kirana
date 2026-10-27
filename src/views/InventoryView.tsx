import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Product, UnitType, StoreSettings } from '../types';
import { formatINR, formatDate } from '../utils/formatters';
import { exportProductsCSV, parseProductsCSV } from '../utils/csv';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { MASTER_GROCERY_CATALOG, type CatalogItem } from '../data/masterCatalog';
import {
  Package,
  Plus,
  Search,
  Camera,
  Barcode,
  Download,
  Upload,
  History,
  Edit2,
  Archive,
  RotateCcw,
  X,
  Check,
  Calendar,
  Layers,
  Sparkles,
  BookOpen,
  CheckSquare,
  Square,
  AlertCircle,
  ChevronRight
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
  
  // Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'inventorySearch' | 'formBarcode'>('inventorySearch');

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(openNewProductModalOnMount || false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  // Master Catalog Modal State
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('All');
  const [selectedCatalogItems, setSelectedCatalogItems] = useState<Set<string>>(new Set());

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
  const [autoFillNotice, setAutoFillNotice] = useState<string | null>(null);

  // Stock Adjustment form state
  const [adjustType, setAdjustType] = useState<'manual_in' | 'manual_out' | 'damage'>('manual_in');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // CSV Import file input ref
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Auto-fill from catalog item
  const applyCatalogItemToForm = (item: CatalogItem) => {
    setFormName(item.name);
    setFormCategory(item.category);
    setFormBrand(item.brand);
    setFormUnit(item.unit);
    setFormBarcode(item.barcode);
    setFormPurchasePrice(item.typicalPurchasePrice.toString());
    setFormSellingPrice(item.typicalSellingPrice.toString());
    setFormSku(`SKU-${item.barcode.slice(-6)}`);
    if (!formStockQuantity || formStockQuantity === '0') {
      setFormStockQuantity('15');
    }
    setAutoFillNotice(`Auto-filled details for "${item.name}" from Master Catalog!`);
    setTimeout(() => setAutoFillNotice(null), 4000);
  };

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
    setAutoFillNotice(null);
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
    setAutoFillNotice(null);
    setIsAddEditOpen(true);
  };

  // List of all previous and catalog products for autocomplete dropdown
  const allKnownProducts = useMemo(() => {
    const map = new Map<string, { name: string; brand: string; category: string; unit: UnitType; purchasePrice?: number; sellingPrice?: number; barcode?: string }>();
    
    // Existing store products
    products.forEach((p) => {
      if (p.name) {
        map.set(p.name.trim(), {
          name: p.name.trim(),
          brand: p.brand || '',
          category: p.category || 'General',
          unit: p.unit,
          purchasePrice: p.purchasePrice,
          sellingPrice: p.sellingPrice,
          barcode: p.barcode,
        });
      }
    });

    // Master Catalog items
    MASTER_GROCERY_CATALOG.forEach((c) => {
      if (c.name && !map.has(c.name.trim())) {
        map.set(c.name.trim(), {
          name: c.name.trim(),
          brand: c.brand || '',
          category: c.category || 'General',
          unit: c.unit,
          purchasePrice: c.typicalPurchasePrice,
          sellingPrice: c.typicalSellingPrice,
          barcode: c.barcode,
        });
      }
    });

    return Array.from(map.values());
  }, [products]);

  // Intelligent unit & bulk quantity deduction for loose Kirana items
  const inferUnitAndQuantity = (nameText: string, currentCategory: string) => {
    const text = nameText.toLowerCase();

    // 1. Check if quantity & unit are explicitly mentioned like "100kg", "50 kg", "25 kg", "15 litre", "15L", "5L", "500g"
    const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|किलो)/i);
    const litreMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:litre|liter|ltr|लीटर)\b/i) || text.match(/(\d+(?:\.\d+)?)\s*l\b/i);
    const gramMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:gm|gram|ग्राम|g)\b/i);

    let detectedUnit: UnitType | null = null;
    let detectedQty: string | null = null;

    if (kgMatch) {
      detectedUnit = 'kg';
      detectedQty = kgMatch[1];
    } else if (litreMatch) {
      detectedUnit = 'litre';
      detectedQty = litreMatch[1];
    } else if (gramMatch) {
      detectedUnit = 'g';
      detectedQty = gramMatch[1];
    }

    // 2. Keyword matching for loose grocery items
    const kgKeywords = [
      'sugar', 'shakkar', 'chini', 'cheeni',
      'rice', 'chawal', 'basmati',
      'atta', 'wheat', 'gehu', 'gehun',
      'dal', 'daal', 'toor', 'tur', 'moong', 'urad', 'masoor', 'chana',
      'besan', 'sooji', 'suji', 'rawa', 'maida', 'poha', 'sabudana',
      'peanut', 'shengdana', 'moongfali', 'mungfali',
      'jaggery', 'gur', 'gud',
      'salt', 'namak'
    ];

    const litreKeywords = [
      'oil', 'tel', 'tail', 'ghee', 'mustard oil', 'sarson', 'refined', 'soyabean', 'sunflower',
      'milk', 'doodh', 'dudh', 'buttermilk', 'chaas'
    ];

    const gramKeywords = [
      'elaichi', 'cardamom', 'clove', 'laung', 'dalchini', 'jeera', 'cumin', 'hing', 'kesar',
      'dry fruit', 'kaju', 'badam', 'cashew', 'almond', 'kishmish', 'raisin'
    ];

    if (!detectedUnit) {
      if (kgKeywords.some((k) => text.includes(k))) {
        detectedUnit = 'kg';
      } else if (litreKeywords.some((k) => text.includes(k))) {
        detectedUnit = 'litre';
      } else if (gramKeywords.some((k) => text.includes(k))) {
        detectedUnit = 'g';
      }
    }

    // 3. Category inference if unit still not detected
    if (!detectedUnit && currentCategory) {
      const cat = currentCategory.toLowerCase();
      if (cat.includes('grains') || cat.includes('sugar') || cat.includes('atta') || cat.includes('dal') || cat.includes('flour')) {
        detectedUnit = 'kg';
      } else if (cat.includes('oil') || cat.includes('ghee') || cat.includes('dairy')) {
        detectedUnit = 'litre';
      } else if (cat.includes('spices') || cat.includes('dry fruit')) {
        detectedUnit = 'kg';
      }
    }

    return { detectedUnit, detectedQty };
  };

  // Handle Category change with smart unit defaulting
  const handleCategoryChange = (val: string) => {
    setFormCategory(val);
    const cat = val.toLowerCase();
    if (formUnit === 'packet' || formUnit === 'piece') {
      if (cat.includes('grains') || cat.includes('sugar') || cat.includes('atta') || cat.includes('dal') || cat.includes('flour')) {
        setFormUnit('kg');
      } else if (cat.includes('oil') || cat.includes('ghee') || cat.includes('dairy')) {
        setFormUnit('litre');
      } else if (cat.includes('spices') || cat.includes('dry fruit')) {
        setFormUnit('kg');
      }
    }
  };

  // Handle Name input change with auto-fill when selecting known product or smart loose commodity detection
  const handleNameInputChange = (val: string) => {
    setFormName(val);
    if (!val.trim()) return;

    const matched = allKnownProducts.find(
      (p) => p.name.toLowerCase() === val.trim().toLowerCase()
    );

    if (matched && (!formBrand || !formSellingPrice)) {
      if (matched.brand) setFormBrand(matched.brand);
      if (matched.category) setFormCategory(matched.category);
      if (matched.unit) setFormUnit(matched.unit);
      if (matched.sellingPrice && !formSellingPrice) setFormSellingPrice(matched.sellingPrice.toString());
      if (matched.purchasePrice && !formPurchasePrice) setFormPurchasePrice(matched.purchasePrice.toString());
      if (matched.barcode && !formBarcode) {
        setFormBarcode(matched.barcode);
        setFormSku(`SKU-${matched.barcode.slice(-6)}`);
      }
      setAutoFillNotice(`✨ Auto-filled details for "${matched.name}" from previous product records!`);
      setTimeout(() => setAutoFillNotice(null), 3500);
      return;
    }

    // Auto-detect unit and quantity for loose items like 100kg sugar, rice, dal, oil
    const { detectedUnit, detectedQty } = inferUnitAndQuantity(val, formCategory);
    if (detectedUnit && (!editingProduct || formUnit === 'packet')) {
      setFormUnit(detectedUnit);
      if (detectedQty && (!formStockQuantity || formStockQuantity === '10' || formStockQuantity === '0')) {
        setFormStockQuantity(detectedQty);
      }
      if (!formCategory) {
        if (detectedUnit === 'kg') setFormCategory('Grains & Sugar');
        else if (detectedUnit === 'litre') setFormCategory('Edible Oils & Ghee');
        else if (detectedUnit === 'g') setFormCategory('Spices & Seasonings');
      }
    }
  };

  // Check barcode against catalog during typing
  const handleBarcodeChange = (code: string) => {
    setFormBarcode(code);
    if (!code.trim()) return;

    const matchedCatalog = MASTER_GROCERY_CATALOG.find((c) => c.barcode === code.trim());
    if (matchedCatalog && !formName) {
      applyCatalogItemToForm(matchedCatalog);
    }
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

    const currentTerminal = settings?.posTerminalName || localStorage.getItem('kirana_pos_terminal') || 'POS-1';

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
          reason: `Manual stock adjustment during product edit (${currentTerminal})`,
          posTerminalName: currentTerminal,
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
        addedByTerminal: currentTerminal,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      };

      const newId = await db.products.add(newProduct as Product);

      // Record initial stock movement
      if (stockQty > 0) {
        await db.stockMovements.add({
          productId: newId,
          productName: newProduct.name,
          type: 'manual_in',
          quantityChange: stockQty,
          quantityAfter: stockQty,
          reason: `Initial added stock (${currentTerminal})`,
          posTerminalName: currentTerminal,
          date: now,
        });
      }
    }

    setIsAddEditOpen(false);
  };

  // Add multiple items from Master Catalog with 1-click
  const handleAddSelectedCatalogItems = async () => {
    if (selectedCatalogItems.size === 0) return;

    const itemsToAdd = MASTER_GROCERY_CATALOG.filter((item) =>
      selectedCatalogItems.has(item.barcode)
    );

    const now = new Date().toISOString();
    let addedCount = 0;

    for (const item of itemsToAdd) {
      // Check if already in products
      const existing = products.find((p) => p.barcode === item.barcode);
      if (!existing) {
        const newProduct: Omit<Product, 'id'> = {
          name: item.name,
          category: item.category,
          brand: item.brand,
          sku: `SKU-${item.barcode.slice(-6)}`,
          barcode: item.barcode,
          unit: item.unit,
          purchasePrice: item.typicalPurchasePrice,
          sellingPrice: item.typicalSellingPrice,
          stockQuantity: 15, // standard default initial inventory
          minStockThreshold: 5,
          supplierName: 'Main Distributor',
          expiryDate: '',
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        };

        const id = await db.products.add(newProduct as Product);
        await db.stockMovements.add({
          productId: id,
          productName: item.name,
          type: 'manual_in',
          quantityChange: 15,
          quantityAfter: 15,
          reason: 'Added from Master Grocery Catalog',
          date: now,
        });
        addedCount++;
      }
    }

    setSelectedCatalogItems(new Set());
    setIsCatalogModalOpen(false);
    alert(`Successfully added ${addedCount} products to your store inventory!`);
  };

  // Toggle archive product
  const toggleArchiveProduct = async (p: Product) => {
    if (!p.id) return;
    const confirm = window.confirm(
      p.isArchived
        ? `Restore "${p.name}" to active inventory?`
        : `Archive "${p.name}"? It will not appear in POS billing.`
    );
    if (confirm) {
      await db.products.update(p.id, {
        isArchived: !p.isArchived,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Quick Stock Adjustment
  const openStockAdjustModal = (p: Product) => {
    setAdjustingProduct(p);
    setAdjustType('manual_in');
    setAdjustQty('');
    setAdjustReason('');
    setIsAdjustStockOpen(true);
  };

  const handleStockAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || !adjustingProduct.id) return;

    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid quantity greater than zero');
      return;
    }

    const current = adjustingProduct.stockQuantity;
    let newStock = current;
    let change = 0;

    if (adjustType === 'manual_in') {
      newStock = current + qty;
      change = qty;
    } else {
      if (qty > current) {
        alert(`Cannot reduce more than current stock (${current} ${adjustingProduct.unit})`);
        return;
      }
      newStock = current - qty;
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
      reason: adjustReason.trim() || `Manual stock ${adjustType}`,
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

  // Smart Barcode scanned handler from camera
  const handleBarcodeScanned = (code: string) => {
    if (scannerTarget === 'formBarcode') {
      // Scanned into Add/Edit modal form
      handleBarcodeChange(code);
      return;
    }

    // Scanned on the main inventory screen
    const existing = products.find(
      (p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase()
    );

    if (existing) {
      setSearchQuery(code);
      alert(`Found existing item: "${existing.name}" (In stock: ${existing.stockQuantity} ${existing.unit})`);
    } else {
      // Check if found in Master Catalog
      const matchedCatalog = MASTER_GROCERY_CATALOG.find((c) => c.barcode === code);
      if (matchedCatalog) {
        const confirmAdd = window.confirm(
          `Scanned code "${code}" matches "${matchedCatalog.name}" in Master Catalog.\n\nAdd to your store inventory?`
        );
        if (confirmAdd) {
          openNewModal();
          applyCatalogItemToForm(matchedCatalog);
        }
      } else {
        const confirmNew = window.confirm(
          `New Barcode scanned: "${code}".\nAdd as a new product in your inventory?`
        );
        if (confirmNew) {
          openNewModal();
          setFormBarcode(code);
        }
      }
    }
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [products]);

  // Master Catalog categories
  const catalogCategories = useMemo(() => {
    const set = new Set<string>();
    MASTER_GROCERY_CATALOG.forEach((item) => set.add(item.category));
    return ['All', ...Array.from(set)];
  }, []);

  // Filtered master catalog items
  const filteredCatalogItems = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim();
    return MASTER_GROCERY_CATALOG.filter((item) => {
      const matchCat = catalogCategory === 'All' || item.category === catalogCategory;
      const matchQ =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.barcode.includes(q);
      return matchCat && matchQ;
    });
  }, [catalogSearch, catalogCategory]);

  // Inventory valuation calculations
  const valuation = useMemo(() => {
    const active = products.filter((p) => !p.isArchived);
    const totalCostValue = active.reduce(
      (sum, p) => sum + Math.max(0, p.stockQuantity || 0) * (p.purchasePrice || 0),
      0
    );
    const totalRetailValue = active.reduce(
      (sum, p) => sum + Math.max(0, p.stockQuantity || 0) * (p.sellingPrice || 0),
      0
    );
    const totalUnits = active.reduce(
      (sum, p) => sum + Math.max(0, p.stockQuantity || 0),
      0
    );
    const estimatedMargin = totalRetailValue - totalCostValue;
    const hasCostTracking = totalCostValue > 0;

    return {
      activeCount: active.length,
      totalUnits,
      totalCostValue,
      totalRetailValue,
      estimatedMargin,
      hasCostTracking,
      marginPercent:
        hasCostTracking && totalRetailValue > 0 ? (estimatedMargin / totalRetailValue) * 100 : 0,
    };
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const now = new Date();
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(now.getDate() + 30);

    return products.filter((p) => {
      // Category filter
      if (categoryFilter !== 'All' && p.category !== categoryFilter) {
        return false;
      }

      // Stock status filter
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
    <div className="space-y-6 pb-28 lg:pb-8">
      {/* Header and Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-kirana-600" />
            Inventory & Stock Management
          </h2>
          <p className="text-xs text-slate-500">
            Easily select from 60+ Indian grocery catalog items, scan barcodes, and track stock
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* MASTER CATALOG QUICK ADD BUTTON */}
          <button
            onClick={() => setIsCatalogModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>Master Catalog (60+)</span>
          </button>

          {/* Add Product Button */}
          <button
            onClick={openNewModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black dark:bg-slate-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Product</span>
          </button>

          {/* Audit Log Button */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Audit Log</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={() => exportProductsCSV(products)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
            title="Export products to CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Export</span>
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
            <span className="hidden sm:inline">Import</span>
          </button>
        </div>
      </div>

      {/* Inventory Valuation Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm border-l-4 border-l-kirana-600">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Stock Value (Retail)</span>
          <p className="text-xl font-black text-kirana-800 dark:text-kirana-400 mt-1">
            {formatINR(valuation.totalRetailValue)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Items in Store</span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {valuation.activeCount} <span className="text-xs font-normal text-slate-400">SKUs ({valuation.totalUnits} units)</span>
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Stock Cost</span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {valuation.hasCostTracking ? formatINR(valuation.totalCostValue) : <span className="text-slate-400 text-sm font-bold">Not set (₹0)</span>}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Estimated Gross Margin</span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {valuation.hasCostTracking ? (
              <>
                {formatINR(valuation.estimatedMargin)}{' '}
                <span className="text-xs font-bold text-emerald-700">
                  ({valuation.marginPercent.toFixed(1)}%)
                </span>
              </>
            ) : (
              <span className="text-xs font-semibold text-slate-400">— (Enter cost price)</span>
            )}
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
              placeholder="Search store items by name, barcode, SKU or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-kirana-500 text-slate-900 dark:text-white"
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

          {/* Barcode Scanner Button */}
          <button
            onClick={() => {
              setScannerTarget('inventorySearch');
              setIsScannerOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold shrink-0 border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95 transition-all"
            title="Scan product barcode with camera"
          >
            <Barcode className="w-4 h-4 text-kirana-600 dark:text-kirana-400" />
            <span>Scan Barcode</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
            Status:
          </span>
          {[
            { id: 'all', label: 'All Items' },
            { id: 'low', label: 'Low Stock' },
            { id: 'out', label: 'Out of Stock' },
            { id: 'expiring', label: 'Expiring in 30d' },
            { id: 'archived', label: 'Archived' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStockStatusFilter(st.id as any)}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                stockStatusFilter === st.id
                  ? 'bg-kirana-700 text-white shadow-sm font-bold'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table / Mobile List */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-3">
            <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-600 dark:text-slate-400 text-sm">
              No products found in store inventory
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Get started instantly by selecting from our pre-built library of 60+ common Indian grocery items!
            </p>
            <button
              onClick={() => setIsCatalogModalOpen(true)}
              className="px-4 py-2 bg-kirana-700 text-white rounded-xl text-xs font-bold shadow-md hover:bg-kirana-800 transition-all inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span>Select from Master Catalog</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Item Details</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Purchase Price</th>
                  <th className="py-3 px-3 text-right">Selling Price</th>
                  <th className="py-3 px-3 text-center">Stock Available</th>
                  <th className="py-3 px-3 text-right">Stock Value</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredProducts.map((p) => {
                  const isOut = p.stockQuantity <= 0;
                  const isLow = p.stockQuantity > 0 && p.stockQuantity <= p.minStockThreshold;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-750 transition-colors ${
                        p.isArchived ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5 flex-wrap">
                          {p.brand && <span className="font-sans font-medium text-slate-500">{p.brand}</span>}
                          {p.barcode && <span>• Barcode: {p.barcode}</span>}
                          {p.addedByTerminal && (
                            <span className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded text-[9px]">
                              Entry by: {p.addedByTerminal}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                        {p.category}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {p.purchasePrice > 0 ? formatINR(p.purchasePrice) : <span className="text-slate-400 text-[11px]">₹0</span>}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                        {formatINR(p.sellingPrice)}
                        <span className="text-[10px] font-normal text-slate-400">/{p.unit}</span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={`font-black px-2 py-0.5 rounded-full text-[11px] ${
                              isOut
                                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                : isLow
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}
                          >
                            {p.stockQuantity} {p.unit}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-kirana-700 dark:text-kirana-400">
                        {formatINR(Math.max(0, p.stockQuantity) * p.sellingPrice)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openStockAdjustModal(p)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold"
                            title="Adjust quantity"
                          >
                            Stock ±
                          </button>
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
                            title="Edit Product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleArchiveProduct(p)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-600"
                            title={p.isArchived ? 'Restore Product' : 'Archive Product'}
                          >
                            {p.isArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MASTER GROCERY CATALOG MODAL (Fast 1-click product addition) */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-kirana-900 to-kirana-800 text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-kirana-700 rounded-xl">
                  <Sparkles className="w-5 h-5 text-yellow-300" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    Master Indian Kirana Catalog
                  </h3>
                  <p className="text-xs text-kirana-200">
                    Select popular FMCG & grocery items to add to your store in seconds
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className="p-1.5 text-kirana-200 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search and Category Filter in Catalog */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50 dark:bg-slate-800/40">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search catalog by product name, brand (e.g. Parle, Tata, Amul, Fortune)..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-kirana-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
                {catalogCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCatalogCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                      catalogCategory === cat
                        ? 'bg-kirana-700 text-white shadow-sm font-bold'
                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Items Grid */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredCatalogItems.map((item) => {
                  const isAlreadyInStore = products.some((p) => p.barcode === item.barcode);
                  const isChecked = selectedCatalogItems.has(item.barcode);

                  return (
                    <div
                      key={item.barcode}
                      className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                        isAlreadyInStore
                          ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 opacity-70'
                          : isChecked
                          ? 'bg-kirana-50 dark:bg-kirana-950/40 border-kirana-500 shadow-sm'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-kirana-400'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {item.brand} • {item.category}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 mt-0.5">
                              {item.name}
                            </h4>
                          </div>

                          {!isAlreadyInStore && (
                            <button
                              onClick={() => {
                                const next = new Set(selectedCatalogItems);
                                if (isChecked) next.delete(item.barcode);
                                else next.add(item.barcode);
                                setSelectedCatalogItems(next);
                              }}
                              className="text-kirana-700 dark:text-kirana-400 p-1 shrink-0"
                            >
                              {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-300" />}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2">
                          <span>MRP: <strong className="text-slate-800 dark:text-white">{formatINR(item.typicalSellingPrice)}</strong></span>
                          <span>Cost: ~{formatINR(item.typicalPurchasePrice)}</span>
                          <span className="font-mono text-[10px] text-slate-400">{item.barcode}</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                        {isAlreadyInStore ? (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Already in Store
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setIsCatalogModalOpen(false);
                              openNewModal();
                              applyCatalogItemToForm(item);
                            }}
                            className="px-3 py-1 bg-kirana-700 hover:bg-kirana-800 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Customize & Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Catalog Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <span className="text-xs text-slate-500 font-medium">
                {selectedCatalogItems.size} items selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCatalogModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Close
                </button>
                {selectedCatalogItems.size > 0 && (
                  <button
                    onClick={handleAddSelectedCatalogItems}
                    className="px-4 py-2 bg-kirana-700 hover:bg-kirana-800 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add {selectedCatalogItems.size} Selected Items to Store</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT PRODUCT MODAL */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                {editingProduct ? 'Edit Store Product' : 'Add Product to Inventory'}
              </h3>
              <button
                onClick={() => setIsAddEditOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {autoFillNotice && (
              <div className="m-4 mb-0 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{autoFillNotice}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 text-xs">
              {/* Product Name with autocomplete datalist */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Product Name *
                  </label>
                  <span className="text-[10px] text-kirana-600 dark:text-kirana-400 font-medium">
                    Type or pick from dropdown of old items
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    list="known-products-datalist"
                    placeholder="Type or select e.g. Tata Salt, Maggi, Atta..."
                    value={formName}
                    onChange={(e) => handleNameInputChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                    autoFocus
                  />
                  <datalist id="known-products-datalist">
                    {allKnownProducts.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.brand ? `[${item.brand}] ` : ''}MRP: ₹{item.sellingPrice || 0}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Barcode with Direct Camera Scanner Button */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Product Barcode / QR Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setScannerTarget('formBarcode');
                      setIsScannerOpen(true);
                    }}
                    className="text-[11px] text-kirana-700 dark:text-kirana-400 font-bold flex items-center gap-1 hover:underline"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan Barcode Camera</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Scan or enter barcode (Auto-detects from catalog)"
                    value={formBarcode}
                    onChange={(e) => handleBarcodeChange(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 font-mono text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setScannerTarget('formBarcode');
                      setIsScannerOpen(true);
                    }}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-kirana-600"
                    title="Scan with Camera"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Category & Brand */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Grains & Sugar, Atta, Edible Oils"
                    value={formCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    list="category-suggestions"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <datalist id="category-suggestions">
                    {catalogCategories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. Aashirvaad, Tata, Amul, Generic / Loose"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Unit, Purchase Price, Selling Price */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Unit Type *
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value as UnitType)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-xs"
                  >
                    <option value="kg">kg (Kilogram - for loose Sugar, Rice, Dal, Atta, Grains)</option>
                    <option value="g">g (Gram - for loose Spices, Dry Fruits)</option>
                    <option value="litre">litre (Litre - for loose/bottle Oil, Ghee, Milk)</option>
                    <option value="ml">ml (Millilitre - for liquids)</option>
                    <option value="packet">packet (Packet - packaged Biscuits, Snacks, Soaps)</option>
                    <option value="piece">piece (Piece - single items)</option>
                    <option value="box">box (Box)</option>
                    <option value="bottle">bottle (Bottle)</option>
                    <option value="carton">carton (Carton)</option>
                    <option value="dozen">dozen (Dozen)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Cost Price (₹/{formUnit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder={formUnit === 'kg' ? 'e.g. 38' : 'e.g. 120'}
                    value={formPurchasePrice}
                    onChange={(e) => setFormPurchasePrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Selling Price (₹/{formUnit}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder={formUnit === 'kg' ? 'e.g. 44' : 'e.g. 140'}
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>

              {/* Retail Loose Kirana Item Informative Banner */}
              {['kg', 'litre', 'g', 'ml'].includes(formUnit) && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
                  <span className="text-lg leading-none">⚖️</span>
                  <div>
                    <span className="font-bold">Retail Loose Grocery Item ({formUnit.toUpperCase()}): </span>
                    Enter bulk warehouse stock (e.g. <strong>100 kg</strong> sugar or <strong>15 litre</strong> oil). In POS billing, this loose item is sold in retail customer amounts (<strong>100g, 250g, 500g, 1kg</strong>) or exact rupee amounts (e.g. <strong>₹10 sugar</strong>).
                  </div>
                </div>
              )}

              {/* Initial Stock Quantity & Low Stock Threshold */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Stock Quantity ({formUnit}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder={formUnit === 'kg' ? 'e.g. 100' : formUnit === 'litre' ? 'e.g. 15' : 'e.g. 10'}
                    value={formStockQuantity}
                    onChange={(e) => setFormStockQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Low Stock Alert At ({formUnit})
                  </label>
                  <input
                    type="number"
                    value={formMinThreshold}
                    onChange={(e) => setFormMinThreshold(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Supplier & Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Supplier / Depot</label>
                  <input
                    type="text"
                    placeholder="e.g. Local FMCG Agency"
                    value={formSupplierName}
                    onChange={(e) => setFormSupplierName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-kirana-700 hover:bg-kirana-800 text-white font-bold rounded-xl shadow-md"
                >
                  {editingProduct ? 'Update Product' : 'Save Product to Store'}
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
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-700">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Adjust Stock: {adjustingProduct.name}
              </h3>
              <button
                onClick={() => setIsAdjustStockOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStockAdjustSubmit} className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between">
                <span>Current Recorded Stock:</span>
                <span className="font-extrabold text-kirana-800 dark:text-kirana-400">
                  {adjustingProduct.stockQuantity} {adjustingProduct.unit}
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Adjustment Action</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('manual_in')}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      adjustType === 'manual_in'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300'
                    }`}
                  >
                    + Add Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('manual_out')}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      adjustType === 'manual_out'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300'
                    }`}
                  >
                    - Reduce Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('damage')}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      adjustType === 'damage'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300'
                    }`}
                  >
                    Damage / Lost
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Quantity to Adjust ({adjustingProduct.unit}) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 5"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-bold"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Reason / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Physical count reconciliation, extra pack arrived"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustStockOpen(false)}
                  className="px-3 py-1.5 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-kirana-700 text-white font-bold rounded-xl shadow-md"
                >
                  Apply Stock Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock History Audit Log Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 text-xs">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-kirana-600" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Stock Movement Audit Log (Recent 50)
                </h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b text-[10px] uppercase font-bold text-slate-400">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3 text-right">Change</th>
                    <th className="py-2 px-3 text-right">Stock After</th>
                    <th className="py-2 px-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stockMovements.map((mov) => (
                    <tr key={mov.id}>
                      <td className="py-2 px-3 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                        {formatDate(mov.date)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {mov.productName}
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {mov.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        <span className={mov.quantityChange > 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {mov.quantityChange > 0 ? `+${mov.quantityChange}` : mov.quantityChange}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {mov.quantityAfter}
                      </td>
                      <td className="py-2 px-3 text-slate-500 text-[11px]">
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

      {/* Fast Barcode Camera Scanner */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
      />
    </div>
  );
};
