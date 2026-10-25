import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Invoice, StoreSettings } from '../types';
import { formatINR, formatDate, formatDateTime } from '../utils/formatters';
import { exportInvoicesCSV } from '../utils/csv';
import {
  BarChart3,
  TrendingUp,
  Download,
  Printer,
  Calendar,
  Layers,
  CreditCard,
  RotateCcw,
  AlertTriangle,
  Users,
  Eye,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface Props {
  settings: StoreSettings;
  onOpenReceipt: (invoice: Invoice) => void;
}

export const ReportsView: React.FC<Props> = ({ settings, onOpenReceipt }) => {
  const invoices = useLiveQuery(() => db.invoices.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];

  // Date Range filter
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('month');

  // Refund Confirmation Modal
  const [refundingInvoice, setRefundingInvoice] = useState<Invoice | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);

  // Active tab inside reports
  const [reportTab, setReportTab] = useState<'sales' | 'products' | 'categories' | 'refunds'>('sales');

  // Filtered invoices based on date range
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    return invoices.filter((inv) => {
      if (dateFilter === 'today') {
        return inv.date.slice(0, 10) === todayStr;
      }
      if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return new Date(inv.date) >= weekAgo;
      }
      if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(now.getMonth() - 1);
        return new Date(inv.date) >= monthAgo;
      }
      return true;
    });
  }, [invoices, dateFilter]);

  // Aggregated KPIs
  const reportStats = useMemo(() => {
    const completed = filteredInvoices.filter((i) => i.status === 'completed');
    const refunded = filteredInvoices.filter((i) => i.status === 'refunded');

    const totalSalesRevenue = completed.reduce((sum, i) => sum + i.totalAmount, 0);
    const totalCostOfGoods = completed.reduce((sum, i) => sum + i.costAmount, 0);
    const grossProfit = completed.reduce((sum, i) => sum + (i.profit || 0), 0);
    const profitMargin = totalSalesRevenue > 0 ? (grossProfit / totalSalesRevenue) * 100 : 0;
    const avgBillValue = completed.length > 0 ? totalSalesRevenue / completed.length : 0;

    // Payment methods breakdown
    const paymentBreakdown = {
      cash: completed.filter((i) => i.paymentMethod === 'cash').reduce((s, i) => s + i.paidAmount, 0),
      upi: completed.filter((i) => i.paymentMethod === 'upi').reduce((s, i) => s + i.paidAmount, 0),
      split: completed.filter((i) => i.paymentMethod === 'split').reduce((s, i) => s + i.paidAmount, 0),
      udhar: completed.reduce((s, i) => s + (i.udharAmount || 0), 0),
    };

    // Category Sales Breakdown
    const catMap: Record<string, { name: string; revenue: number; quantity: number }> = {};
    completed.forEach((inv) => {
      inv.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const cat = prod?.category || 'General';
        if (!catMap[cat]) catMap[cat] = { name: cat, revenue: 0, quantity: 0 };
        catMap[cat].revenue += item.total;
        catMap[cat].quantity += item.quantity;
      });
    });
    const categoryData = Object.values(catMap).sort((a, b) => b.revenue - a.revenue);

    // Product-wise sales ranking
    const prodMap: Record<string, { name: string; unit: string; revenue: number; quantity: number; profit: number }> = {};
    completed.forEach((inv) => {
      inv.items.forEach((item) => {
        if (!prodMap[item.name]) {
          prodMap[item.name] = {
            name: item.name,
            unit: item.unit,
            revenue: 0,
            quantity: 0,
            profit: 0,
          };
        }
        prodMap[item.name].revenue += item.total;
        prodMap[item.name].quantity += item.quantity;
        prodMap[item.name].profit += item.total - item.quantity * item.purchasePrice;
      });
    });
    const productData = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue);

    return {
      totalSalesRevenue,
      totalCostOfGoods,
      grossProfit,
      profitMargin,
      avgBillValue,
      completedCount: completed.length,
      refundedCount: refunded.length,
      paymentBreakdown,
      categoryData,
      productData,
      refundedInvoices: refunded,
    };
  }, [filteredInvoices, products]);

  // Handle Controlled Refund / Cancellation with Stock Restoration
  const handleExecuteRefund = async () => {
    if (!refundingInvoice?.id) return;
    if (isRefunding) return;

    try {
      setIsRefunding(true);
      const now = new Date().toISOString();

      await db.transaction('rw', [
        db.invoices,
        db.products,
        db.stockMovements,
        db.customers,
        db.udharLedger,
      ], async () => {
        // 1. Mark invoice as refunded
        await db.invoices.update(refundingInvoice.id!, {
          status: 'refunded',
          notes: `${refundingInvoice.notes ? refundingInvoice.notes + ' | ' : ''}Refunded on ${formatDate(now)}: ${refundReason.trim() || 'Customer return'}`,
        });

        // 2. Restore item stocks back into inventory
        for (const item of refundingInvoice.items) {
          const prod = await db.products.get(item.productId);
          if (prod) {
            const restoredQty = prod.stockQuantity + item.quantity;
            await db.products.update(prod.id!, {
              stockQuantity: restoredQty,
              updatedAt: now,
            });

            await db.stockMovements.add({
              productId: prod.id!,
              productName: prod.name,
              type: 'refund_restock',
              quantityChange: item.quantity,
              quantityAfter: restoredQty,
              referenceId: refundingInvoice.invoiceNumber,
              reason: `Stock restored from refunded bill #${refundingInvoice.invoiceNumber} (${refundReason || 'Return'})`,
              date: now,
            });
          }
        }

        // 3. Reverse customer statistics and udhar
        if (refundingInvoice.customerId) {
          const cust = await db.customers.get(refundingInvoice.customerId);
          if (cust) {
            const newCount = Math.max(0, cust.purchaseCount - 1);
            const newSpend = Math.max(0, cust.totalSpending - refundingInvoice.totalAmount);
            const newUdhar = Math.max(0, cust.outstandingUdhar - refundingInvoice.udharAmount);

            await db.customers.update(cust.id!, {
              purchaseCount: newCount,
              totalSpending: newSpend,
              outstandingUdhar: newUdhar,
              updatedAt: now,
            });

            // If credit was charged, reverse udhar in ledger
            if (refundingInvoice.udharAmount > 0) {
              await db.udharLedger.add({
                customerId: cust.id!,
                customerName: cust.name,
                customerPhone: cust.phone,
                invoiceId: refundingInvoice.id,
                invoiceNumber: refundingInvoice.invoiceNumber,
                type: 'adjustment',
                amount: refundingInvoice.udharAmount,
                balanceAfter: newUdhar,
                notes: `Reversal of udhar from refunded bill #${refundingInvoice.invoiceNumber}`,
                date: now,
              });
            }
          }
        }
      });

      alert(`Bill #${refundingInvoice.invoiceNumber} refunded successfully. Stock has been restored.`);
      setRefundingInvoice(null);
      setRefundReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error executing refund';
      alert(`Refund failed: ${msg}`);
    } finally {
      setIsRefunding(false);
    }
  };

  const COLORS = ['#16a34a', '#0284c7', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-kirana-600" />
            Shop Financial Reports & Analytics
          </h2>
          <p className="text-xs text-slate-500">
            Real sales vs gross profit, product margins, category trends, controlled refunds
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Filter selector */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-xl text-xs font-semibold shadow-sm">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDateFilter(d.id as any)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  dateFilter === d.id
                    ? 'bg-kirana-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => exportInvoicesCSV(filteredInvoices)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
            title="Export Invoices to CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all"
            title="Print Report"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Clean Separation of Revenue vs Profit) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Sales Revenue</span>
          <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
            {formatINR(reportStats.totalSalesRevenue)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {reportStats.completedCount} completed bills
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Cost of Goods (COGS)</span>
          <p className="text-xl font-black text-slate-700 dark:text-slate-300 mt-1">
            {formatINR(reportStats.totalCostOfGoods)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">Wholesale purchase cost</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 font-bold">
            Estimated Gross Profit
          </span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatINR(reportStats.grossProfit)}
          </p>
          <span className="text-[10px] font-bold text-emerald-700 block mt-0.5">
            Margin: {reportStats.profitMargin.toFixed(1)}%
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Average Bill Size</span>
          <p className="text-xl font-black text-kirana-700 dark:text-kirana-400 mt-1">
            {formatINR(reportStats.avgBillValue)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">Per customer transaction</span>
        </div>
      </div>

      {/* Payment Modes Breakdown Card */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Payment Modes Collection Breakdown
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900/60">
            <span className="text-emerald-800 dark:text-emerald-300 font-semibold block">Cash Tendered</span>
            <span className="text-base font-black text-emerald-900 dark:text-emerald-200 mt-1 block">
              {formatINR(reportStats.paymentBreakdown.cash)}
            </span>
          </div>

          <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-100 dark:border-sky-900/60">
            <span className="text-sky-800 dark:text-sky-300 font-semibold block">UPI / QR Collection</span>
            <span className="text-base font-black text-sky-900 dark:text-sky-200 mt-1 block">
              {formatINR(reportStats.paymentBreakdown.upi)}
            </span>
          </div>

          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-100 dark:border-purple-900/60">
            <span className="text-purple-800 dark:text-purple-300 font-semibold block">Split Paid</span>
            <span className="text-base font-black text-purple-900 dark:text-purple-200 mt-1 block">
              {formatINR(reportStats.paymentBreakdown.split)}
            </span>
          </div>

          <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-100 dark:border-red-900/60">
            <span className="text-red-800 dark:text-red-300 font-semibold block">Credit (Udhar Given)</span>
            <span className="text-base font-black text-red-900 dark:text-red-200 mt-1 block">
              {formatINR(reportStats.paymentBreakdown.udhar)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Inside Reports */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 text-xs font-bold">
        {[
          { id: 'sales', label: `Invoices (${filteredInvoices.length})` },
          { id: 'products', label: `Product-wise Performance (${reportStats.productData.length})` },
          { id: 'categories', label: `Category Analysis (${reportStats.categoryData.length})` },
          { id: 'refunds', label: `Refunds & Restock (${reportStats.refundedCount})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setReportTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl transition-all ${
              reportTab === tab.id
                ? 'bg-kirana-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Sales Invoices List */}
      {reportTab === 'sales' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {filteredInvoices.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No invoices found in this time range.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Revenue</th>
                    <th className="py-3 px-4 text-right">Profit</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors ${
                        inv.status === 'refunded' ? 'opacity-60 bg-red-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {formatDateTime(inv.date)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {inv.customerName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                          {inv.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                        {formatINR(inv.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {formatINR(inv.profit || 0)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                            inv.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => onOpenReceipt(inv)}
                          className="p-1.5 text-kirana-700 hover:bg-kirana-50 rounded-lg"
                          title="Print / View Receipt"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {inv.status === 'completed' && (
                          <button
                            onClick={() => setRefundingInvoice(inv)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Refund & Restock Invoice"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Product-wise Performance */}
      {reportTab === 'products' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-semibold border-b">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4 text-center">Units Sold</th>
                  <th className="py-3 px-4 text-right">Revenue Generated</th>
                  <th className="py-3 px-4 text-right">Gross Profit Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {reportStats.productData.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-white">
                      {p.name}
                    </td>
                    <td className="py-3 px-4 text-center font-bold">
                      {p.quantity} {p.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                      {formatINR(p.revenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600">
                      {formatINR(p.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Category Analysis */}
      {reportTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 self-start">
              Category Revenue Share
            </h4>
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reportStats.categoryData}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => entry.name}
                  >
                    {reportStats.categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => [formatINR(Number(val) || 0), 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Category Rankings
            </h4>
            <div className="space-y-3">
              {reportStats.categoryData.map((c, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs pb-2 border-b last:border-none">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white">{c.name}</span>
                    <span className="text-[10px] text-slate-400 block">{c.quantity} items sold</span>
                  </div>
                  <span className="font-black text-slate-900 dark:text-white">
                    {formatINR(c.revenue)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Refund & Restock Audit */}
      {reportTab === 'refunds' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {reportStats.refundedInvoices.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No refunded bills. All sales are intact.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items Restocked</th>
                    <th className="py-3 px-4 text-right">Amount Reversed</th>
                    <th className="py-3 px-4">Audit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportStats.refundedInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-3 px-4 font-mono font-bold text-red-600">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(inv.date)}</td>
                      <td className="py-3 px-4">{inv.customerName}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {inv.items.map((i) => `${i.name} (${i.quantity})`).join(', ')}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-red-600">
                        {formatINR(inv.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{inv.notes || 'Customer return'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Controlled Refund Confirmation Modal */}
      {refundingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
            <div className="flex items-center gap-3 text-red-600 border-b pb-3 border-slate-100">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Confirm Bill Refund & Restock
                </h3>
                <p className="text-[11px] text-slate-500">
                  Invoice: <strong>{refundingInvoice.invoiceNumber}</strong> • Amount: <strong>{formatINR(refundingInvoice.totalAmount)}</strong>
                </p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-bold">What will happen:</p>
              <ul className="list-disc list-inside text-[11px] space-y-0.5">
                <li>All {refundingInvoice.items.length} items will be restored into inventory.</li>
                <li>Audit stock movement log will record &ldquo;refund_restock&rdquo;.</li>
                <li>If billed on Udhar, credit will be deducted from customer balance.</li>
              </ul>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Reason for Refund / Cancellation *
              </label>
              <input
                type="text"
                placeholder="e.g. Customer returned damaged seal / wrong item"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRefundingInvoice(null)}
                className="px-4 py-2 text-slate-600 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRefund}
                disabled={isRefunding}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md"
              >
                {isRefunding ? 'Processing...' : 'Confirm Refund & Restore Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
