import React, { useState } from 'react';
import type { Invoice, StoreSettings } from '../types';
import { formatINR, formatDate, formatDateTime } from '../utils/formatters';
import { buildReceiptMessage, getWhatsAppClickUrl, getSmsClickUrl } from '../utils/notifications';
import {
  X,
  Printer,
  Share2,
  MessageCircle,
  Smartphone,
  Copy,
  Check,
  FileText,
  AlertCircle
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  settings: StoreSettings;
}

export const ReceiptModal: React.FC<Props> = ({
  isOpen,
  onClose,
  invoice,
  settings
}) => {
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');
  const [customPhone, setCustomPhone] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !invoice) return null;

  const targetPhone = customPhone || invoice.customerPhone || '';
  const receiptMessage = buildReceiptMessage(invoice, settings);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(receiptMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    if (!targetPhone) {
      alert('Please enter a 10-digit customer mobile number below to send via WhatsApp.');
      return;
    }
    const url = getWhatsAppClickUrl(targetPhone, receiptMessage);
    window.open(url, '_blank');
  };

  const handleSmsShare = () => {
    if (!targetPhone) {
      alert('Please enter a customer mobile number below to open SMS.');
      return;
    }
    const url = getSmsClickUrl(targetPhone, receiptMessage);
    window.location.href = url;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8 overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header (no-print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-kirana-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-kirana-700 text-white rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">
                Invoice & Receipt: <span className="font-mono text-kirana-800">{invoice.invoiceNumber}</span>
              </h3>
              <p className="text-xs text-slate-500">{formatDateTime(invoice.date)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar (no-print) */}
        <div className="no-print px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* Format Selector */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setPrintFormat('thermal')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                printFormat === 'thermal'
                  ? 'bg-white text-kirana-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Thermal Slip ({settings.thermalWidth || '80mm'})
            </button>
            <button
              onClick={() => setPrintFormat('a4')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                printFormat === 'a4'
                  ? 'bg-white text-kirana-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              A4 Tax Invoice
            </button>
          </div>

          {/* Quick Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-kirana-700 hover:bg-kirana-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
        </div>

        {/* Printable Paper Preview */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
          <div
            id="print-section"
            className={
              printFormat === 'thermal'
                ? 'receipt-paper w-full max-w-[380px] p-5 bg-white border border-slate-300 rounded shadow-md text-slate-900 text-xs'
                : 'w-full max-w-xl p-8 bg-white border border-slate-300 rounded-lg shadow-md text-slate-900'
            }
          >
            {/* Thermal Slip Layout */}
            {printFormat === 'thermal' ? (
              <div className="font-mono text-center">
                <h2 className="text-base font-extrabold uppercase tracking-wider">{settings.shopName}</h2>
                {settings.tagline && <p className="text-[10px] text-slate-600">{settings.tagline}</p>}
                <p className="text-[10px] text-slate-600 mt-1">{settings.address}</p>
                {settings.phone && <p className="text-[10px] text-slate-600">Mob: {settings.phone}</p>}
                {settings.gstin && <p className="text-[10px] text-slate-600">GSTIN: {settings.gstin}</p>}

                <div className="my-2 border-b border-dashed border-slate-400" />

                <div className="flex justify-between text-[11px] text-left">
                  <span>Bill: <strong>{invoice.invoiceNumber}</strong></span>
                  <span>{formatDate(invoice.date)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-left">
                  <span>Cust: {invoice.customerName || 'Walk-in'}</span>
                  <span>{invoice.customerPhone ? invoice.customerPhone : ''}</span>
                </div>

                <div className="my-2 border-b border-dashed border-slate-400" />

                {/* Items Table */}
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-300">
                      <th className="py-1">Item</th>
                      <th className="py-1 text-center">Qty</th>
                      <th className="py-1 text-right">Price</th>
                      <th className="py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-1 pr-1 font-semibold text-slate-800">{item.name}</td>
                        <td className="py-1 text-center whitespace-nowrap">{item.quantity} {item.unit}</td>
                        <td className="py-1 text-right">{formatINR(item.sellingPrice)}</td>
                        <td className="py-1 text-right font-medium">{formatINR(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="my-2 border-b border-dashed border-slate-400" />

                {/* Calculation breakdown */}
                <div className="space-y-1 text-[11px] text-right">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatINR(invoice.subtotal)}</span>
                  </div>
                  {invoice.discountAmount > 0 && (
                    <div className="flex justify-between text-green-700 font-semibold">
                      <span>Discount Saved:</span>
                      <span>-{formatINR(invoice.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black border-t border-b border-slate-800 py-1 my-1">
                    <span>GRAND TOTAL:</span>
                    <span>{formatINR(invoice.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Payment Mode:</span>
                    <span className="uppercase font-bold">{invoice.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Paid Amount:</span>
                    <span>{formatINR(invoice.paidAmount)}</span>
                  </div>
                  {invoice.udharAmount > 0 && (
                    <div className="flex justify-between text-red-600 font-bold bg-red-50 p-1 rounded">
                      <span>Outstanding Udhar:</span>
                      <span>{formatINR(invoice.udharAmount)}</span>
                    </div>
                  )}
                </div>

                <div className="my-2 border-b border-dashed border-slate-400" />

                <p className="text-[10px] text-slate-600 leading-tight">
                  {settings.receiptFooter || 'Thank you for shopping at Mohit Kirana!'}
                </p>
                {settings.upiId && (
                  <p className="text-[9px] text-slate-500 mt-1">
                    Pay UPI: {settings.upiId}
                  </p>
                )}
              </div>
            ) : (
              /* A4 Tax Invoice Format */
              <div className="space-y-6">
                <div className="flex justify-between items-start border-b-2 border-kirana-700 pb-4">
                  <div>
                    <h1 className="text-2xl font-black text-kirana-800 tracking-tight">{settings.shopName}</h1>
                    <p className="text-xs text-slate-600 font-medium">{settings.tagline}</p>
                    <p className="text-xs text-slate-600 mt-1">{settings.address}</p>
                    <p className="text-xs text-slate-600">Contact: {settings.phone}</p>
                    {settings.gstin && <p className="text-xs text-slate-600 font-mono">GSTIN: {settings.gstin}</p>}
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-kirana-100 text-kirana-800 font-bold text-xs uppercase rounded">
                      Tax Invoice / Cash Memo
                    </span>
                    <p className="text-sm font-bold text-slate-900 mt-2 font-mono">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-slate-500">Date: {formatDateTime(invoice.date)}</p>
                  </div>
                </div>

                {/* Customer Details Box */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-2 text-xs gap-4">
                  <div>
                    <p className="text-slate-400 font-medium">Billed To:</p>
                    <p className="font-bold text-slate-800 text-sm">{invoice.customerName || 'Walk-in Customer'}</p>
                    {invoice.customerPhone && <p className="text-slate-600">Phone: {invoice.customerPhone}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 font-medium">Payment Information:</p>
                    <p className="font-bold text-slate-800 uppercase">{invoice.paymentMethod}</p>
                    <p className="text-slate-600">Status: <span className="text-green-700 font-semibold capitalize">{invoice.status}</span></p>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2 border-b">#</th>
                      <th className="p-2 border-b">Item Description</th>
                      <th className="p-2 border-b text-center">Qty / Unit</th>
                      <th className="p-2 border-b text-right">Unit Price</th>
                      <th className="p-2 border-b text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, index) => (
                      <tr key={index} className="border-b border-slate-100">
                        <td className="p-2 text-slate-400">{index + 1}</td>
                        <td className="p-2 font-medium text-slate-800">{item.name}</td>
                        <td className="p-2 text-center">{item.quantity} {item.unit}</td>
                        <td className="p-2 text-right">{formatINR(item.sellingPrice)}</td>
                        <td className="p-2 text-right font-semibold">{formatINR(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span>{formatINR(invoice.subtotal)}</span>
                    </div>
                    {invoice.discountAmount > 0 && (
                      <div className="flex justify-between text-green-700 font-semibold">
                        <span>Discount Saved:</span>
                        <span>-{formatINR(invoice.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black border-t-2 border-slate-800 pt-2 text-slate-900">
                      <span>Grand Total:</span>
                      <span>{formatINR(invoice.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Amount Paid:</span>
                      <span>{formatINR(invoice.paidAmount)}</span>
                    </div>
                    {invoice.udharAmount > 0 && (
                      <div className="flex justify-between text-red-600 font-bold bg-red-50 p-1.5 rounded">
                        <span>Udhar (Balance):</span>
                        <span>{formatINR(invoice.udharAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 flex justify-between items-center text-[11px] text-slate-500">
                  <p>{settings.receiptFooter}</p>
                  <p className="italic">Authorized Signatory: {settings.shopName}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Free WhatsApp & SMS Sharing Footer (no-print) */}
        <div className="no-print p-5 bg-white border-t border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
            <div className="flex items-center gap-2 text-xs text-slate-700 w-full sm:w-auto">
              <Share2 className="w-4 h-4 text-kirana-600 shrink-0" />
              <span className="font-semibold">Customer Mobile:</span>
              <input
                type="tel"
                placeholder="10-digit mobile"
                value={customPhone || invoice.customerPhone || ''}
                onChange={(e) => setCustomPhone(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-md font-mono focus:ring-1 focus:ring-kirana-500 w-32"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleWhatsAppShare}
                title="Opens WhatsApp chat with pre-filled invoice message"
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95"
              >
                <MessageCircle className="w-4 h-4" />
                Send via WhatsApp
              </button>

              <button
                onClick={handleSmsShare}
                title="Opens device native SMS composer with pre-filled invoice message"
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95"
              >
                <Smartphone className="w-4 h-4" />
                Send SMS
              </button>

              <button
                onClick={handleCopyMessage}
                title="Copy receipt text to clipboard"
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-green-700" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="flex items-start gap-1.5 text-[11px] text-slate-500">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p>
              Prepares receipt message directly on your device so you can tap send without third-party fees.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
