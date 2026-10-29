import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_SETTINGS, initializeDatabase, autoScanAndSyncData } from './db';
import { setupAutoOnlineSync, syncLocalToSupabase, restoreFromSupabase, syncBidirectional } from './db/supabaseSync';
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
import { DownloadCloud, X, CheckCircle2 } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeReceiptInvoice, setActiveReceiptInvoice] = useState<Invoice | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Auto-scan & Data Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Quick navigation helpers
  const [openProductModalOnNav, setOpenProductModalOnNav] = useState(false);
  const [openCustomerModalOnNav, setOpenCustomerModalOnNav] = useState(false);
  const [posPreselectedCustomerId, setPosPreselectedCustomerId] = useState<number | null>(null);

  // Security Lock
  const [isAppLocked, setIsAppLocked] = useState(false);

  // PWA Install prompt event
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await autoScanAndSyncData();
      if (res.success) {
        setSyncStatus(res.message);
        setTimeout(() => setSyncStatus(null), 3500);
      }
    } catch (err) {
      console.error('Data sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Initialize DB & auto-scan data on every refresh/app start
  useEffect(() => {
    initializeDatabase()
      .then(async () => {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            const res = await syncBidirectional();
            if (res.success && res.syncedCounts) {
              setSyncStatus(`Cloud sync: ${res.syncedCounts.products} items & ${res.syncedCounts.customers} parties synced!`);
              setTimeout(() => setSyncStatus(null), 3500);
            }
          } catch (e) {
            console.warn('Initial cloud sync warning:', e);
          }
        }
        return handleTriggerSync();
      })
      .catch(console.error);

    // Setup automatic background sync & realtime listeners to Supabase
    setupAutoOnlineSync((status) => {
      if (status.message) {
        setSyncStatus(status.message);
        setTimeout(() => setSyncStatus(null), 4000);
      }
    });

    // Periodic 30-second heartbeat cloud sync when online
    const syncInterval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        syncBidirectional().catch(() => {});
      }
    }, 30 * 1000);

    // Listen for beforeinstallprompt for PWA
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      clearInterval(syncInterval);
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

  const isForcedMobile = Boolean(settings.forceMobileLayout);

  return (
    <div className={`min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased ${
      isForcedMobile
        ? 'flex justify-center p-0 sm:py-4'
        : 'flex flex-col lg:flex-row'
    }`}>
      <div className={`w-full min-h-screen flex ${
        isForcedMobile
          ? 'max-w-md bg-slate-50 dark:bg-slate-900 shadow-2xl border-x border-slate-200 dark:border-slate-800 flex-col relative pb-16'
          : 'flex-col lg:flex-row'
      }`}>
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
          onTriggerSync={handleTriggerSync}
          isSyncing={isSyncing}
          forceMobileLayout={isForcedMobile}
        />

        {/* Main Content Area */}
        <main className={`flex-1 flex flex-col min-w-0 overflow-x-hidden ${isForcedMobile ? 'pt-14' : 'pt-16 lg:pt-0'}`}>
          {/* Sync Status Banner */}
          {syncStatus && (
            <div className="no-print bg-emerald-600 text-white px-4 py-2 flex items-center justify-between text-xs font-semibold shadow-md animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                <span>{syncStatus}</span>
              </div>
              <button
                onClick={() => setSyncStatus(null)}
                className="p-1 text-emerald-200 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

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
          <div className={`flex-1 w-full mx-auto ${isForcedMobile ? 'p-3' : 'p-4 sm:p-6 lg:p-8 max-w-7xl'}`}>
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
      </div>

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
