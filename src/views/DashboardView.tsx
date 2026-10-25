import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Invoice, StoreSettings } from '../types';
import { formatINR, formatDateTime, formatDate } from '../utils/formatters';
import type { ActiveTab } from '../components/Navigation';
import {
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  Users,
  UserCheck,
  CreditCard,
  PlusCircle,
  Truck,
  FileSpreadsheet,
  ArrowUpRight,
  Eye,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

interface Props {
  setActiveTab: (tab: ActiveTab) => void;
  onOpenReceipt: (invoice: Invoice) => void;
  onQuickNewProduct: () => void;
  onQuickNewCustomer: () => void;
  settings: StoreSettings;
}

export const DashboardView: React.FC<Props> = ({
  setActiveTab,
  onOpenReceipt,
  onQuickNewProduct,
  onQuickNewCustomer,
  settings,
}) => {
  const [chartRange, setChartRange] = useState<'7days' | '30days' | 'months'>('7days');

  // Live queries directly from Dexie IndexedDB
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const invoices = useLiveQuery(() => db.invoices.toArray()) || [];

  // Metrics calculations
  const stats = useMemo(() => {
    const today = new Date();
    const todayDateStr = today.toISOString().slice(0, 10);

    const completedInvoices = invoices.filter((i) => i.status === 'completed');
    const todayInvoices = completedInvoices.filter(
      (i) => i.date.slice(0, 10) === todayDateStr
    );

    const todaySales = todayInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const todayProfit = todayInvoices.reduce((sum, i) => sum + (i.profit || 0), 0);
    const totalLifetimeProfit = completedInvoices.reduce((sum, i) => sum + (i.profit || 0), 0);

    const activeProducts = products.filter((p) => !p.isArchived);
    const lowStockItems = activeProducts.filter(
      (p) => p.stockQuantity > 0 && p.stockQuantity <= p.minStockThreshold
    );
    const outOfStockItems = activeProducts.filter((p) => p.stockQuantity <= 0);

    const repeatCustomers = customers.filter((c) => c.purchaseCount >= 2);
    const totalUdhar = customers.reduce((sum, c) => sum + (c.outstandingUdhar || 0), 0);

    // Recent transactions (last 6)
    const recentInvoices = [...completedInvoices]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);

    // Top selling products aggregated
    const productSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    completedInvoices.forEach((inv) => {
      inv.items.forEach((item) => {
        if (!productSalesMap[item.name]) {
          productSalesMap[item.name] = { name: item.name, quantity: 0, revenue: 0 };
        }
        productSalesMap[item.name].quantity += item.quantity;
        productSalesMap[item.name].revenue += item.total;
      });
    });

    const topSelling = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      todaySales,
      todayProfit,
      totalBillsToday: todayInvoices.length,
      totalProducts: activeProducts.length,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      outOfStockCount: outOfStockItems.length,
      registeredCustomers: customers.length,
      repeatCustomersCount: repeatCustomers.length,
      totalUdhar,
      totalLifetimeProfit,
      recentInvoices,
      topSelling,
    };
  }, [invoices, products, customers]);

  // Chart data based on selected range
  const chartData = useMemo(() => {
    const completed = invoices.filter((i) => i.status === 'completed');

    if (chartRange === '7days') {
      const days: { label: string; date: string; sales: number; profit: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
        
        const dayInvoices = completed.filter((inv) => inv.date.slice(0, 10) === dateStr);
        const daySales = dayInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const dayProfit = dayInvoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);

        days.push({ label: dayLabel, date: dateStr, sales: daySales, profit: dayProfit });
      }
      return days;
    }

    if (chartRange === '30days') {
      const days: { label: string; date: string; sales: number; profit: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

        const dayInvoices = completed.filter((inv) => inv.date.slice(0, 10) === dateStr);
        const daySales = dayInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const dayProfit = dayInvoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);

        days.push({ label: dayLabel, date: dateStr, sales: daySales, profit: dayProfit });
      }
      return days;
    }

    // Monthly aggregation (last 6 months)
    const months: { label: string; sales: number; profit: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

      const monthInvoices = completed.filter((inv) => inv.date.startsWith(yearMonth));
      const monthSales = monthInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      const monthProfit = monthInvoices.reduce((sum, inv) => sum + (inv.profit || 0), 0);

      months.push({ label: monthLabel, sales: monthSales, profit: monthProfit });
    }
    return months;
  }, [invoices, chartRange]);

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Top Banner / Store Header */}
      <div className="bg-gradient-to-r from-kirana-800 via-kirana-700 to-emerald-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-kirana-200 text-xs font-semibold mb-1">
              <span>{formatDate(new Date())}</span>
              <span>•</span>
              <span className="bg-kirana-900/60 px-2 py-0.5 rounded-full text-emerald-200">
                100% Offline Database Ready
              </span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              {settings.shopName}
            </h2>
            <p className="text-kirana-100/90 text-xs max-w-xl mt-1">
              {settings.tagline || 'Manage your grocery store, rapid POS billing, udhar ledger and inventory.'}
            </p>
          </div>

          {/* POS Quick Button in Banner */}
          <button
            onClick={() => setActiveTab('pos')}
            className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white text-kirana-800 hover:bg-kirana-50 rounded-xl font-black text-sm shadow-xl hover:shadow-2xl transition-all transform active:scale-95 shrink-0"
          >
            <ShoppingCart className="w-5 h-5 text-kirana-600" />
            <span>Open POS Billing</span>
          </button>
        </div>

        {/* Decorative subtle circles */}
        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setActiveTab('pos')}
          className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-kirana-500 hover:shadow-md transition-all text-left group"
        >
          <div className="p-2.5 rounded-lg bg-kirana-100 dark:bg-kirana-900/60 text-kirana-700 dark:text-kirana-300 group-hover:scale-110 transition-transform">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-white">New Bill</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Fast POS</p>
          </div>
        </button>

        <button
          onClick={onQuickNewProduct}
          className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-kirana-500 hover:shadow-md transition-all text-left group"
        >
          <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 group-hover:scale-110 transition-transform">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-white">Add Product</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Inventory item</p>
          </div>
        </button>

        <button
          onClick={onQuickNewCustomer}
          className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-kirana-500 hover:shadow-md transition-all text-left group"
        >
          <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-white">Add Customer</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">New Party</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('purchases')}
          className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-kirana-500 hover:shadow-md transition-all text-left group"
        >
          <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 group-hover:scale-110 transition-transform">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-white">Stock Inward</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Supplier bill</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('udhar')}
          className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-kirana-500 hover:shadow-md transition-all text-left group"
        >
          <div className="p-2.5 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 group-hover:scale-110 transition-transform">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-white">Udhar Khata</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Credit ledger</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-kirana-500 hover:shadow-md transition-all text-left group"
        >
          <div className="p-2.5 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 group-hover:scale-110 transition-transform">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 dark:text-white">Reports</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Export & Print</p>
          </div>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Today&apos;s Sales</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {formatINR(stats.todaySales)}
            </p>
            <div className="flex items-center justify-between text-xs mt-1 text-slate-500 dark:text-slate-400">
              <span>{stats.totalBillsToday} bills completed</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                Profit: {formatINR(stats.todayProfit)}
              </span>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-emerald-500" />
        </div>

        {/* Outstanding Udhar */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Outstanding Udhar</span>
            <div className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-red-600 dark:text-red-400">
              {formatINR(stats.totalUdhar)}
            </p>
            <div className="flex items-center justify-between text-xs mt-1 text-slate-500 dark:text-slate-400">
              <span>Total market credit</span>
              <button
                onClick={() => setActiveTab('udhar')}
                className="text-red-700 dark:text-red-400 font-semibold hover:underline flex items-center gap-0.5"
              >
                View Khata <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-red-500" />
        </div>

        {/* Inventory Stock Status */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Inventory Products</span>
            <div className="p-2 bg-kirana-50 dark:bg-kirana-900/30 text-kirana-600 dark:text-kirana-400 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {stats.totalProducts} <span className="text-xs font-normal text-slate-500">items</span>
            </p>
            <div className="flex items-center gap-2 text-xs mt-1">
              <span className={`px-2 py-0.5 rounded font-bold ${stats.lowStockCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                {stats.lowStockCount} Low
              </span>
              <span className={`px-2 py-0.5 rounded font-bold ${stats.outOfStockCount > 0 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'}`}>
                {stats.outOfStockCount} Out
              </span>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-kirana-600" />
        </div>

        {/* Customer Base & Repeat Customers */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Customer Base</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {stats.registeredCustomers}
            </p>
            <div className="flex items-center justify-between text-xs mt-1 text-slate-500 dark:text-slate-400">
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                {stats.repeatCustomersCount} Repeat Buyers
              </span>
              <span>
                {stats.registeredCustomers > 0
                  ? `${Math.round((stats.repeatCustomersCount / stats.registeredCustomers) * 100)}% retention`
                  : '0%'}
              </span>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-blue-500" />
        </div>
      </div>

      {/* Low Stock Warning Banner if applicable */}
      {stats.lowStockCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Low Stock Alert: {stats.lowStockCount} items below threshold
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {stats.lowStockItems.slice(0, 3).map((p) => `${p.name} (${p.stockQuantity} ${p.unit})`).join(', ')}
                {stats.lowStockItems.length > 3 ? ` and ${stats.lowStockItems.length - 3} more...` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('inventory')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0 shadow-sm transition-colors"
          >
            Manage Low Stock
          </button>
        </div>
      )}

      {/* Charts & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-kirana-600" />
                Sales & Profit Trends
              </h3>
              <p className="text-xs text-slate-500">Calculated from saved invoice records</p>
            </div>

            {/* Range selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg text-xs font-semibold self-start sm:self-auto">
              <button
                onClick={() => setChartRange('7days')}
                className={`px-3 py-1 rounded-md transition-all ${
                  chartRange === '7days'
                    ? 'bg-white dark:bg-slate-800 text-kirana-700 dark:text-kirana-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setChartRange('30days')}
                className={`px-3 py-1 rounded-md transition-all ${
                  chartRange === '30days'
                    ? 'bg-white dark:bg-slate-800 text-kirana-700 dark:text-kirana-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setChartRange('months')}
                className={`px-3 py-1 rounded-md transition-all ${
                  chartRange === 'months'
                    ? 'bg-white dark:bg-slate-800 text-kirana-700 dark:text-kirana-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${val}`}
                />
                <Tooltip
                  formatter={(val: any) => [formatINR(Number(val) || 0)]}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '12px',
                    border: 'none',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  name="Sales Revenue"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorSales)"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Gross Profit"
                  stroke="#0284c7"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorProfit)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-6 mt-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-kirana-600" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">Sales Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-600" />
              <span className="text-slate-600 dark:text-slate-300 font-medium">Estimated Gross Profit</span>
            </div>
          </div>
        </div>

        {/* Top-Selling Products */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-kirana-600" />
                Top-Selling Items
              </span>
              <button
                onClick={() => setActiveTab('reports')}
                className="text-xs text-kirana-700 dark:text-kirana-400 hover:underline"
              >
                All Reports
              </button>
            </h3>
            <p className="text-xs text-slate-500 mb-4">Ranked by revenue</p>

            <div className="space-y-3">
              {stats.topSelling.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center italic">
                  No sales recorded yet. Start billing!
                </p>
              ) : (
                stats.topSelling.map((prod, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-700 last:border-none">
                    <div className="flex items-center gap-2.5 truncate pr-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 font-bold text-[10px] flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <p className="font-semibold text-slate-800 dark:text-white truncate">{prod.name}</p>
                        <p className="text-[10px] text-slate-500">{prod.quantity} sold</p>
                      </div>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white shrink-0">
                      {formatINR(prod.revenue)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs text-slate-500">
            <span>Lifetime Gross Profit:</span>
            <span className="font-black text-emerald-600 dark:text-emerald-400">
              {formatINR(stats.totalLifetimeProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Transactions List */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-kirana-600" />
              Recent Completed Bills
            </h3>
            <p className="text-xs text-slate-500">Click to view, print or share on WhatsApp/SMS</p>
          </div>
          <button
            onClick={() => setActiveTab('reports')}
            className="text-xs font-semibold text-kirana-700 dark:text-kirana-400 hover:underline flex items-center gap-1"
          >
            <span>View All Bills</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          {stats.recentInvoices.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No bills found. Create your first bill using POS Billing.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {stats.recentInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-white">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(inv.date)}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                      {inv.customerName || 'Walk-in Customer'}
                      {inv.customerPhone && (
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {inv.customerPhone}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {inv.items.length} {inv.items.length === 1 ? 'item' : 'items'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded font-bold text-[10px] uppercase bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {inv.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white">
                      {formatINR(inv.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onOpenReceipt(inv)}
                        className="p-1.5 text-kirana-700 dark:text-kirana-400 hover:bg-kirana-50 dark:hover:bg-kirana-900/30 rounded-lg transition-colors"
                        title="View & Print Receipt"
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
    </div>
  );
};
