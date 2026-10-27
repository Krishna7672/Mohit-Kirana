import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  BookOpen,
  Truck,
  BarChart3,
  Settings,
  Store,
  Moon,
  Sun,
  Lock,
  RefreshCw,
  Cloud
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'pos'
  | 'inventory'
  | 'customers'
  | 'udhar'
  | 'purchases'
  | 'reports'
  | 'settings';

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: LucideIcon;
  highlight?: boolean;
  badge?: number;
}

interface Props {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  shopName: string;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  onLockApp?: () => void;
  isPinConfigured: boolean;
  lowStockCount: number;
  totalUdhar: number;
  onTriggerSync?: () => void;
  isSyncing?: boolean;
  forceMobileLayout?: boolean;
}

export const Navigation: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  shopName,
  isDarkMode,
  setIsDarkMode,
  onLockApp,
  isPinConfigured,
  lowStockCount,
  onTriggerSync,
  isSyncing,
  forceMobileLayout = false,
}) => {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'POS Billing', icon: ShoppingCart, highlight: true },
    { id: 'inventory', label: 'Inventory', icon: Package, badge: lowStockCount > 0 ? lowStockCount : undefined },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'udhar', label: 'Udhar Khata', icon: BookOpen },
    { id: 'purchases', label: 'Stock Inward', icon: Truck },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Sidebar (Left) */}
      <aside className={`no-print ${forceMobileLayout ? 'hidden' : 'hidden lg:flex'} flex-col w-64 bg-kirana-950 text-white shrink-0 shadow-xl border-r border-kirana-900 z-30`}>
        {/* Brand Header */}
        <div className="p-5 flex items-center gap-3 border-b border-kirana-900/60 bg-kirana-900/30">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-kirana-500/20 ring-1 ring-white/10 shrink-0">
            <img src="/favicon.svg" alt="Mohit Kirana Logo" className="w-full h-full object-cover" />
          </div>
          <div className="overflow-hidden">
            <h1 className="font-extrabold text-base tracking-tight text-white truncate">
              {shopName || 'Mohit Kirana'}
            </h1>
            <p className="text-[11px] text-kirana-300 font-medium">Grocery POS &amp; Khata</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all ${
                  isActive
                    ? 'bg-kirana-600 text-white shadow-md shadow-kirana-900/50 font-bold'
                    : item.highlight
                    ? 'bg-kirana-900/80 text-kirana-200 hover:bg-kirana-800 hover:text-white border border-kirana-700/50'
                    : 'text-kirana-200/80 hover:bg-kirana-900/50 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-kirana-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white shadow-sm">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Desktop Sidebar Footer */}
        <div className="p-4 border-t border-kirana-900/80 bg-kirana-900/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-kirana-300">Offline-First (Dexie)</span>
            <div className="flex items-center gap-1.5" title="Local Offline Database with Encrypted Cloud Sync">
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-semibold text-emerald-300">Cloud Sync</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-1.5 rounded-lg bg-kirana-900/70 hover:bg-kirana-800 text-kirana-200 transition-colors"
                title="Toggle theme"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {onTriggerSync && (
                <button
                  onClick={onTriggerSync}
                  className={`p-1.5 rounded-lg bg-kirana-900/70 hover:bg-kirana-800 text-kirana-200 transition-colors ${
                    isSyncing ? 'animate-spin text-emerald-300' : ''
                  }`}
                  title="Auto-Scan &amp; Verify Data"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>

            {isPinConfigured && onLockApp && (
              <button
                onClick={onLockApp}
                className="flex items-center gap-1 text-[11px] text-kirana-300 hover:text-white bg-kirana-900/70 hover:bg-kirana-800 px-2.5 py-1 rounded-lg transition-colors"
                title="Lock Application"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock POS</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Top App Bar */}
      <header className={`no-print ${forceMobileLayout ? 'fixed top-0 max-w-md inset-x-0 mx-auto' : 'fixed top-0 inset-x-0 lg:hidden'} h-14 bg-kirana-950 text-white flex items-center justify-between px-4 z-40 border-b border-kirana-900 shadow-md`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-white/10 shrink-0 shadow-sm">
            <img src="/favicon.svg" alt="Mohit Kirana Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-sm tracking-tight truncate max-w-[150px]">
            {shopName || 'Mohit Kirana'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onTriggerSync && (
            <button
              onClick={onTriggerSync}
              className={`p-1.5 rounded-lg text-kirana-300 hover:text-white ${
                isSyncing ? 'animate-spin text-emerald-400' : ''
              }`}
              title="Auto-Scan &amp; Sync Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {isPinConfigured && onLockApp && (
            <button
              onClick={onLockApp}
              className="p-1.5 rounded-lg text-kirana-300 hover:text-white"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 rounded-lg text-kirana-300 hover:text-white"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTab === 'settings' ? 'bg-kirana-800 text-white' : 'text-kirana-300 hover:text-white'
            }`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className={`no-print ${forceMobileLayout ? 'fixed bottom-0 max-w-md inset-x-0 mx-auto' : 'fixed bottom-0 inset-x-0 lg:hidden'} h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 z-40 shadow-lg`}>
        {[
          { id: 'dashboard' as const, label: 'Home', icon: LayoutDashboard },
          { id: 'pos' as const, label: 'Bill', icon: ShoppingCart, highlight: true },
          { id: 'inventory' as const, label: 'Stock', icon: Package, badge: lowStockCount > 0 ? lowStockCount : undefined },
          { id: 'udhar' as const, label: 'Udhar', icon: BookOpen },
          { id: 'customers' as const, label: 'Party', icon: Users },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center relative transition-colors ${
                isActive
                  ? 'text-kirana-700 dark:text-kirana-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${item.highlight && !isActive ? 'text-kirana-600' : ''}`} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-amber-500 text-white text-[9px] rounded-full font-bold">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
