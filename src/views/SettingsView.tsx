import React, { useState, useRef } from 'react';
import { db, DEFAULT_SETTINGS, exportDatabaseBackup, importDatabaseBackup, seedDemoData } from '../db';
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
  Save
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
    };

    await db.storeSettings.put(updated);
    onSettingsUpdated(updated);
    setSaveMessage('Settings updated successfully!');
    setTimeout(() => setSaveMessage(null), 3000);
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

  // Reset Database to Demo Data
  const handleLoadSampleData = async () => {
    const confirmed = window.confirm('Load sample demonstration products and customers? Existing data will be preserved unless duplicated.');
    if (confirmed) {
      await seedDemoData();
      alert('Sample demonstration inventory and party records loaded!');
      window.location.reload();
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
          </div>
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

        {/* Save Button */}
        <button
          type="submit"
          className="flex items-center justify-center gap-2 w-full py-3 bg-kirana-700 hover:bg-kirana-800 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-98"
        >
          <Save className="w-4 h-4" />
          <span>Save Store Settings</span>
        </button>
      </form>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Export Full Backup */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex flex-col justify-between space-y-3">
            <div>
              <h4 className="font-bold text-slate-800 dark:text-white">Download Full Backup (JSON)</h4>
              <p className="text-[11px] text-slate-500 mt-1">
                Saves all products, customers, bills, udhar ledgers and audit records into a single safe JSON file.
              </p>
            </div>
            <button
              onClick={handleExportBackup}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-kirana-700 hover:bg-kirana-800 text-white font-bold rounded-xl shadow-sm transition-all active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>Export Complete JSON Backup</span>
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
              <span>Restore from Backup File</span>
            </button>
          </div>
        </div>

        {/* Demo Data & Danger Zone */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={handleLoadSampleData}
            className="flex items-center gap-1.5 text-kirana-700 dark:text-kirana-400 font-bold hover:underline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Load Demo Sample Grocery Data</span>
          </button>

          <button
            type="button"
            onClick={handleClearAllData}
            className="text-red-600 font-semibold hover:underline"
          >
            Clear All Local Data
          </button>
        </div>
      </div>
    </div>
  );
};
