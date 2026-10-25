import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_SETTINGS, initializeDatabase } from './db';
import type { Invoice, StoreSettings } from './types';
import { Navigation, type ActiveTab } from './components/Navigation';
import { DashboardView } from './views/DashboardView';
import { POSBillingView } from './views/POSBillingView';
import { InventoryView } from './views/InventoryView';
import { CustomerManagementView } from './views/CustomerManagementView';
import { UdharKhataView } from './views/UdharKhataView';
import { PurchasesView } from './views/PurchasesView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { ReceiptModal } from './components/ReceiptModal';
import { PinLockModal } from './components/PinLockModal';
import { DownloadCloud, X } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeReceiptInvoice, setActiveReceiptInvoice] = useState<Invoice | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Quick navigation helpers
  const [openProductModalOnNav, setOpenProductModalOnNav] = useState(false);
  const [openCustomerModalOnNav, setOpenCustomerModalOnNav] = useState(false);
  const [posPreselectedCustomerId, setPosPreselectedCustomerId] = useState<number | null>(null);

  // Security Lock
  const [isAppLocked, setIsAppLocked] = useState(false);

  // PWA Install prompt event
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Initialize DB on first render
  useEffect(() => {
    initializeDatabase().catch(console.error);

    // Listen for beforeinstallprompt for PWA
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // Theme effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Live Query Store Settings
  const settingsArray = useLiveQuery(() => db.storeSettings.toArray()) || [];
  const settings: StoreSettings = settingsArray[0] || DEFAULT_SETTINGS;

  // Live Query products & customers for badges
  const products = useLiveQuery(() => db.products.filter(p => !p.isArchived).toArray()) || [];
  const customers = useLiveQuery(() => db.customers.toArray()) || [];

  const lowStockCount = products.filter(
    (p) => p.stockQuantity <= p.minStockThreshold
  ).length;

  const totalUdhar = customers.reduce(
    (sum, c) => sum + (c.outstandingUdhar || 0),
    0
  );

  const handleOpenReceipt = (invoice: Invoice) => {
    setActiveReceiptInvoice(invoice);
    setIsReceiptOpen(true);
  };

  const handlePwaInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row antialiased">
      {/* Navigation (Sidebar on Desktop, Bottom bar on mobile) */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setOpenProductModalOnNav(false);
          setOpenCustomerModalOnNav(false);
        }}
        shopName={settings.shopName}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onLockApp={() => setIsAppLocked(true)}
        isPinConfigured={Boolean(settings.pinEnabled && settings.ownerPin)}
        lowStockCount={lowStockCount}
        totalUdhar={totalUdhar}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden pt-16 lg:pt-0">
        {/* PWA Install Banner */}
        {showInstallBanner && (
          <div className="no-print bg-kirana-800 text-white px-4 py-2.5 flex items-center justify-between text-xs font-medium shadow-md">
            <div className="flex items-center gap-2">
              <DownloadCloud className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>Install <strong>Mohit Kirana</strong> app for 1-tap offline desktop/mobile access!</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePwaInstall}
                className="px-3 py-1 bg-white text-kirana-900 rounded-lg font-bold text-[11px] shadow-sm hover:bg-kirana-50"
              >
                Install App
              </button>
              <button
                onClick={() => setShowInstallBanner(false)}
                className="p-1 text-kirana-200 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tab Views */}
        <div className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              setActiveTab={setActiveTab}
              onOpenReceipt={handleOpenReceipt}
              onQuickNewProduct={() => {
                setOpenProductModalOnNav(true);
                setActiveTab('inventory');
              }}
              onQuickNewCustomer={() => {
                setOpenCustomerModalOnNav(true);
                setActiveTab('customers');
              }}
              settings={settings}
            />
          )}

          {activeTab === 'pos' && (
            <POSBillingView
              settings={settings}
              onOpenReceipt={handleOpenReceipt}
              preselectedCustomerId={posPreselectedCustomerId}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              settings={settings}
              openNewProductModalOnMount={openProductModalOnNav}
            />
          )}

          {activeTab === 'customers' && (
            <CustomerManagementView
              settings={settings}
              onOpenReceipt={handleOpenReceipt}
              onStartPosWithCustomer={(customerId) => {
                setPosPreselectedCustomerId(customerId);
                setActiveTab('pos');
              }}
              openNewCustomerModalOnMount={openCustomerModalOnNav}
            />
          )}

          {activeTab === 'udhar' && <UdharKhataView settings={settings} />}

          {activeTab === 'purchases' && <PurchasesView settings={settings} />}

          {activeTab === 'reports' && (
            <ReportsView
              settings={settings}
              onOpenReceipt={handleOpenReceipt}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSettingsUpdated={(newSet) => {
                // Settings auto-update via Dexie live query
              }}
            />
          )}
        </div>
      </main>

      {/* Global Receipt Print / Share Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        invoice={activeReceiptInvoice}
        settings={settings}
      />

      {/* PIN Lock Screen Modal */}
      <PinLockModal
        isLocked={isAppLocked}
        correctPin={settings.ownerPin || ''}
        shopName={settings.shopName}
        onUnlock={() => setIsAppLocked(false)}
      />
    </div>
  );
}

export default App;
