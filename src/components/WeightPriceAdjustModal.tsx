import React, { useState, useEffect } from 'react';
import type { CartItem } from '../types';
import {
  formatINR,
  KG_PRESETS,
  LITRE_PRESETS,
  GRAM_PRESETS,
  ML_PRESETS,
  WeightPreset
} from '../utils/formatters';
import {
  X,
  Scale,
  IndianRupee,
  Check,
  RotateCcw,
  Sparkles,
  Calculator
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: CartItem | null;
  onSave: (updatedItem: CartItem) => void;
}

export const WeightPriceAdjustModal: React.FC<Props> = ({
  isOpen,
  onClose,
  item,
  onSave,
}) => {
  const [activeUnitTab, setActiveUnitTab] = useState<'sub' | 'base'>('sub'); // 'sub' = gm or ml, 'base' = kg or litre
  const [subUnitInput, setSubUnitInput] = useState<string>(''); // e.g. "250" gm
  const [baseUnitInput, setBaseUnitInput] = useState<string>(''); // e.g. "0.25" kg
  const [unitPriceInput, setUnitPriceInput] = useState<string>(''); // e.g. "120"
  const [rupeesWorthInput, setRupeesWorthInput] = useState<string>(''); // e.g. "20"
  const [directTotalInput, setDirectTotalInput] = useState<string>(''); // e.g. "10"
  const [pricingMode, setPricingMode] = useState<'rate' | 'worth' | 'direct_total'>('rate');
  const [subUnitLabel, setSubUnitLabel] = useState<string>('');

  useEffect(() => {
    if (item && isOpen) {
      const isWeight = ['kg', 'g'].includes(item.product.unit);
      const isVolume = ['litre', 'ml'].includes(item.product.unit);

      // Default inputs from item
      const qty = item.quantity;
      setBaseUnitInput(qty.toString());
      setUnitPriceInput(item.unitPrice.toString());
      setDirectTotalInput(item.total.toString());
      setRupeesWorthInput('');
      setSubUnitLabel(item.subUnitLabel || '');
      setPricingMode(item.isCustomPrice ? 'rate' : 'rate');

      if (item.product.unit === 'kg') {
        const gm = Math.round(qty * 1000);
        setSubUnitInput(gm.toString());
        setActiveUnitTab(qty < 1 ? 'sub' : 'base');
      } else if (item.product.unit === 'litre') {
        const ml = Math.round(qty * 1000);
        setSubUnitInput(ml.toString());
        setActiveUnitTab(qty < 1 ? 'sub' : 'base');
      } else {
        setSubUnitInput(qty.toString());
        setActiveUnitTab('base');
      }
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const unit = item.product.unit;
  const isKg = unit === 'kg';
  const isLitre = unit === 'litre';
  const isFractional = isKg || isLitre;

  const subUnitName = isKg ? 'gm (ग्राम)' : isLitre ? 'ml (मिलीलीटर)' : unit;
  const baseUnitName = isKg ? 'kg (किलो)' : isLitre ? 'litre (लीटर)' : unit;

  // Handler when user types in sub-unit (grams or ml)
  const handleSubUnitChange = (val: string) => {
    setSubUnitInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (isKg || isLitre) {
        const baseVal = Math.round((num / 1000) * 10000) / 10000;
        setBaseUnitInput(baseVal.toString());
        setSubUnitLabel(`${num}${isKg ? 'g' : 'ml'}`);
        // Update direct total preview
        const rate = parseFloat(unitPriceInput) || item.unitPrice;
        setDirectTotalInput(((baseVal * rate) - item.discount).toFixed(2));
      } else {
        setBaseUnitInput(num.toString());
      }
    }
  };

  // Handler when user types in base unit (kg or litre)
  const handleBaseUnitChange = (val: string) => {
    setBaseUnitInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (isKg || isLitre) {
        const subVal = Math.round(num * 1000);
        setSubUnitInput(subVal.toString());
        setSubUnitLabel(num < 1 ? `${subVal}${isKg ? 'g' : 'ml'}` : `${num} ${unit}`);
        const rate = parseFloat(unitPriceInput) || item.unitPrice;
        setDirectTotalInput(((num * rate) - item.discount).toFixed(2));
      } else {
        setSubUnitInput(num.toString());
      }
    }
  };

  // Preset chip clicked
  const handleSelectPreset = (preset: WeightPreset) => {
    setBaseUnitInput(preset.qty.toString());
    setSubUnitLabel(preset.label);
    if (isKg || isLitre) {
      setSubUnitInput(Math.round(preset.qty * 1000).toString());
    }
    const rate = parseFloat(unitPriceInput) || item.unitPrice;
    setDirectTotalInput(((preset.qty * rate) - item.discount).toFixed(2));
  };

  // Target Rupees ("₹20 ka item") calculation
  const handleRupeesWorthChange = (rupeesStr: string) => {
    setRupeesWorthInput(rupeesStr);
    const rupees = parseFloat(rupeesStr);
    const currentRate = parseFloat(unitPriceInput) || item.unitPrice;

    if (!isNaN(rupees) && rupees > 0 && currentRate > 0) {
      // Calculate quantity
      const calculatedQty = Math.round((rupees / currentRate) * 10000) / 10000;
      setBaseUnitInput(calculatedQty.toString());
      setDirectTotalInput(rupees.toFixed(2));

      if (isKg || isLitre) {
        const subVal = Math.round(calculatedQty * 1000);
        setSubUnitInput(subVal.toString());
        setSubUnitLabel(`${subVal}${isKg ? 'g' : 'ml'}`);
      }
    }
  };

  // Rate change
  const handleRateChange = (newRateStr: string) => {
    setUnitPriceInput(newRateStr);
    const rate = parseFloat(newRateStr);
    const qty = parseFloat(baseUnitInput) || item.quantity;
    if (!isNaN(rate) && rate >= 0) {
      setDirectTotalInput(((qty * rate) - item.discount).toFixed(2));
    }
  };

  // Reset to default rate
  const handleResetRate = () => {
    const originalRate = item.product.sellingPrice;
    setUnitPriceInput(originalRate.toString());
    const qty = parseFloat(baseUnitInput) || item.quantity;
    setDirectTotalInput(((qty * originalRate) - item.discount).toFixed(2));
  };

  // Confirm save
  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();

    const finalQty = parseFloat(baseUnitInput);
    if (isNaN(finalQty) || finalQty <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }

    if (finalQty > item.product.stockQuantity) {
      alert(`Entered quantity (${finalQty} ${unit}) exceeds available stock (${item.product.stockQuantity} ${unit}).`);
      return;
    }

    const currentRate = parseFloat(unitPriceInput) || item.product.sellingPrice;
    let finalTotal = (finalQty * currentRate) - item.discount;

    if (pricingMode === 'direct_total') {
      const overrideTotal = parseFloat(directTotalInput);
      if (!isNaN(overrideTotal) && overrideTotal >= 0) {
        finalTotal = overrideTotal;
      }
    } else if (pricingMode === 'worth') {
      const worthTotal = parseFloat(rupeesWorthInput);
      if (!isNaN(worthTotal) && worthTotal > 0) {
        finalTotal = worthTotal;
      }
    }

    const isPriceChanged = currentRate !== item.product.sellingPrice || finalTotal !== ((finalQty * item.product.sellingPrice) - item.discount);

    const updatedItem: CartItem = {
      ...item,
      quantity: finalQty,
      unitPrice: currentRate,
      total: Math.max(0, finalTotal),
      subUnitLabel: subUnitLabel.trim() || undefined,
      isCustomPrice: isPriceChanged,
    };

    onSave(updatedItem);
    onClose();
  };

  const presets = isKg ? KG_PRESETS : isLitre ? LITRE_PRESETS : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-kirana-800 to-emerald-700 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Scale className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                Adjust Weight & Price (वजन व कीमत)
              </h3>
              <p className="text-[11px] text-emerald-100 truncate max-w-[240px] sm:max-w-xs font-semibold">
                {item.product.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleConfirm} className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
          {/* Stock & Default Price Summary Banner */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Store Base Selling Rate:
              </span>
              <span className="font-extrabold text-sm text-slate-800 dark:text-white">
                {formatINR(item.product.sellingPrice)} / {item.product.unit}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Available Stock:
              </span>
              <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                {item.product.stockQuantity} {item.product.unit} in store
              </span>
            </div>
          </div>

          {/* 1. WEIGHT / QUANTITY SELECTION */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-kirana-600" />
                <span>1. Select Weight / Quantity (वजन चुनें) *</span>
              </label>

              {isFractional && (
                <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveUnitTab('sub')}
                    className={`px-2 py-1 rounded-md transition-all ${
                      activeUnitTab === 'sub'
                        ? 'bg-white dark:bg-slate-800 text-kirana-700 dark:text-white shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    In {isKg ? 'Grams (gm)' : 'ml'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveUnitTab('base')}
                    className={`px-2 py-1 rounded-md transition-all ${
                      activeUnitTab === 'base'
                        ? 'bg-white dark:bg-slate-800 text-kirana-700 dark:text-white shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    In {isKg ? 'Kg (किलो)' : 'Litres'}
                  </button>
                </div>
              )}
            </div>

            {/* Quick Weight Chips (25g, 50g, 100g, 250g, 500g, 1kg, etc.) */}
            {isFractional && (
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold block">
                  Quick 1-Tap Weight Chips (दबाकर चुनें):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((preset) => {
                    const isSelected = Math.abs(parseFloat(baseUnitInput) - preset.qty) < 0.001;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          isSelected
                            ? 'bg-kirana-700 text-white border-kirana-700 shadow-sm scale-105'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Weight Input */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {isFractional ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Grams / ml ({subUnitName}):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="1"
                        placeholder="e.g. 25, 250"
                        value={subUnitInput}
                        onChange={(e) => handleSubUnitChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-kirana-500"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">
                        {isKg ? 'gm' : 'ml'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      In Base Unit ({baseUnitName}):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        placeholder="e.g. 0.25"
                        value={baseUnitInput}
                        onChange={(e) => handleBaseUnitChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-kirana-500"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">
                        {item.product.unit}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Quantity ({item.product.unit}):
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={baseUnitInput}
                    onChange={(e) => handleBaseUnitChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-kirana-500"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700" />

          {/* 2. PRICE & RATE ADJUSTMENT SECTION */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-emerald-600" />
                <span>2. Price & Rate Adjustment (कीमत व दर तय करें)</span>
              </label>

              {parseFloat(unitPriceInput) !== item.product.sellingPrice && (
                <button
                  type="button"
                  onClick={handleResetRate}
                  className="text-[10px] text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset to Store Price
                </button>
              )}
            </div>

            {/* Pricing Mode Selector */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setPricingMode('rate')}
                className={`py-2 rounded-lg transition-all ${
                  pricingMode === 'rate'
                    ? 'bg-kirana-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Rate (₹/{item.product.unit})
              </button>
              <button
                type="button"
                onClick={() => setPricingMode('worth')}
                className={`py-2 rounded-lg transition-all ${
                  pricingMode === 'worth'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                ₹ Worth (रुपये का माल)
              </button>
              <button
                type="button"
                onClick={() => setPricingMode('direct_total')}
                className={`py-2 rounded-lg transition-all ${
                  pricingMode === 'direct_total'
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Fixed Item Total (₹)
              </button>
            </div>

            {/* Mode A: Adjust Rate per Unit */}
            {pricingMode === 'rate' && (
              <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                  Selling Rate for this Customer (₹ per {item.product.unit}):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Enter rate"
                    value={unitPriceInput}
                    onChange={(e) => handleRateChange(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-sm font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-kirana-500"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto pt-1">
                  {[-5, -10, +5, +10].map((adj) => (
                    <button
                      key={adj}
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(unitPriceInput) || item.product.sellingPrice;
                        handleRateChange(Math.max(0, cur + adj).toString());
                      }}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-[10px] font-semibold text-slate-700 dark:text-slate-200"
                    >
                      {adj > 0 ? `+₹${adj}` : `-₹${Math.abs(adj)}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mode B: Sell by Fixed Rupees ("₹20 ka jeera", "₹50 ka tel") */}
            {pricingMode === 'worth' && (
              <div className="space-y-2 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                <div>
                  <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 block">
                    Customer Wants Item of Fixed Rupees (रुपये के हिसाब से):
                  </label>
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
                    Auto-calculates the exact weight for this amount based on rate ₹{unitPriceInput}/{item.product.unit}.
                  </p>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-emerald-600">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="e.g. 10, 20, 50, 100"
                    value={rupeesWorthInput}
                    onChange={(e) => handleRupeesWorthChange(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-sm font-bold bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {/* Fast Rupees Suggestions */}
                <div className="flex gap-1.5 overflow-x-auto pt-0.5">
                  {[10, 20, 30, 50, 100, 200].map((rs) => (
                    <button
                      key={rs}
                      type="button"
                      onClick={() => handleRupeesWorthChange(rs.toString())}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-emerald-300 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                    >
                      ₹{rs}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mode C: Direct Total Override */}
            {pricingMode === 'direct_total' && (
              <div className="space-y-1.5 bg-blue-50 dark:bg-blue-950/40 p-3 rounded-2xl border border-blue-200 dark:border-blue-800">
                <label className="text-[11px] font-bold text-blue-900 dark:text-blue-200 block">
                  Override Item Total Directly (कुल कीमत राउंड-ऑफ या बदलें):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-blue-600">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Enter final total for this item"
                    value={directTotalInput}
                    onChange={(e) => setDirectTotalInput(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-sm font-bold bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[10px] text-blue-700 dark:text-blue-300">
                  Overrides the calculated price for loose items or counter bargaining.
                </p>
              </div>
            )}
          </div>

          {/* FINAL PREVIEW CARD */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-kirana-50 to-emerald-50 dark:from-slate-900 dark:to-slate-900 border border-kirana-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                Bill Line Summary (बिल में दर्ज होगा):
              </span>
              <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                {subUnitLabel ? `${subUnitLabel} (${baseUnitInput} ${unit})` : `${baseUnitInput} ${unit}`}
              </span>
              <span className="text-[11px] text-slate-500 block">
                @ {formatINR(parseFloat(unitPriceInput) || item.unitPrice)} / {item.product.unit}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Item Total:
              </span>
              <span className="text-xl font-black text-kirana-800 dark:text-kirana-400">
                {formatINR(parseFloat(directTotalInput) || 0)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-kirana-700 hover:bg-kirana-800 text-white font-extrabold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Apply to Bill (बिल में जोड़ें)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
