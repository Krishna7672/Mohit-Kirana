// Currency & Date formatters for Indian locale

export function formatINR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2
  }).format(amount);
}

export function formatDate(dateStr: string | Date | undefined): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d);
}

export function formatDateTime(dateStr: string | Date | undefined): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Invalid Date';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `MK-${year}${month}${day}-${randomSuffix}`;
}

export function cleanIndianPhoneNumber(phone: string): string {
  // Strip non-digits
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return `91${digitsOnly}`;
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return `91${digitsOnly.substring(1)}`;
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly;
  }
  return digitsOnly;
}

export function getDaysAgo(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const diffTime = Math.abs(Date.now() - d.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export interface WeightPreset {
  label: string;
  subLabel?: string;
  qty: number; // In master unit
}

export const KG_PRESETS: WeightPreset[] = [
  { label: '25g', subLabel: '0.025kg', qty: 0.025 },
  { label: '50g', subLabel: '0.05kg', qty: 0.05 },
  { label: '100g', subLabel: '0.1kg', qty: 0.1 },
  { label: '200g', subLabel: '0.2kg', qty: 0.2 },
  { label: '250g', subLabel: '¼ kg', qty: 0.25 },
  { label: '500g', subLabel: '½ kg', qty: 0.5 },
  { label: '750g', subLabel: '¾ kg', qty: 0.75 },
  { label: '1 kg', subLabel: '1000g', qty: 1 },
  { label: '1.5 kg', subLabel: '1500g', qty: 1.5 },
  { label: '2 kg', subLabel: '2000g', qty: 2 },
  { label: '5 kg', subLabel: '5000g', qty: 5 },
];

export const LITRE_PRESETS: WeightPreset[] = [
  { label: '50ml', subLabel: '0.05L', qty: 0.05 },
  { label: '100ml', subLabel: '0.1L', qty: 0.1 },
  { label: '200ml', subLabel: '0.2L', qty: 0.2 },
  { label: '250ml', subLabel: '¼ L', qty: 0.25 },
  { label: '500ml', subLabel: '½ L', qty: 0.5 },
  { label: '750ml', subLabel: '¾ L', qty: 0.75 },
  { label: '1 L', subLabel: '1000ml', qty: 1 },
  { label: '2 L', subLabel: '2000ml', qty: 2 },
  { label: '5 L', subLabel: '5000ml', qty: 5 },
];

export const GRAM_PRESETS: WeightPreset[] = [
  { label: '25g', qty: 25 },
  { label: '50g', qty: 50 },
  { label: '100g', qty: 100 },
  { label: '250g', qty: 250 },
  { label: '500g', qty: 500 },
  { label: '1000g', qty: 1000 },
];

export const ML_PRESETS: WeightPreset[] = [
  { label: '50ml', qty: 50 },
  { label: '100ml', qty: 100 },
  { label: '250ml', qty: 250 },
  { label: '500ml', qty: 500 },
  { label: '1000ml', qty: 1000 },
];

export function formatQuantityWithSubUnit(qty: number, unit: string, subUnitLabel?: string): string {
  if (subUnitLabel) return `${subUnitLabel} (${qty} ${unit})`;
  if (unit === 'kg') {
    if (qty < 1) {
      const g = Math.round(qty * 1000);
      return `${g}g (${qty} kg)`;
    }
    if (qty % 1 !== 0) {
      const kgPart = Math.floor(qty);
      const gPart = Math.round((qty - kgPart) * 1000);
      return `${kgPart}kg ${gPart}g (${qty} kg)`;
    }
    return `${qty} kg`;
  }
  if (unit === 'litre') {
    if (qty < 1) {
      const ml = Math.round(qty * 1000);
      return `${ml}ml (${qty} L)`;
    }
    return `${qty} L`;
  }
  return `${qty} ${unit}`;
}

