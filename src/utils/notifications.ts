import type { Invoice, Customer, StoreSettings } from '../types';
import { formatINR, formatDate, cleanIndianPhoneNumber } from './formatters';

export function buildReceiptMessage(invoice: Invoice, settings: StoreSettings): string {
  const customerName = invoice.customerName && invoice.customerName !== 'Walk-in Customer'
    ? invoice.customerName
    : 'Valued Customer';

  const itemsList = invoice.items
    .map(i => `• ${i.name} (${i.quantity} ${i.unit}) — ${formatINR(i.total)}`)
    .join('\n');

  let balanceText = 'Balance: ₹0';
  if (invoice.udharAmount > 0) {
    balanceText = `Outstanding Udhar: ${formatINR(invoice.udharAmount)}`;
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
