import React, { useState } from 'react';
import type { StoreSettings } from '../types';
import { formatINR, formatDate } from '../utils/formatters';
import {
  buildUdharRepaymentMessage,
  getWhatsAppClickUrl,
  getSmsClickUrl,
  type UdharRepaymentReceiptInfo
} from '../utils/notifications';
import {
  CheckCircle2,
  MessageCircle,
  Smartphone,
  Copy,
  Check,
  X,
  Share2,
  Receipt,
  Sparkles
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  receiptInfo: UdharRepaymentReceiptInfo | null;
  settings: StoreSettings;
}

export const RepaymentReceiptModal: React.FC<Props> = ({
  isOpen,
  onClose,
  receiptInfo,
  settings,
}) => {
  const [copied, setCopied] = useState(false);
  const [customPhone, setCustomPhone] = useState('');

  if (!isOpen || !receiptInfo) return null;

  const targetPhone = (customPhone || receiptInfo.phone || '').trim();
  const repaymentMessage = buildUdharRepaymentMessage(receiptInfo, settings);
  const isCleared = receiptInfo.remainingBalance <= 0;

  const handleWhatsApp = () => {
    if (!targetPhone) {
      alert('Please enter a 10-digit mobile number to send WhatsApp message.');
      return;
    }
    const url = getWhatsAppClickUrl(targetPhone, repaymentMessage);
    window.open(url, '_blank');
  };

  const handleSms = () => {
    if (!targetPhone) {
      alert('Please enter a 10-digit mobile number to send SMS.');
      return;
    }
    const url = getSmsClickUrl(targetPhone, repaymentMessage);
    window.location.href = url;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(repaymentMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-700 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                Payment Recorded! (भुगतान दर्ज हुआ)
              </h3>
              <p className="text-[11px] text-emerald-100">
                Send WhatsApp or SMS receipt to customer
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
        <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
          {/* Payment Summary Box */}
          <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2.5">
            <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-800/40 pb-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                  Customer (ग्राहक):
                </span>
                <span className="font-black text-sm text-slate-900 dark:text-white">
                  {receiptInfo.customerName}
                </span>
              </div>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                Mode: {(receiptInfo.paymentMethod || 'cash').toUpperCase()}
              </span>
            </div>

            <div className="flex justify-between items-baseline pt-1">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Amount Received (प्राप्त राशि):
              </span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {formatINR(receiptInfo.amountPaid)}
              </span>
            </div>

            <div className="flex justify-between items-baseline pt-1 border-t border-dashed border-emerald-200 dark:border-emerald-800">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Remaining Udhar (बचा हुआ उधार):
              </span>
              <span className={`text-base font-black ${isCleared ? 'text-emerald-600' : 'text-red-600'}`}>
                {isCleared ? '₹0.00 (All Cleared! 🎉)' : formatINR(receiptInfo.remainingBalance)}
              </span>
            </div>
          </div>

          {/* Target Mobile Number */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Customer Mobile (व्हाट्सएप / एसएमएस नंबर):</span>
              {receiptInfo.phone && !customPhone && (
                <span className="text-[10px] text-slate-400 font-mono">Saved: {receiptInfo.phone}</span>
              )}
            </label>
            <input
              type="tel"
              placeholder={receiptInfo.phone || 'Enter 10-digit mobile number'}
              value={customPhone}
              onChange={(e) => setCustomPhone(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Sharing Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleWhatsApp}
              className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>Send WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleSms}
              className="py-3 px-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all"
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>Send SMS</span>
            </button>
          </div>

          {/* Copy Message Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs border border-slate-200 dark:border-slate-700"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{copied ? 'Receipt Copied to Clipboard!' : 'Copy Receipt Message (कापी करें)'}</span>
          </button>

          {/* Message Preview Accordion */}
          <div className="space-y-1 pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Message Preview (ग्राहक को जाने वाला संदेश):
            </span>
            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
              {repaymentMessage}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
          >
            Done (पूर्ण)
          </button>
        </div>
      </div>
    </div>
  );
};

