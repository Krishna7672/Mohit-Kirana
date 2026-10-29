import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { triggerBackgroundCloudSync } from '../db/supabaseSync';
import type { Customer, UdharEntry, StoreSettings } from '../types';
import { formatINR, formatDate, formatDateTime } from '../utils/formatters';
import { buildUdharReminderMessage, getWhatsAppClickUrl, getSmsClickUrl, type UdharRepaymentReceiptInfo } from '../utils/notifications';
import { UpdatePreviousUdharModal } from '../components/UpdatePreviousUdharModal';
import { RepaymentReceiptModal } from '../components/RepaymentReceiptModal';
import {
  BookOpen,
  CreditCard,
  Search,
  MessageCircle,
  Smartphone,
  Printer,
  History,
  DollarSign,
  AlertCircle,
  X,
  CheckCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Share2
} from 'lucide-react';

interface Props {
  settings: StoreSettings;
}

export const UdharKhataView: React.FC<Props> = ({ settings }) => {
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const ledgerEntries = useLiveQuery(() => db.udharLedger.reverse().toArray()) || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  // Previous Udhar Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingCustomer, setAdjustingCustomer] = useState<Customer | null>(null);

  // Repayment Modal
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);
  const [repayingCustomer, setRepayingCustomer] = useState<Customer | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState<'cash' | 'upi'>('cash');
  const [repayNotes, setRepayNotes] = useState('');

  // Repayment Receipt Share Modal
  const [repaymentReceiptInfo, setRepaymentReceiptInfo] = useState<UdharRepaymentReceiptInfo | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Total outstanding udhar
  const totalUdhar = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.outstandingUdhar || 0), 0);
  }, [customers]);

  // Customers with pending udhar
  const udharCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customers
      .filter((c) => c.outstandingUdhar > 0)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q))
      .sort((a, b) => b.outstandingUdhar - a.outstandingUdhar);
  }, [customers, searchQuery]);

  // Selected customer ledger history
  const activeCustomer = useMemo(() => {
    if (!selectedCustomerId) return udharCustomers[0] || null;
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId, udharCustomers]);

  const activeCustomerHistory = useMemo(() => {
    if (!activeCustomer?.id) return [];
    return ledgerEntries.filter((e) => e.customerId === activeCustomer.id);
  }, [ledgerEntries, activeCustomer]);

  // Execute Repayment
  const handleConfirmRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayingCustomer?.id) return;

    const amt = parseFloat(repayAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    if (amt > repayingCustomer.outstandingUdhar) {
      alert(`Amount exceeds outstanding balance of ${formatINR(repayingCustomer.outstandingUdhar)}.`);
      return;
    }

    const now = new Date().toISOString();
    const newBal = repayingCustomer.outstandingUdhar - amt;

    await db.transaction('rw', [db.customers, db.udharLedger], async () => {
      // 1. Update customer balance
      await db.customers.update(repayingCustomer.id!, {
        outstandingUdhar: newBal,
        updatedAt: now,
      });

      // 2. Add ledger entry (NOT counted as sales revenue)
      await db.udharLedger.add({
        customerId: repayingCustomer.id!,
        customerName: repayingCustomer.name,
        customerPhone: repayingCustomer.phone,
        type: 'repayment',
        amount: amt,
        balanceAfter: newBal,
        paymentMethod: repayMethod,
        notes: repayNotes.trim() || `Udhar repayment received via ${repayMethod.toUpperCase()}`,
        date: now,
      });
    });

    const paymentReceipt: UdharRepaymentReceiptInfo = {
      customerName: repayingCustomer.name,
      phone: repayingCustomer.phone,
      amountPaid: amt,
      remainingBalance: newBal,
      paymentMethod: repayMethod,
      date: now,
      notes: repayNotes.trim(),
    };

    setIsRepayModalOpen(false);
    setRepayAmount('');
    setRepayNotes('');
    setRepayingCustomer(null);
    triggerBackgroundCloudSync();

    setRepaymentReceiptInfo(paymentReceipt);
    setIsReceiptModalOpen(true);
  };

  const handlePrintStatement = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-red-800 via-rose-700 to-red-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-200 text-xs font-semibold mb-1">
            <BookOpen className="w-4 h-4" />
            <span>Customer Credit Ledger (Udhar Khata)</span>
          </div>
          <h2 className="text-2xl lg:text-3xl font-black tracking-tight">
            Total Market Udhar: {formatINR(totalUdhar)}
          </h2>
          <p className="text-rose-100/90 text-xs mt-1">
            {udharCustomers.length} customers have active credit balances. Track repayments separately from daily sales.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => {
              setAdjustingCustomer(activeCustomer || null);
              setIsAdjustModalOpen(true);
            }}
            className="px-3.5 py-2.5 bg-amber-400 hover:bg-amber-300 text-red-950 rounded-xl font-black text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95"
            title="Update previous udhaar without needing a date"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Update Previous Udhar (पिछला उधार)</span>
          </button>

          {activeCustomer && (
            <>
              <button
                onClick={() => {
                  setRepayingCustomer(activeCustomer);
                  setIsRepayModalOpen(true);
                }}
                className="px-4 py-2.5 bg-white text-red-800 hover:bg-rose-50 rounded-xl font-extrabold text-xs shadow-md transition-all"
              >
                Receive Repayment
              </button>
              <button
                onClick={handlePrintStatement}
                className="p-2.5 bg-red-900/60 hover:bg-red-900 text-white rounded-xl transition-all"
                title="Print Customer Statement"
              >
                <Printer className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Grid: Left List (Customers with Udhar) & Right Ledger Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Customers with Udhar (Cols 5) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search khata by party name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 max-h-[550px] pr-1">
            {udharCustomers.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No outstanding udhar! All customers have clear accounts.
              </div>
            ) : (
              udharCustomers.map((c) => {
                const isSelected = activeCustomer?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id!)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-rose-50 dark:bg-rose-950/40 border-red-300 dark:border-red-800 shadow-sm'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {c.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-mono">{c.phone}</p>
                      </div>
                      <span className="text-sm font-black text-red-600">
                        {formatINR(c.outstandingUdhar)}
                      </span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">
                        Last Purchase: {formatDate(c.lastPurchaseDate)}
                      </span>
                      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            const msg = buildUdharReminderMessage(c, settings);
                            window.open(getWhatsAppClickUrl(c.phone, msg), '_blank');
                          }}
                          className="p-1 text-emerald-700 hover:bg-emerald-50 rounded"
                          title="Send WhatsApp Reminder"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            const msg = buildUdharReminderMessage(c, settings);
                            window.location.href = getSmsClickUrl(c.phone, msg);
                          }}
                          className="p-1 text-blue-700 hover:bg-blue-50 rounded"
                          title="Send SMS Reminder"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Customer Ledger Statement (Cols 7) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          {activeCustomer ? (
            <div className="space-y-4">
              {/* Printable Statement Area */}
              <div id="print-section" className="space-y-4">
                <div className="flex items-start justify-between border-b pb-3 border-slate-100 dark:border-slate-700">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Customer Credit Statement
                    </span>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      {activeCustomer.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Phone: {activeCustomer.phone} • {activeCustomer.address || 'Local customer'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Total Due:</span>
                    <span className="text-2xl font-black text-red-600">
                      {formatINR(activeCustomer.outstandingUdhar)}
                    </span>
                  </div>
                </div>

                {/* Ledger entries list */}
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  Transaction Ledger History
                </h4>

                <div className="max-h-[380px] overflow-y-auto">
                  {activeCustomerHistory.length === 0 ? (
                    <p className="text-xs text-slate-400 py-8 text-center italic">
                      No separate ledger records recorded yet.
                    </p>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-semibold border-b border-slate-100">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3">Reference / Notes</th>
                          <th className="py-2 px-3 text-right">Debit (+)</th>
                          <th className="py-2 px-3 text-right">Credit (-)</th>
                          <th className="py-2 px-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {activeCustomerHistory.map((entry) => {
                          const isCreditSale = entry.type === 'credit_sale';
                          const isAdjustment = entry.type === 'adjustment';
                          const isRepayment = entry.type === 'repayment';

                          return (
                            <tr key={entry.id}>
                              <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                                {formatDate(entry.date)}
                              </td>
                              <td className="py-2 px-3">
                                {isAdjustment ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded font-bold text-[9px] uppercase bg-amber-100 text-amber-900 border border-amber-300">
                                    Previous Udhar / Adjust
                                  </span>
                                ) : isCreditSale ? (
                                  <span className="inline-block px-1.5 py-0.5 rounded font-bold text-[9px] uppercase bg-red-100 text-red-800">
                                    Credit Sale
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span className="inline-block px-1.5 py-0.5 rounded font-bold text-[9px] uppercase bg-emerald-100 text-emerald-800">
                                      Repayment
                                    </span>
                                    {activeCustomer && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRepaymentReceiptInfo({
                                            customerName: activeCustomer.name,
                                            phone: activeCustomer.phone,
                                            amountPaid: entry.amount,
                                            remainingBalance: entry.balanceAfter,
                                            paymentMethod: entry.paymentMethod || 'cash',
                                            date: entry.date,
                                            notes: entry.notes,
                                          });
                                          setIsReceiptModalOpen(true);
                                        }}
                                        className="p-0.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded transition-colors"
                                        title="Share receipt via WhatsApp / SMS"
                                      >
                                        <Share2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                                {entry.notes || entry.invoiceNumber || '—'}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-red-600">
                                {isCreditSale || (isAdjustment && (entry.notes?.includes('+') || !entry.notes?.includes('-')))
                                  ? formatINR(entry.amount)
                                  : '—'}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-emerald-600">
                                {isRepayment || (isAdjustment && entry.notes?.includes('-'))
                                  ? formatINR(entry.amount)
                                  : '—'}
                              </td>
                              <td className="py-2 px-3 text-right font-black font-mono">
                                {formatINR(entry.balanceAfter)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Action Buttons for Active Customer */}
              <div className="no-print pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const msg = buildUdharReminderMessage(activeCustomer, settings);
                      window.open(getWhatsAppClickUrl(activeCustomer.phone, msg), '_blank');
                    }}
                    className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp Reminder
                  </button>

                  <button
                    onClick={() => {
                      const msg = buildUdharReminderMessage(activeCustomer, settings);
                      window.location.href = getSmsClickUrl(activeCustomer.phone, msg);
                    }}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    SMS Reminder
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setAdjustingCustomer(activeCustomer);
                      setIsAdjustModalOpen(true);
                    }}
                    className="px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1"
                    title="Update or add previous udhaar (no date required)"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-amber-700" />
                    <span>Update Previous Udhar</span>
                  </button>

                  <button
                    onClick={() => {
                      setRepayingCustomer(activeCustomer);
                      setIsRepayModalOpen(true);
                    }}
                    className="px-4 py-2 bg-kirana-700 hover:bg-kirana-800 text-white rounded-lg text-xs font-black shadow-sm"
                  >
                    Receive Repayment
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-slate-400 text-xs">
              Select a customer from the left to view their credit ledger and transaction history.
            </div>
          )}
        </div>
      </div>

      {/* Repayment Modal */}
      {isRepayModalOpen && repayingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Record Udhar Repayment
                </h3>
                <p className="text-[11px] text-slate-500">
                  Party: <strong>{repayingCustomer.name}</strong> • Pending: <strong className="text-red-600">{formatINR(repayingCustomer.outstandingUdhar)}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsRepayModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRepayment} className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Repayment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  max={repayingCustomer.outstandingUdhar}
                  required
                  placeholder="Enter amount"
                  value={repayAmount}
                  onChange={(e) => setRepayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-bold"
                />
                <button
                  type="button"
                  onClick={() => setRepayAmount(repayingCustomer.outstandingUdhar.toString())}
                  className="text-[10px] text-kirana-700 font-bold hover:underline"
                >
                  Clear Full Balance ({formatINR(repayingCustomer.outstandingUdhar)})
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRepayMethod('cash')}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      repayMethod === 'cash'
                        ? 'bg-kirana-700 text-white border-kirana-700'
                        : 'bg-white dark:bg-slate-800 text-slate-700 border-slate-300'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepayMethod('upi')}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      repayMethod === 'upi'
                        ? 'bg-kirana-700 text-white border-kirana-700'
                        : 'bg-white dark:bg-slate-800 text-slate-700 border-slate-300'
                    }`}
                  >
                    UPI / Online
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Paid in full at store counter"
                  value={repayNotes}
                  onChange={(e) => setRepayNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRepayModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md"
                >
                  Confirm Repayment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Previous Udhar Modal */}
      <UpdatePreviousUdharModal
        isOpen={isAdjustModalOpen}
        onClose={() => {
          setIsAdjustModalOpen(false);
          setAdjustingCustomer(null);
        }}
        customer={adjustingCustomer}
        customersList={customers}
        onSuccess={(updated) => {
          setSelectedCustomerId(updated.id!);
        }}
      />

      {/* Repayment Receipt Share Modal (WhatsApp & SMS) */}
      <RepaymentReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setRepaymentReceiptInfo(null);
        }}
        receiptInfo={repaymentReceiptInfo}
        settings={settings}
      />
    </div>
  );
};
