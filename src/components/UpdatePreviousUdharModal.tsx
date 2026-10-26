import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../db';
import type { Customer } from '../types';
import { formatINR } from '../utils/formatters';
import {
  X,
  CreditCard,
  User,
  AlertCircle,
  CheckCircle,
  Plus,
  Minus,
  Edit3,
  Calendar,
  History
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
  customersList?: Customer[];
  onSuccess?: (updatedCustomer: Customer) => void;
}

export const UpdatePreviousUdharModal: React.FC<Props> = ({
  isOpen,
  onClose,
  customer,
  customersList = [],
  onSuccess,
}) => {
  const [selectedCust, setSelectedCust] = useState<Customer | null>(customer || null);
  const [searchCust, setSearchCust] = useState('');
  const [adjustmentMode, setAdjustmentMode] = useState<'add' | 'set_direct' | 'deduct'>('add');
  const [amountStr, setAmountStr] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (customer) {
      setSelectedCust(customer);
    }
  }, [customer]);

  useEffect(() => {
    if (isOpen) {
      setAmountStr('');
      setCustomDate('');
      setNotes('Previous Udhar / पिछला बकाया (Old Balance)');
      setErrorMsg('');
      if (customer) setSelectedCust(customer);
    }
  }, [isOpen, customer]);

  const filteredCustomers = useMemo(() => {
    if (!searchCust.trim()) return customersList.slice(0, 8);
    const q = searchCust.toLowerCase().trim();
    return customersList.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [customersList, searchCust]);

  if (!isOpen) return null;

  const currentBal = selectedCust?.outstandingUdhar || 0;
  const inputAmt = parseFloat(amountStr) || 0;

  // Calculate new balance
  let newBalance = currentBal;
  let diff = 0;
  if (adjustmentMode === 'add') {
    newBalance = currentBal + inputAmt;
    diff = inputAmt;
  } else if (adjustmentMode === 'set_direct') {
    newBalance = Math.max(0, inputAmt);
    diff = newBalance - currentBal;
  } else if (adjustmentMode === 'deduct') {
    newBalance = Math.max(0, currentBal - inputAmt);
    diff = -Math.min(currentBal, inputAmt);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!selectedCust || !selectedCust.id) {
      setErrorMsg('Please select a customer first.');
      return;
    }

    if (inputAmt <= 0 && adjustmentMode !== 'set_direct') {
      setErrorMsg('Please enter a valid amount greater than ₹0.');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const entryDate = customDate.trim()
        ? new Date(customDate).toISOString()
        : now;

      const dateNote = customDate.trim() ? '' : ' [Date not specified / तारीख याद नहीं]';
      const cleanNotes = (notes.trim() || 'Previous Udhar / पिछला बकाया') + dateNote;

      let savedCustomer: Customer | undefined;

      await db.transaction('rw', [db.customers, db.udharLedger], async () => {
        // 1. Update customer's outstandingUdhar
        await db.customers.update(selectedCust.id!, {
          outstandingUdhar: newBalance,
          updatedAt: now,
        });

        savedCustomer = await db.customers.get(selectedCust.id!);

        // 2. Add an adjustment entry in udharLedger
        await db.udharLedger.add({
          customerId: selectedCust.id!,
          customerName: selectedCust.name,
          customerPhone: selectedCust.phone,
          type: 'adjustment',
          amount: Math.abs(diff),
          balanceAfter: newBalance,
          notes: `${cleanNotes} • ${diff >= 0 ? `+${formatINR(diff)} added` : `-${formatINR(Math.abs(diff))} adjusted`}`,
          date: entryDate,
        });
      });

      if (savedCustomer && onSuccess) {
        onSuccess(savedCustomer);
      }
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update udhar.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-red-800 to-rose-700 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                Update Previous Udhaar (पिछला उधार)
              </h3>
              <p className="text-[11px] text-rose-100">
                Update old debt anytime — no past date needed
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

        {/* Content Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Selection if not pre-provided */}
          {!customer && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Select Customer (ग्राहक चुनें) *
              </label>
              {selectedCust ? (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-xs">
                      {selectedCust.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono">{selectedCust.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCust(null)}
                    className="text-[11px] text-kirana-700 dark:text-kirana-400 font-bold hover:underline"
                  >
                    Change Customer
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Search customer by name or phone..."
                    value={searchCust}
                    onChange={(e) => setSearchCust(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-kirana-500"
                  />
                  <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredCustomers.length === 0 ? (
                      <p className="p-3 text-center text-slate-400">No matching customer found.</p>
                    ) : (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCust(c)}
                          className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between transition-colors"
                        >
                          <div>
                            <span className="font-bold text-slate-800 dark:text-white block">
                              {c.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{c.phone}</span>
                          </div>
                          <span className="font-bold text-red-600 text-xs">
                            {formatINR(c.outstandingUdhar)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Current Balance Display Card */}
          {selectedCust && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Current Khata Balance:
                </span>
                <span className="font-extrabold text-sm text-slate-800 dark:text-white">
                  {selectedCust.name}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400 block">Current Udhaar:</span>
                <span className="text-base font-black text-red-600">
                  {formatINR(selectedCust.outstandingUdhar)}
                </span>
              </div>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Adjustment Type (बदलाव का तरीका)
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setAdjustmentMode('add')}
                className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-all ${
                  adjustmentMode === 'add'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Plus className="w-3 h-3" />
                <span>Add Old Udhar</span>
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentMode('set_direct')}
                className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-all ${
                  adjustmentMode === 'set_direct'
                    ? 'bg-kirana-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Edit3 className="w-3 h-3" />
                <span>Set Direct Total</span>
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentMode('deduct')}
                className={`py-2 rounded-lg flex items-center justify-center gap-1 transition-all ${
                  adjustmentMode === 'deduct'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Minus className="w-3 h-3" />
                <span>Reduce Udhar</span>
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                {adjustmentMode === 'add' && 'Amount to Add (₹ पुराना उधार जोड़ें) *'}
                {adjustmentMode === 'set_direct' && 'Direct Total Udhar Amount (₹ नया कुल बकाया) *'}
                {adjustmentMode === 'deduct' && 'Amount to Reduce / Waive (₹ घटाने वाली राशि) *'}
              </label>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-base font-bold text-slate-400">₹</span>
              <input
                type="number"
                step="any"
                min="0"
                required
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 text-base font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
              />
            </div>
            {/* Quick Amount Suggestion Chips */}
            <div className="flex gap-1.5 overflow-x-auto pt-1 scrollbar-none">
              {[50, 100, 200, 500, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmountStr(amt.toString())}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-all shrink-0"
                >
                  +{formatINR(amt)}
                </button>
              ))}
            </div>
          </div>

          {/* Balance Preview Card */}
          {selectedCust && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
                  New Udhaar Balance (नया कुल बकाया):
                </span>
                <span className="text-lg font-black text-red-600">
                  {formatINR(newBalance)}
                </span>
              </div>
              <div className="text-right">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  diff > 0
                    ? 'bg-red-100 text-red-700'
                    : diff < 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {diff > 0 ? `+${formatINR(diff)}` : diff < 0 ? `-${formatINR(Math.abs(diff))}` : 'No change'}
                </span>
              </div>
            </div>
          )}

          {/* Date Field (OPTIONAL - Explicitly noted) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Date / तारीख (Optional - तारीख याद न हो तो छोड़ें)
              </label>
              <span className="text-[10px] text-slate-400">Optional</span>
            </div>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs focus:ring-1 focus:ring-kirana-500"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              💡 <em>अगर आपको तारीख याद नहीं है, तो इसे खाली छोड़ दें। यह तुरंत &ldquo;पिछला हिसाब (Old Udhar)&rdquo; के रूप में सेव हो जाएगा।</em>
            </p>
          </div>

          {/* Notes / Reason */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300">
              Note / Remarks (विवरण / टिप्पणी)
            </label>
            <input
              type="text"
              placeholder="e.g. Previous notebook balance / पुराना डायरी का हिसाब"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs focus:ring-1 focus:ring-kirana-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !selectedCust}
              className="px-5 py-2.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Udhar Balance (सहेजें)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
