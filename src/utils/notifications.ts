import type { Invoice, Customer, StoreSettings } from '../types';
import { formatINR, formatDate, cleanIndianPhoneNumber, formatQuantityWithSubUnit } from './formatters';

export function buildReceiptMessage(invoice: Invoice, settings: StoreSettings): string {
  const customerName = invoice.customerName && invoice.customerName !== 'Walk-in Customer'
    ? invoice.customerName
    : 'Valued Customer';

  const itemsList = invoice.items
    .map((i) => {
      const cleanName = i.name.replace(/\s*\([^)]*(g|gm|kg|ml|litre|L)\)\s*$/i, '');
      const weightOrQty = formatQuantityWithSubUnit(i.quantity, i.unit, i.subUnitLabel);
      return `• ${cleanName} (${weightOrQty}) — ${formatINR(i.total)}`;
    })
    .join('\n');

  let balanceText = 'Balance: ₹0';
  if (invoice.udharAmount > 0) {
    const prevUdhar = invoice.previousUdhar || 0;
    const currentUdhar = invoice.udharAmount || 0;
    const totalUdhar = invoice.totalOutstandingUdhar !== undefined
      ? invoice.totalOutstandingUdhar
      : prevUdhar + currentUdhar;

    if (prevUdhar > 0 && currentUdhar > 0) {
      balanceText = `Previous Udhar (पिछला बकाया): ${formatINR(prevUdhar)}\nThis Bill Udhar (इस बिल का उधार): +${formatINR(currentUdhar)}\nTotal Udhar Due (कुल बकाया उधार): ${formatINR(totalUdhar)}`;
    } else {
      balanceText = `Total Udhar Due (कुल बकाया उधार): ${formatINR(totalUdhar)}`;
    }
  }

  let discountText = '';
  if (invoice.discountAmount > 0) {
    discountText = `\nDiscount Saved: ${formatINR(invoice.discountAmount)}`;
  }

  return `Namaste ${customerName}! Thank you for shopping at ${settings.shopName}.

Bill No: ${invoice.invoiceNumber}
Date: ${formatDate(invoice.date)}

Items:
${itemsList}
${discountText}
Total: ${formatINR(invoice.totalAmount)}
Payment: ${invoice.paymentMethod.toUpperCase()}
Paid: ${formatINR(invoice.paidAmount)}
${balanceText}

${settings.receiptFooter || 'Thank you for shopping with Mohit Kirana!'}
${settings.phone ? `Contact: ${settings.phone}` : ''}`;
}

export function buildUdharReminderMessage(customer: Customer, settings: StoreSettings): string {
  return `Namaste ${customer.name} ji,
This is a gentle payment reminder from ${settings.shopName}.

Your current outstanding Udhar balance is: ${formatINR(customer.outstandingUdhar)}.

You can pay in store with Cash or via UPI:
UPI ID: ${settings.upiId || settings.phone}

Contact us: ${settings.phone}
Thank you for your business!`;
}

export function getWhatsAppClickUrl(phone: string, text: string): string {
  const cleanPhone = cleanIndianPhoneNumber(phone);
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

export function getSmsClickUrl(phone: string, text: string): string {
  const cleanPhone = cleanIndianPhoneNumber(phone);
  const encodedText = encodeURIComponent(text);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const separator = isIOS ? '&' : '?';

  if (cleanPhone) {
    return `sms:${cleanPhone}${separator}body=${encodedText}`;
  }
  return `sms:${separator}body=${encodedText}`;
}


export interface UdharRepaymentReceiptInfo {
  customerName: string;
  phone: string;
  amountPaid: number;
  remainingBalance: number;
  paymentMethod?: string;
  date?: string;
  notes?: string;
}

export function buildUdharRepaymentMessage(
  info: UdharRepaymentReceiptInfo,
  settings: StoreSettings
): string {
  const isCleared = info.remainingBalance <= 0;
  const balanceNotice = isCleared
    ? '🎉 Badhaai ho! Aapka puraana sabhi udhaar chukta ho gaya hai (Current Due: ₹0). Dhanyawad!'
    : `Bacha Hua Udhaar (Remaining Balance): ${formatINR(info.remainingBalance)}`;

  const modeText = info.paymentMethod ? info.paymentMethod.toUpperCase() : 'CASH';

  return `Namaste ${info.customerName} ji!
Aapka udhaar bhugtan (Payment) safaltapoorvak prapt hua.

Dukan: ${settings.shopName}
Jama Rashi (Paid Amount): ${formatINR(info.amountPaid)}
Payment Mode: ${modeText}
Date: ${formatDate(info.date || new Date().toISOString())}
${info.notes ? `Remarks: ${info.notes}\n` : ''}----------------------------------------
${balanceNotice}
----------------------------------------

${settings.receiptFooter || 'Dhanyawad! Please visit again.'}
${settings.phone ? `Sampark: ${settings.phone}` : ''}`;
}
