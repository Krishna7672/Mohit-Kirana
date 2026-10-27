import React, { useState, useRef, useEffect } from 'react';
import {
  db,
  DEFAULT_SETTINGS,
  exportDatabaseBackup,
  importDatabaseBackup,
  seedDemoData,
  purgeDemoData,
  autoScanAndSyncData
} from '../db';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  syncLocalToSupabase,
  restoreFromSupabase,
  isOnline
} from '../db/supabaseSync';
import type { StoreSettings } from '../types';
import {
  Settings,
  Store,
  Printer,
  Lock,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  Database,
  Info,
  Save,
  Trash2,
  RefreshCw,
  Sparkles,
  Smartphone,
  Monitor,
  HelpCircle,
  FileText,
  X,
  Cloud,
  CloudUpload,
  CloudDownload,
  Key,
  Globe
} from 'lucide-react';

interface Props {
  settings: StoreSettings;
  onSettingsUpdated: (newSettings: StoreSettings) => void;
}

export const SettingsView: React.FC<Props> = ({ settings, onSettingsUpdated }) => {
  // Store form state
  const [shopName, setShopName] = useState(settings.shopName);
  const [tagline, setTagline] = useState(settings.tagline || '');
  const [ownerName, setOwnerName] = useState(settings.ownerName || '');
  const [phone, setPhone] = useState(settings.phone || '');
  const [address, setAddress] = useState(settings.address || '');
  const [gstin, setGstin] = useState(settings.gstin || '');
  const [upiId, setUpiId] = useState(settings.upiId || '');
  const [receiptFooter, setReceiptFooter] = useState(settings.receiptFooter || '');
  const [thermalWidth, setThermalWidth] = useState<'58mm' | '80mm'>(settings.thermalWidth || '80mm');

  // Security / PIN lock
  const [pinEnabled, setPinEnabled] = useState(settings.pinEnabled || false);
  const [ownerPin, setOwnerPin] = useState(settings.ownerPin || '');

  // AI & Vision Scanner key
  const [geminiApiKey, setGeminiApiKey] = useState(
    settings.geminiApiKey || localStorage.getItem('kirana_gemini_api_key') || ''
  );

  // POS System Number / Terminal Tagging
  const [posTerminalName, setPosTerminalName] = useState(
    settings.posTerminalName || localStorage.getItem('kirana_pos_terminal') || 'POS-1'
  );

  // Mobile layout toggle
  const [forceMobileLayout, setForceMobileLayout] = useState(
    settings.forceMobileLayout ?? (localStorage.getItem('kirana_force_mobile_layout') === 'true')
  );

  // Multi-Device Access Guide Modal
  const [showDeviceGuideModal, setShowDeviceGuideModal] = useState(false);

  // Supabase Cloud Sync state
  const initialSupabaseConfig = getSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(
    settings.supabaseUrl || initialSupabaseConfig.url || ''
  );
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(
    settings.supabaseAnonKey || initialSupabaseConfig.anonKey || ''
  );
  const [supabaseEmail, setSupabaseEmail] = useState(
    settings.supabaseEmail || initialSupabaseConfig.email || ''
  );
  const [supabaseAutoSync, setSupabaseAutoSync] = useState(
    settings.supabaseAutoSync ?? initialSupabaseConfig.autoSync
  );
  const [supabaseStatusMessage, setSupabaseStatusMessage] = useState<string | null>(null);
  const [isSupabaseTesting, setIsSupabaseTesting] = useState(false);
  const [isSupabaseSyncing, setIsSupabaseSyncing] = useState(false);
  const [lastCloudSync, setLastCloudSync] = useState<string | null>(
    localStorage.getItem('kirana_last_supabase_sync')
  );

  // Status notification
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Backup file input ref
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  // Save Store Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    const updated: StoreSettings = {
      ...settings,
      shopName: shopName.trim() || 'Mohit Kirana',
      tagline: tagline.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      gstin: gstin.trim(),
      upiId: upiId.trim(),
      receiptFooter: receiptFooter.trim(),
      thermalWidth,
      pinEnabled,
      ownerPin: ownerPin.trim(),
      geminiApiKey: geminiApiKey.trim(),
      posTerminalName: posTerminalName.trim() || 'POS-1',
      forceMobileLayout,
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      supabaseEmail: supabaseEmail.trim(),
      supabaseAutoSync,
    };

    localStorage.setItem('kirana_gemini_api_key', geminiApiKey.trim());
    localStorage.setItem('kirana_pos_terminal', posTerminalName.trim() || 'POS-1');
    localStorage.setItem('kirana_force_mobile_layout', String(forceMobileLayout));

    saveSupabaseConfig({
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      email: supabaseEmail,
      autoSync: supabaseAutoSync,
    });

    await db.storeSettings.put(updated);
    onSettingsUpdated(updated);
    setSaveMessage('Settings & Supabase Cloud configuration saved successfully!');
    setTimeout(() => setSaveMessage(null), 3500);

    // If online and auto-sync is on and credentials exist, trigger quick sync
    if (isOnline() && supabaseAutoSync && supabaseUrl.trim() && supabaseAnonKey.trim()) {
      syncLocalToSupabase().then((res) => {
        if (res.success) {
          setLastCloudSync(new Date().toISOString());
        }
      });
    }
  };

  const handleTestSupabase = async () => {
    setIsSupabaseTesting(true);
    setSupabaseStatusMessage(null);
    saveSupabaseConfig({
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      email: supabaseEmail,
      autoSync: supabaseAutoSync,
    });
    const res = await testSupabaseConnection();
    setSupabaseStatusMessage(res.message);
    setIsSupabaseTesting(false);
  };

  const handleSyncToSupabase = async () => {
    setIsSupabaseSyncing(true);
    setSupabaseStatusMessage(null);
    saveSupabaseConfig({
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      email: supabaseEmail,
      autoSync: supabaseAutoSync,
    });
    const res = await syncLocalToSupabase();
    setSupabaseStatusMessage(res.message);
    if (res.success) {
      setLastCloudSync(new Date().toISOString());
    }
    setIsSupabaseSyncing(false);
  };

  const handleRestoreFromSupabase = async () => {
    const confirm = window.confirm(
      'Download and restore data from Supabase Cloud into this device? This will merge your cloud records into local memory without deleting existing items.'
    );
    if (!confirm) return;

    setIsSupabaseSyncing(true);
    setSupabaseStatusMessage(null);
    const res = await restoreFromSupabase();
    setSupabaseStatusMessage(res.message);
    setIsSupabaseSyncing(false);
    if (res.success) {
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  // Download Store Profile Details
  const handleDownloadProfileDetails = () => {
    const profileText = `
======================================================
           MOHIT KIRANA STORE PROFILE & POS
======================================================
Store Name      : ${shopName || 'Mohit Kirana'}
Tagline         : ${tagline || 'Aapki Apni Kirana Dukan'}
Owner Name      : ${ownerName || 'Mohit Kumar'}
Contact Mobile  : ${phone || 'Not Specified'}
Store Address   : ${address || 'Not Specified'}
GSTIN Number    : ${gstin || 'Not Registered'}
UPI Payment ID  : ${upiId || 'Not Configured'}
POS Terminal ID : ${posTerminalName || 'POS-1'}
Receipt Note    : ${receiptFooter || 'Dhanyawad! Please visit again.'}
======================================================
Generated Date  : ${new Date().toLocaleString()}
Application     : Mohit Kirana Smart POS & Retail
Developer       : This app made by Nahata Software's
======================================================
`;
    const blob = new Blob([profileText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${shopName.replace(/\s+/g, '_')}_profile.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Full JSON Database Backup Download
  const handleExportBackup = async () => {
    try {
      const jsonBackup = await exportDatabaseBackup();
      const blob = new Blob([jsonBackup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mohit_kirana_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Backup export failed';
      alert(`Error creating backup: ${msg}`);
    }
  };

  // Full JSON Database Restore with Confirmation
  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmRestore = window.confirm(
      'WARNING: Restoring a backup will overwrite current local data with the backup contents.\nAre you sure you want to proceed?'
    );

    if (!confirmRestore) {
      if (backupInputRef.current) backupInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = await importDatabaseBackup(content);
        if (result.success) {
          alert(result.message);
          window.location.reload();
        } else {
          alert(`Restore failed: ${result.message}`);
        }
      }
    };
    reader.readAsText(file);
  };

  // Reset Database to Mohit Kirana Store Backup
  const handleLoadSampleData = async () => {
    try {
      await seedDemoData();
      localStorage.setItem('mohit_kirana_backup_loaded_v1', 'true');
      setSaveMessage('Mohit Kirana store data (42 products, 4 parties, 9 bills) loaded successfully!');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load backup';
      alert(`Error loading data: ${msg}`);
    }
  };

  // Clear All Database Data
  const handleClearAllData = async () => {
    const doubleConfirm = window.prompt('Type "DELETE" to permanently erase all records from this browser:');
    if (doubleConfirm === 'DELETE') {
      await Promise.all([
        db.products.clear(),
        db.customers.clear(),
        db.invoices.clear(),
        db.udharLedger.clear(),
        db.stockMovements.clear(),
        db.suppliers.clear(),
        db.purchases.clear(),
      ]);
      await db.storeSettings.put(DEFAULT_SETTINGS);
      alert('All local store data cleared.');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-8 max-w-4xl">
      {/* Top Header */}
      <div>
        <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-kirana-600" />
          Store Profile, Settings & Offline Backup
        </h2>
        <p className="text-xs text-slate-500">
          Configure shop details, thermal printing format, local lock, and JSON data safety
        </p>
      </div>

      {saveMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Shop Information Card */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-slate-700">
            <Store className="w-4 h-4 text-kirana-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Kirana Store Identity
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Shop Name *</label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Shop Tagline</label>
              <input
                type="text"
                placeholder="e.g. Aapki Apni Kirana Dukan"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Owner Name</label>
              <input
                type="text"
                placeholder="e.g. Mohit Kumar"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Contact Mobile *</label>
              <input
                type="tel"
                required
                placeholder="e.g. +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-mono"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Store Address</label>
              <input
                type="text"
                placeholder="e.g. Shop No. 12, Main Market, Sector 4"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">GSTIN (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 07AAAAA0000A1Z5"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-mono uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                UPI ID (for bill QR payment)
              </label>
              <input
                type="text"
                placeholder="e.g. mohitkirana@okhdfcbank"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-mono"
              />
            </div>

            {/* POS System Terminal ID */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>POS System Number / Device Name</span>
                <span className="text-[10px] text-kirana-600 font-bold">Multi-Device Tag</span>
              </label>
              <input
                type="text"
                placeholder="e.g. POS-1, POS-2, Counter-1, Mobile-2"
                value={posTerminalName}
                onChange={(e) => setPosTerminalName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-mono font-bold text-kirana-700 dark:text-kirana-400"
              />
              <p className="text-[10px] text-slate-400">
                When using multiple phones or computers, products scanned and bills generated will display &quot;Entry by: {posTerminalName || 'POS-1'}&quot;.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={handleDownloadProfileDetails}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-kirana-600" />
              <span>Download Store Profile Summary</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDeviceGuideModal(true)}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>How to Access on Another Device / Phone?</span>
            </button>
          </div>
        </div>

        {/* Display & Layout Settings (Mobile Toggle) */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-kirana-600" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Display & Mobile Layout Toggle
              </h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={forceMobileLayout}
                onChange={(e) => setForceMobileLayout(e.target.checked)}
                className="w-4 h-4 rounded text-kirana-600 focus:ring-kirana-500"
              />
              <span>Force Handheld Mobile Layout</span>
            </label>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {forceMobileLayout
              ? 'Active: App is constrained to a compact, handheld mobile phone layout with bottom navigation — optimal for mobile phones, tablets, or touch billing counters.'
              : 'Default: Responsive desktop layout adapts automatically to screen size.'}
          </p>
        </div>

        {/* Receipt & Thermal Printer Settings */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-slate-700">
            <Printer className="w-4 h-4 text-kirana-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Receipt & Thermal Printer Settings
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Default Thermal Paper Width
              </label>
              <select
                value={thermalWidth}
                onChange={(e) => setThermalWidth(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold"
              >
                <option value="80mm">80mm (Standard POS Thermal Printer)</option>
                <option value="58mm">58mm (Compact Mobile Bluetooth Printer)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Receipt Footer Terms / Thank You Note
              </label>
              <input
                type="text"
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                placeholder="e.g. Dhanyawad! Please visit again."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Security / App Lock PIN */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-kirana-600" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Owner PIN & Device Screen Lock
              </h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={pinEnabled}
                onChange={(e) => setPinEnabled(e.target.checked)}
                className="rounded text-kirana-600 focus:ring-kirana-500"
              />
              <span>Enable PIN Lock</span>
            </label>
          </div>

          {pinEnabled && (
            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                4-Digit Security PIN
              </label>
              <input
                type="password"
                maxLength={6}
                placeholder="e.g. 1234"
                value={ownerPin}
                onChange={(e) => setOwnerPin(e.target.value)}
                className="w-48 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-mono tracking-widest text-center text-sm font-bold"
              />
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p>
                  Security notice: This client-side PIN protects against accidental or unauthorized touches on this shared counter device. It is intended for shop operational convenience.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* AI & Product Packaging Scanner Settings */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-slate-700">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Whole Product AI Packaging Scanner
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Offline Tesseract OCR Engine (Always Active)</span>
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Runs 100% locally on your device without internet. Extracts product text, MRP, net quantity, unit and barcodes using smart Kirana pattern recognition and Master Catalog matching.
              </p>
            </div>

            <div className="space-y-1 pt-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Google Gemini Vision API Key (Optional)</span>
                <span className="text-[10px] text-kirana-600 font-bold">For 99.9% High Accuracy Extraction</span>
              </label>
              <input
                type="password"
                placeholder="Paste Gemini API Key (e.g. AIzaSy...)"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-mono text-xs"
              />
              <p className="text-[11px] text-slate-400">
                If provided, packaging photos are analyzed with Gemini 2.5 Flash Vision to instantly read Hindi & English product names, MRP price, brand and net weight. Leave blank to use offline mode.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          className="flex items-center justify-center gap-2 w-full py-3 bg-kirana-700 hover:bg-kirana-800 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-98"
        >
          <Save className="w-4 h-4" />
          <span>Save Store Settings</span>
        </button>
      </form>

      {/* Secure Cloud Backup & Multi-Device Sync Section */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-700 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <span>Cloud Backup &amp; Multi-Device Sync</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 font-bold border border-emerald-300">
                  Encrypted &amp; Private
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Safeguard all products, bills &amp; udhar to cloud automatically when online
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                isOnline()
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline() ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span>{isOnline() ? 'Online (Ready to Sync)' : 'Offline (Saving Locally)'}</span>
            </span>
          </div>
        </div>

        {/* Status Message */}
        {supabaseStatusMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
              supabaseStatusMessage.includes('error') || supabaseStatusMessage.includes('failed') || supabaseStatusMessage.includes('missing')
                ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
            }`}
          >
            <Info className="w-4 h-4 shrink-0" />
            <span className="flex-1">{supabaseStatusMessage}</span>
            <button onClick={() => setSupabaseStatusMessage(null)} className="hover:opacity-75">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Options */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={supabaseAutoSync}
              onChange={(e) => setSupabaseAutoSync(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600"
            />
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Automatically sync local records to cloud whenever device is online
            </span>
          </label>

          {lastCloudSync && (
            <span className="text-[11px] text-slate-400">
              Last synced: {new Date(lastCloudSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Cloud Actions Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs">
          <button
            type="button"
            onClick={handleSyncToSupabase}
            disabled={isSupabaseSyncing}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-sm transition-all active:scale-98 disabled:opacity-50"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>{isSupabaseSyncing ? 'Syncing...' : 'Sync to Cloud Now'}</span>
          </button>

          <button
            type="button"
            onClick={handleRestoreFromSupabase}
            disabled={isSupabaseSyncing}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-sm transition-all active:scale-98 disabled:opacity-50"
          >
            <CloudDownload className="w-3.5 h-3.5" />
            <span>Restore from Cloud</span>
          </button>

          <button
            type="button"
            onClick={handleTestSupabase}
            disabled={isSupabaseTesting}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-800 dark:text-slate-200 font-bold rounded-xl transition-all active:scale-98 disabled:opacity-50"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{isSupabaseTesting ? 'Checking...' : 'Check Cloud Connection'}</span>
          </button>
        </div>
      </div>

      {/* Offline Data Management & Full Database Backup / Restore */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-slate-700">
          <Database className="w-4 h-4 text-kirana-600" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Offline Storage & Complete Data Backup
          </h3>
        </div>

        <p className="text-xs text-slate-500">
          Mohit Kirana stores 100% of your records locally inside browser IndexedDB (Dexie.js). Your data is private, zero-latency, and never leaves your computer or phone. Take regular backups to protect your records.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Export Full Backup */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="font-bold text-slate-800 dark:text-white">Download Backup (JSON)</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Saves all products, customers, bills, udhar ledgers and audit records into a single safe JSON file.
              </p>
            </div>
            <button
              onClick={handleExportBackup}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-kirana-700 hover:bg-kirana-800 text-white font-bold rounded-xl shadow-sm transition-all active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>Export JSON Backup</span>
            </button>
          </div>

          {/* Auto-Scan & Sync Data */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="font-bold text-slate-800 dark:text-white">Auto-Scan & Verify Data</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Scans all offline records, validates data integrity, and updates the persistent snapshot.
              </p>
            </div>
            <button
              onClick={async () => {
                const res = await autoScanAndSyncData();
                alert(res.message);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-sm transition-all active:scale-98"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Scan & Verify Now</span>
            </button>
          </div>

          {/* Restore Backup */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="font-bold text-slate-800 dark:text-white">Restore Backup (JSON)</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Restore previously downloaded JSON backup file with validation and confirmation.
              </p>
            </div>
            <input
              type="file"
              ref={backupInputRef}
              onChange={handleRestoreBackup}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => backupInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-sm transition-all active:scale-98"
            >
              <Upload className="w-4 h-4" />
              <span>Restore from File</span>
            </button>
          </div>
        </div>

        {/* Demo Data & Danger Zone */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={async () => {
                const res = await purgeDemoData();
                alert(res.message);
                window.location.reload();
              }}
              className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Fake & Demo Data</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSampleData}
              className="flex items-center gap-1.5 text-kirana-700 dark:text-kirana-400 font-bold hover:underline text-[11px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Load Mohit Kirana Store Data</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleClearAllData}
            className="text-red-600 font-semibold hover:underline"
          >
            Clear All Local Data
          </button>
        </div>
      </div>

      {/* Footer Credit & Nahata Software's Attribution */}
      <div className="pt-6 pb-4 text-center border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800/80 rounded-full text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs border border-slate-200 dark:border-slate-700">
          <Sparkles className="w-4 h-4 text-kirana-600 animate-pulse" />
          <span>This app made by Nahata Software&apos;s</span>
        </div>
        <p className="text-[11px] text-slate-400 font-medium">
          Mohit Kirana POS &bull; Version 2.0 &bull; Built with pride for Indian Kirana &amp; Retail Stores
        </p>
      </div>

      {/* Multi-Device Sync & Access Guide Modal */}
      {showDeviceGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-kirana-50 dark:bg-kirana-950/50 rounded-xl text-kirana-700 dark:text-kirana-300">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    How to Access &amp; Sync Data on Another Device
                  </h3>
                  <p className="text-xs text-slate-400">
                    Run Mohit Kirana across phone, tablet, and PC counters
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeviceGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3.5 bg-kirana-50 dark:bg-kirana-950/40 border border-kirana-200 dark:border-kirana-800/60 rounded-2xl space-y-1">
                <p className="font-bold text-kirana-900 dark:text-kirana-200 text-sm">
                  100% Privacy &amp; Zero Cloud Lock-In:
                </p>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Your store&apos;s inventory, udhar khata, and sales are kept securely inside your device storage (IndexedDB) for lightning-fast offline operation even when internet is completely down.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-kirana-700 text-white inline-flex items-center justify-center text-[10px]">1</span>
                    Method 1: Instant WhatsApp / File Backup Transfer
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    On this primary device, click <strong>&quot;Export JSON Backup&quot;</strong> in Settings. Send the downloaded <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">.json</code> file to your other phone/laptop via WhatsApp, Bluetooth, or Email. Open Mohit Kirana on the second device and click <strong>&quot;Restore from File&quot;</strong>. All products, customers, and history appear immediately!
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-kirana-700 text-white inline-flex items-center justify-center text-[10px]">2</span>
                    Method 2: Multi-Counter Wi-Fi Access (Live Same Shop)
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Connect both your main PC/laptop and mobile phone to the same shop Wi-Fi / Mobile Hotspot. Run <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">npm run dev -- --host</code> on the host PC. Open Chrome on your phone and browse to <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">http://[PC-Local-IP]:5173</code> to scan and bill concurrently!
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-kirana-700 text-white inline-flex items-center justify-center text-[10px]">3</span>
                    POS Terminal Labeling (POS-1, POS-2)
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Set this device as <strong>POS-1 (Main Counter)</strong> and your second mobile as <strong>POS-2 (Mobile Scanner)</strong> using the POS System Terminal field above. Every scan, stock addition, and receipt will clearly log <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">Entry by: POS-2</code>!
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDeviceGuideModal(false)}
                className="px-5 py-2.5 bg-kirana-700 hover:bg-kirana-800 text-white font-bold rounded-xl text-xs transition-all active:scale-98"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
