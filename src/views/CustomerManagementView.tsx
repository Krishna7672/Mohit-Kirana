import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { triggerBackgroundCloudSync } from '../db/supabaseSync';
import type { Customer, Invoice, StoreSettings } from '../types';
import {
  formatINR,
  formatDate,
  formatDateTime,
  getDaysAgo
} from '../utils/formatters';
import { exportCustomersCSV } from '../utils/csv';
import {
  buildUdharReminderMessage,
  getWhatsAppClickUrl,
  getSmsClickUrl
} from '../utils/notifications';
import { UpdatePreviousUdharModal } from '../components/UpdatePreviousUdharModal';
import {
  Users,
  UserPlus,
  Search,
  Download,
  MapPin,
  CreditCard,
  MessageCircle,
  Smartphone,
  Eye,
  Edit2,
  Trash2,
  X,
  Printer
} from 'lucide-react';

interface Props {
  settings: StoreSettings;
  onOpenReceipt: (invoice: Invoice) => void;
  onStartPosWithCustomer: (customerId: number) => void;
  openNewCustomerModalOnMount?: boolean;
}

export const CustomerManagementView: React.FC<Props> = ({
  settings,
  onOpenReceipt,
  onStartPosWithCustomer,
  openNewCustomerModalOnMount,
}) => {
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const invoices = useLiveQuery(() => db.invoices.toArray()) || [];

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<'all' | 'repeat' | 'loyal' | 'udhar' | 'inactive30' | 'inactive60' | 'inactive90'>('all');

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState(openNewCustomerModalOnMount || false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedProfileCustomer, setSelectedProfileCustomer] = useState<Customer | null>(null);

  // Repayment Modal
  const [isRepaymentModalOpen, setIsRepaymentModalOpen] = useState(false);
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [repaymentMethod, setRepaymentMethod] = useState<'cash' | 'upi'>('cash');
  const [repaymentNotes, setRepaymentNotes] = useState('');

  // Form State for Add/Edit
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPreviousUdhar, setFormPreviousUdhar] = useState('');

  // Update previous udhaar modal state
  const [isUdharAdjustModalOpen, setIsUdharAdjustModalOpen] = useState(false);
  const [udharAdjustCustomer, setUdharAdjustCustomer] = useState<Customer | null>(null);

  // Segment helpers
  const getCustomerSegment = (c: Customer) => {
    const daysSince = getDaysAgo(c.lastPurchaseDate);
    if (daysSince !== null && daysSince >= 90) return { label: 'Inactive 90d+', color: 'bg-red-100 text-red-800' };
    if (daysSince !== null && daysSince >= 60) return { label: 'Inactive 60d+', color: 'bg-orange-100 text-orange-800' };
    if (daysSince !== null && daysSince >= 30) return { label: 'Inactive 30d+', color: 'bg-amber-100 text-amber-800' };
    if (c.purchaseCount >= 5) return { label: 'Loyal VIP', color: 'bg-emerald-100 text-emerald-800 font-bold' };
    if (c.purchaseCount >= 2) return { label: 'Repeat Customer', color: 'bg-blue-100 text-blue-800' };
    return { label: 'New Party', color: 'bg-slate-100 text-slate-700' };
  };

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return customers.filter((c) => {
      // Query filter
      if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q)) {
        return false;
      }

      // Segment filter
      const daysSince = getDaysAgo(c.lastPurchaseDate);
      if (segmentFilter === 'repeat' && c.purchaseCount < 2) return false;
      if (segmentFilter === 'loyal' && c.purchaseCount < 5) return false;
      if (segmentFilter === 'udhar' && c.outstandingUdhar <= 0) return false;
      if (segmentFilter === 'inactive30' && (daysSince === null || daysSince < 30)) return false;
      if (segmentFilter === 'inactive60' && (daysSince === null || daysSince < 60)) return false;
      if (segmentFilter === 'inactive90' && (daysSince === null || daysSince < 90)) return false;

      return true;
    });
  }, [customers, searchQuery, segmentFilter]);

  // Selected customer's invoices
  const customerInvoices = useMemo(() => {
    if (!selectedProfileCustomer?.id) return [];
    return invoices
      .filter((i) => i.customerId === selectedProfileCustomer.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, selectedProfileCustomer]);

  // Open add modal
  const openNewModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormNotes('');
    setFormPreviousUdhar('');
    setIsAddEditOpen(true);
  };

  // Open edit modal
  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormPhone(c.phone);
    setFormAddress(c.address || '');
    setFormNotes(c.notes || '');
    setFormPreviousUdhar(c.outstandingUdhar ? c.outstandingUdhar.toString() : '0');
    setIsAddEditOpen(true);
  };

  // Save Customer (Add or Update)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      alert('Name and Phone number are required.');
      return;
    }

    const cleanPhone = formPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      alert('Please enter a valid 10-digit phone number.');
      return;
    }

    const existing = await db.customers.where('phone').equals(cleanPhone).first();
    if (existing && (!editingCustomer || existing.id !== editingCustomer.id)) {
      alert(`Customer with mobile ${cleanPhone} already exists: "${existing.name}". Duplicate phone numbers are prevented.`);
      return;
    }

    const now = new Date().toISOString();
    const newUdhar = parseFloat(formPreviousUdhar) || 0;

    if (editingCustomer && editingCustomer.id) {
      const oldUdhar = editingCustomer.outstandingUdhar || 0;
      const diff = newUdhar - oldUdhar;

      await db.transaction('rw', [db.customers, db.udharLedger], async () => {
        await db.customers.update(editingCustomer.id!, {
          name: formName.trim(),
          phone: cleanPhone,
          address: formAddress.trim(),
          notes: formNotes.trim(),
          outstandingUdhar: newUdhar,
          updatedAt: now,
        });

        if (diff !== 0) {
          await db.udharLedger.add({
            customerId: editingCustomer.id!,
            customerName: formName.trim(),
            customerPhone: cleanPhone,
            type: 'adjustment',
            amount: Math.abs(diff),
            balanceAfter: newUdhar,
            notes: diff > 0
              ? `Previous Udhar updated (+${formatINR(diff)} added) [Date not specified]`
              : `Previous Udhar adjusted (-${formatINR(Math.abs(diff))} reduced) [Date not specified]`,
            date: now,
          });
        }
      });

      if (selectedProfileCustomer?.id === editingCustomer.id) {
        const fresh = await db.customers.get(editingCustomer.id);
        setSelectedProfileCustomer(fresh || null);
      }
    } else {
      const newCust: Omit<Customer, 'id'> = {
        name: formName.trim(),
        phone: cleanPhone,
        address: formAddress.trim(),
        registrationDate: now,
        purchaseCount: 0,
        totalSpending: 0,
        outstandingUdhar: newUdhar,
        communicationConsent: true,
        notes: formNotes.trim(),
        updatedAt: now,
      };

      const id = await db.customers.add(newCust as Customer);
      if (newUdhar > 0) {
        await db.udharLedger.add({
          customerId: id,
          customerName: newCust.name,
          customerPhone: newCust.phone,
          type: 'adjustment',
          amount: newUdhar,
          balanceAfter: newUdhar,
          notes: 'Previous Udhar / पिछला बकाया (Old Balance - Date Unknown)',
          date: now,
        });
      }
    }

    setIsAddEditOpen(false);
    triggerBackgroundCloudSync();
  };

  // Delete Customer
  const handleDeleteCustomer = async (c: Customer) => {
    if (!c.id) return;
    if (c.outstandingUdhar > 0) {
      alert(`Cannot delete customer with active outstanding udhar of ${formatINR(c.outstandingUdhar)}. Clear balance first.`);
      return;
    }
    const confirmDelete = window.confirm(`Are you sure you want to delete customer "${c.name}"?`);
    if (confirmDelete) {
      await db.customers.delete(c.id);
      if (selectedProfileCustomer?.id === c.id) {
        setSelectedProfileCustomer(null);
      }
    }
  };

  // Receive Udhar Repayment
  const handleRecordRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileCustomer?.id) return;

    const amount = parseFloat(repaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid repayment amount.');
      return;
    }

    if (amount > selectedProfileCustomer.outstandingUdhar) {
      alert(`Repayment cannot exceed current outstanding balance of ${formatINR(selectedProfileCustomer.outstandingUdhar)}.`);
      return;
    }

    const now = new Date().toISOString();
    const newBalance = selectedProfileCustomer.outstandingUdhar - amount;

    await db.transaction('rw', [db.customers, db.udharLedger], async () => {
      // 1. Update customer balance
      await db.customers.update(selectedProfileCustomer.id!, {
        outstandingUdhar: newBalance,
        updatedAt: now,
      });

      // 2. Record ledger entry (Separately logged so it is NOT counted as new sales revenue)
      await db.udharLedger.add({
        customerId: selectedProfileCustomer.id!,
        customerName: selectedProfileCustomer.name,
        customerPhone: selectedProfileCustomer.phone,
        type: 'repayment',
        amount: amount,
        balanceAfter: newBalance,
        paymentMethod: repaymentMethod,
        notes: repaymentNotes.trim() || `Udhar repayment received via ${repaymentMethod.toUpperCase()}`,
        date: now,
      });
    });

    const freshCust = await db.customers.get(selectedProfileCustomer.id);
    setSelectedProfileCustomer(freshCust || null);

    setIsRepaymentModalOpen(false);
    setRepaymentAmount('');
    setRepaymentNotes('');
    triggerBackgroundCloudSync();
    alert(`Successfully recorded repayment of ${formatINR(amount)}. Remaining Udhar: ${formatINR(newBalance)}.`);
  };

  const handleSendReminderWhatsApp = (c: Customer) => {
    const msg = buildUdharReminderMessage(c, settings);
    const url = getWhatsAppClickUrl(c.phone, msg);
    window.open(url, '_blank');
  };

  const handleSendReminderSMS = (c: Customer) => {
    const msg = buildUdharReminderMessage(c, settings);
    const url = getSmsClickUrl(c.phone, msg);
    window.location.href = url;
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-kirana-600" />
            Customer Management & Purchase History
          </h2>
          <p className="text-xs text-slate-500">
            Customer directory, repeat purchaser tracking, lifetime spending and credit ledgers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCustomersCSV(customers)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={openNewModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-kirana-700 hover:bg-kirana-800 text-white rounded-xl text-xs font-bold shadow-md shadow-kirana-700/20 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Search and Segment Filter Tabs */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer by name or 10-digit mobile number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-kirana-500 text-slate-800 dark:text-white"
          />
        </div>

        {/* Segment Tabs */}
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold pt-1 border-t border-slate-100 dark:border-slate-700">
          {[
            { id: 'all', label: `All (${customers.length})` },
            { id: 'repeat', label: 'Repeat Buyers (≥2 Bills)' },
            { id: 'loyal', label: 'Loyal VIPs (≥5 Bills)' },
            { id: 'udhar', label: 'With Udhar Balance' },
            { id: 'inactive30', label: 'Inactive >30 Days' },
            { id: 'inactive60', label: 'Inactive >60 Days' },
            { id: 'inactive90', label: 'Inactive >90 Days' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSegmentFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                segmentFilter === tab.id
                  ? 'bg-kirana-700 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {filteredCustomers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No customers found. Click &ldquo;Add Customer&rdquo; or start billing at POS.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Mobile & Address</th>
                  <th className="py-3 px-4 text-center">Status Segment</th>
                  <th className="py-3 px-4 text-center">Visits</th>
                  <th className="py-3 px-4 text-right">Lifetime Spend</th>
                  <th className="py-3 px-4 text-right">Outstanding Udhar</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredCustomers.map((cust) => {
                  const segment = getCustomerSegment(cust);
                  return (
                    <tr
                      key={cust.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setSelectedProfileCustomer(cust)}
                          className="font-bold text-slate-900 dark:text-white hover:text-kirana-700 text-left"
                        >
                          {cust.name}
                        </button>
                        <span className="text-[10px] text-slate-400 block">
                          Joined: {formatDate(cust.registrationDate)}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-700 dark:text-slate-300">
                          {cust.phone}
                        </div>
                        {cust.address && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                            {cust.address}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${segment.color}`}
                        >
                          {segment.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-white">
                        {cust.purchaseCount}
                      </td>

                      <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                        {formatINR(cust.totalSpending)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {cust.outstandingUdhar > 0 ? (
                          <span className="font-black text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded">
                            {formatINR(cust.outstandingUdhar)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">₹0</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedProfileCustomer(cust)}
                          className="p-1.5 text-kirana-700 hover:bg-kirana-50 dark:hover:bg-slate-700 rounded-lg"
                          title="View Customer Profile & Purchase History"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setUdharAdjustCustomer(cust);
                            setIsUdharAdjustModalOpen(true);
                          }}
                          className="p-1.5 text-amber-700 hover:bg-amber-50 dark:hover:bg-slate-700 rounded-lg"
                          title="Update Previous Udhar (तारीख याद न हो तो भी)"
                        >
                          <CreditCard className="w-4 h-4 text-amber-600" />
                        </button>
                        <button
                          onClick={() => openEditModal(cust)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(cust)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg"
                          title="Delete Customer"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Customer Profile & Purchase History Modal */}
      {selectedProfileCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full my-8 overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-kirana-50 dark:bg-kirana-950/40 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                    {selectedProfileCustomer.name}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getCustomerSegment(selectedProfileCustomer).color}`}>
                    {getCustomerSegment(selectedProfileCustomer).label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Mob: {selectedProfileCustomer.phone} • Registered: {formatDate(selectedProfileCustomer.registrationDate)}
                </p>
                {selectedProfileCustomer.address && (
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {selectedProfileCustomer.address}
                  </p>
                )}
              </div>

              <button
                onClick={() => setSelectedProfileCustomer(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview Stats */}
            <div className="grid grid-cols-3 gap-2 p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-700 text-xs">
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block">Total Visits</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {selectedProfileCustomer.purchaseCount} bills
                </span>
              </div>

              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block">Lifetime Spending</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {formatINR(selectedProfileCustomer.totalSpending)}
                </span>
              </div>

              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block">Outstanding Udhar</span>
                <span className="text-sm font-black text-red-600">
                  {formatINR(selectedProfileCustomer.outstandingUdhar)}
                </span>
              </div>
            </div>

            {/* Actions Toolbar for Selected Customer */}
            <div className="p-3 px-5 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setUdharAdjustCustomer(selectedProfileCustomer);
                    setIsUdharAdjustModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-bold shadow-xs border border-amber-300"
                  title="Update or add previous udhaar (no date needed)"
                >
                  <CreditCard className="w-3.5 h-3.5 text-amber-700" />
                  Update Previous Udhar
                </button>

                {selectedProfileCustomer.outstandingUdhar > 0 && (
                  <button
                    onClick={() => setIsRepaymentModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Receive Repayment
                  </button>
                )}

                {selectedProfileCustomer.outstandingUdhar > 0 && (
                  <>
                    <button
                      onClick={() => handleSendReminderWhatsApp(selectedProfileCustomer)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold hover:bg-emerald-200"
                      title="Send WhatsApp payment reminder"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp Reminder
                    </button>
                    <button
                      onClick={() => handleSendReminderSMS(selectedProfileCustomer)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-xs font-semibold hover:bg-blue-200"
                      title="Send SMS payment reminder"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      SMS Reminder
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => {
                  onStartPosWithCustomer(selectedProfileCustomer.id!);
                  setSelectedProfileCustomer(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-kirana-700 hover:bg-kirana-800 text-white rounded-lg text-xs font-bold shadow-sm"
              >
                <span>New Bill For Customer</span>
              </button>
            </div>

            {/* Past Invoices & Purchase History */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Purchase History ({customerInvoices.length} Bills)
              </h4>

              {customerInvoices.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center italic">
                  No previous purchases recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {customerInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800 dark:text-white">
                            {inv.invoiceNumber}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {formatDateTime(inv.date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 dark:text-white text-sm">
                            {formatINR(inv.totalAmount)}
                          </span>
                          <button
                            onClick={() => onOpenReceipt(inv)}
                            className="p-1 text-kirana-700 hover:bg-kirana-100 rounded"
                            title="Print / View Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                        {inv.items.map((item, idx) => (
                          <span key={idx} className="mr-2 inline-block">
                            • {item.name} ({item.quantity} {item.unit})
                          </span>
                        ))}
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                        <span>Payment: <strong className="uppercase">{inv.paymentMethod}</strong> (Paid: {formatINR(inv.paidAmount)})</span>
                        {inv.udharAmount > 0 && (
                          <span className="text-red-600 font-bold">
                            Udhar in this bill: {formatINR(inv.udharAmount)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receive Udhar Repayment Modal */}
      {isRepaymentModalOpen && selectedProfileCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Receive Udhar Repayment
                </h3>
                <p className="text-[11px] text-slate-500">
                  Customer: <strong>{selectedProfileCustomer.name}</strong> • Current Udhar:{' '}
                  <strong className="text-red-600">
                    {formatINR(selectedProfileCustomer.outstandingUdhar)}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setIsRepaymentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordRepayment} className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Repayment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  max={selectedProfileCustomer.outstandingUdhar}
                  required
                  placeholder="Enter amount"
                  value={repaymentAmount}
                  onChange={(e) => setRepaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-bold"
                />
                <button
                  type="button"
                  onClick={() => setRepaymentAmount(selectedProfileCustomer.outstandingUdhar.toString())}
                  className="text-[10px] text-kirana-700 font-bold hover:underline"
                >
                  Pay Full Balance ({formatINR(selectedProfileCustomer.outstandingUdhar)})
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Payment Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRepaymentMethod('cash')}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      repaymentMethod === 'cash'
                        ? 'bg-kirana-700 text-white border-kirana-700'
                        : 'bg-white dark:bg-slate-800 text-slate-700 border-slate-300'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepaymentMethod('upi')}
                    className={`py-2 rounded-xl font-bold border transition-all ${
                      repaymentMethod === 'upi'
                        ? 'bg-kirana-700 text-white border-kirana-700'
                        : 'bg-white dark:bg-slate-800 text-slate-700 border-slate-300'
                    }`}
                  >
                    UPI / Online
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Notes / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Paid in cash at store counter"
                  value={repaymentNotes}
                  onChange={(e) => setRepaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRepaymentModalOpen(false)}
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

      {/* Add / Edit Customer Modal */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-kirana-700" />
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button
                onClick={() => setIsAddEditOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Mobile Number (10 Digits) *
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Address / House / Area</label>
                <input
                  type="text"
                  placeholder="e.g. House 42, Gali 2, Sector 4"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
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
                  value={formPreviousUdhar}
                  onChange={(e) => setFormPreviousUdhar(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-bold"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  💡 No date required. Records directly as old balance in Khata ledger.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Notes / Preferences</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Prefers home delivery, pays monthly"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-4 py-2 text-slate-600 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-kirana-700 text-white font-bold rounded-xl shadow-md"
                >
                  {editingCustomer ? 'Update' : 'Save'} Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Previous Udhar Modal */}
      <UpdatePreviousUdharModal
        isOpen={isUdharAdjustModalOpen}
        onClose={() => {
          setIsUdharAdjustModalOpen(false);
          setUdharAdjustCustomer(null);
        }}
        customer={udharAdjustCustomer}
        customersList={customers}
        onSuccess={(updated) => {
          if (selectedProfileCustomer?.id === updated.id) {
            setSelectedProfileCustomer(updated);
          }
        }}
      />
    </div>
  );
};
