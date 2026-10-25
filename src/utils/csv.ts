import Papa from 'papaparse';
import type { Product, Customer, Invoice } from '../types';

export function exportToCSV<T extends Record<string, unknown>>(data: T[], filename: string) {
  if (!data || data.length === 0) {
    alert('No data available to export.');
    return;
  }
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportProductsCSV(products: Product[]) {
  const formatted = products.map(p => ({
    'ID': p.id ?? '',
    'Product Name': p.name,
    'Category': p.category,
    'Brand': p.brand,
    'SKU': p.sku,
    'Barcode': p.barcode,
    'Unit': p.unit,
    'Purchase Price (₹)': p.purchasePrice,
    'Selling Price (₹)': p.sellingPrice,
    'Current Stock': p.stockQuantity,
    'Min Stock Threshold': p.minStockThreshold,
    'Supplier': p.supplierName ?? '',
    'Expiry Date': p.expiryDate ?? '',
    'Archived': p.isArchived ? 'Yes' : 'No'
  }));
  exportToCSV(formatted, 'mohit_kirana_products');
}

export function exportCustomersCSV(customers: Customer[]) {
  const formatted = customers.map(c => ({
    'ID': c.id ?? '',
    'Name': c.name,
    'Phone': c.phone,
    'Address': c.address ?? '',
    'Total Purchases Count': c.purchaseCount,
    'Lifetime Spending (₹)': c.totalSpending,
    'Outstanding Udhar (₹)': c.outstandingUdhar,
    'Last Purchase Date': c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString('en-IN') : '',
    'Registration Date': new Date(c.registrationDate).toLocaleDateString('en-IN')
  }));
  exportToCSV(formatted, 'mohit_kirana_customers');
}

export function exportInvoicesCSV(invoices: Invoice[]) {
  const formatted = invoices.map(i => ({
    'Invoice Number': i.invoiceNumber,
    'Date': new Date(i.date).toLocaleString('en-IN'),
    'Customer Name': i.customerName,
    'Customer Phone': i.customerPhone,
    'Items Count': i.items.length,
    'Subtotal (₹)': i.subtotal,
    'Discount (₹)': i.discountAmount,
    'Total Amount (₹)': i.totalAmount,
    'Cost (₹)': i.costAmount,
    'Estimated Profit (₹)': i.profit,
    'Payment Method': i.paymentMethod,
    'Paid Amount (₹)': i.paidAmount,
    'Udhar Amount (₹)': i.udharAmount,
    'Status': i.status
  }));
  exportToCSV(formatted, 'mohit_kirana_sales_report');
}

export function parseProductsCSV(
  file: File,
  onComplete: (products: Omit<Product, 'id'>[], errors: string[]) => void
) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const parsedProducts: Omit<Product, 'id'>[] = [];
      const errors: string[] = [];

      results.data.forEach((row: any, index: number) => {
        const rowNum = index + 2; // account for header and 0-indexing
        const name = row['Product Name'] || row['name'] || row['Name'] || row['Item Name'];
        if (!name) {
          errors.push(`Row ${rowNum}: Skipped due to missing Product Name`);
          return;
        }

        const category = row['Category'] || row['category'] || 'General';
        const brand = row['Brand'] || row['brand'] || '';
        const sku = row['SKU'] || row['sku'] || `SKU-${Date.now()}-${index}`;
        const barcode = row['Barcode'] || row['barcode'] || '';
        const unit = (row['Unit'] || row['unit'] || 'packet').toLowerCase();
        const purchasePrice = parseFloat(row['Purchase Price (₹)'] || row['Purchase Price'] || row['purchasePrice'] || '0') || 0;
        const sellingPrice = parseFloat(row['Selling Price (₹)'] || row['Selling Price'] || row['sellingPrice'] || '0') || 0;
        const stockQuantity = parseFloat(row['Current Stock'] || row['Stock'] || row['stockQuantity'] || '0') || 0;
        const minStockThreshold = parseFloat(row['Min Stock Threshold'] || row['Min Stock'] || row['minStockThreshold'] || '5') || 5;
        const supplierName = row['Supplier'] || row['supplierName'] || '';
        const expiryDate = row['Expiry Date'] || row['expiryDate'] || '';

        parsedProducts.push({
          name: name.trim(),
          category: category.trim(),
          brand: brand.trim(),
          sku: sku.trim(),
          barcode: barcode.trim(),
          unit: ['kg', 'g', 'litre', 'ml', 'packet', 'piece', 'dozen'].includes(unit) ? unit : 'packet',
          purchasePrice: Math.max(0, purchasePrice),
          sellingPrice: Math.max(0, sellingPrice),
          stockQuantity: Math.max(0, stockQuantity),
          minStockThreshold: Math.max(0, minStockThreshold),
          supplierName: supplierName.trim(),
          expiryDate: expiryDate.trim(),
          isArchived: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });

      onComplete(parsedProducts, errors);
    },
    error: (err) => {
      onComplete([], [err.message]);
    }
  });
}
