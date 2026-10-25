# 🛒 Mohit Kirana - Smart Grocery POS & Store Management

A complete, production-ready, local-first grocery shop management application built for **Mohit Kirana**.

Designed specifically to operate **100% free of paid APIs, paid databases, commercial SMS gateways, and paid subscriptions**. All records persist reliably in the browser using IndexedDB via Dexie.js and operate seamlessly offline.

---

## 🌟 Key Features

### 1. ⚡ Fast POS Billing
- Instant product search by name, category, brand, SKU or barcode.
- **Device Camera Barcode Scanner** powered by `html5-qrcode` + external USB/Bluetooth barcode gun support.
- Flexible unit types: `kg`, `g`, `litre`, `ml`, `packet`, `piece`, `dozen` with fractional/decimal quantity calculations.
- Party selection: search existing customer by mobile number or add a new party inline.
- **Repeat Previous Bill**: 1-click repurchase feature that repopulates the customer's prior basket after verifying live stock and latest prices.
- **Loyalty Program Redemption**: 1-click redemption of customer loyalty points directly against the bill total.
- Payment methods: **Cash** (with automated change calculation), **UPI/QR**, **Split Payment**, or **Udhar (Credit)**.
- **Atomic Stock Deduction**: inventory is deducted exactly once per transaction with full audit trail logging.

### 2. 🧾 Receipts, Thermal Printing & Free Sharing
- **Thermal Slip format**: configured for 58mm & 80mm POS receipt printers.
- **A4 Tax Invoice format**: formal cash memo with GSTIN, itemized breakdown and terms.
- **Free WhatsApp Sharing**: pre-fills a clean itemized receipt message and opens WhatsApp Web or the WhatsApp mobile app via official `https://wa.me/{phone}?text=...` click-to-chat links with zero gateway fees.
- **Free SMS Sharing**: triggers native device SMS composer (`sms:{phone}?body=...`) with 1-click copy fallback.

### 3. 📦 Inventory & Stock Management
- Add, edit, and archive grocery products with brand, category, SKU, barcode, unit, cost price and selling price.
- Live inventory valuation: real-time Total Active Items, Cost Valuation, Retail Valuation (MRP), and Expected Gross Profit margin.
- Low stock threshold alerts and out-of-stock badges.
- Expiry date tracking (with <30 days expiry filter).
- **Manual Stock Adjustments**: log stock inward, stock outward, damage or shrinkage with audit reasons.
- **Stock Movement Audit Log**: complete chronological record of every sale, inward purchase, adjustment and return.
- **CSV Import & Export**: full catalog export and CSV bulk import with column auto-mapping.

### 4. 👥 Customer Management & Repeat Buyers
- Track Customer Name, 10-digit mobile number, address, total visits, lifetime spending, outstanding udhar, and loyalty points.
- **Duplicate Mobile Prevention**: ensures one record per customer phone number.
- **Customer Segmentation**:
  - *New Party* (1 purchase)
  - *Repeat Customer* (≥2 completed purchases)
  - *Loyal VIP* (≥5 completed purchases)
  - *Inactive Customers* (no purchases in 30, 60, or 90 days)
- Customer Profile: complete purchase history (every previous invoice, itemized breakdown, and date).
- **Udhar Repayment**: record partial or full repayments directly in the profile. Repayments are logged separately to prevent accidental double-counting as sales revenue.
- WhatsApp & SMS payment reminders with customer balance and UPI ID.

### 5. 📖 Dedicated Udhar Khata (Credit Ledger)
- Global market credit tracking (Total Outstanding Udhar).
- Searchable credit ledger by customer name or phone.
- Customer account statements with debit/credit breakdown and printable statement slips.
- Quick WhatsApp & SMS payment reminders.

### 6. 🚚 Stock Inward & Supplier Management
- Supplier directory with contact phone, warehouse/mandi address, and GSTIN.
- Record wholesale purchase bills with supplier invoice numbers.
- **Automated Stock Increment**: inward quantities automatically increase active inventory.
- Track supplier payment status (Fully Paid, Partially Paid, Pending Supplier Credit).

### 7. 📊 Reports & Financial Analytics
- **Sales vs Profit Clarity**: clear distinction between Gross Sales Revenue and Net Gross Profit (Sales Revenue minus Cost of Goods Sold).
- Time filters: Today, This Week, This Month, All Time.
- Category-wise sales breakdown with interactive Pie Chart.
- Product-wise performance ranking (Units sold, revenue, profit contribution).
- Payment collection mode distribution (Cash, UPI, Split, Udhar).
- **Controlled Refunds & Restock**: cancel or refund an invoice with automatic inventory replenishment, loyalty points reversal, and audit logging.

### 8. 🔒 Security & Offline Data Safety
- **100% Offline-First**: all data is stored inside browser IndexedDB via Dexie.js.
- **Complete JSON Backup**: 1-click download of all store tables into a single portable `.json` file.
- **Validated JSON Restore**: restore with validation and warning dialog to avoid accidental data loss.
- **Owner PIN Screen Lock**: optional 4-digit counter lock to prevent unauthorized access at the billing counter.

---

## 🛠️ Technology Stack

| Technology | Purpose | Cost |
| :--- | :--- | :--- |
| **React 19 + TypeScript** | Frontend UI & type safety | Free / Open Source |
| **Vite 8** | High-performance build tool & dev server | Free / Open Source |
| **Tailwind CSS 3** | Grocery green design system & dark mode | Free / Open Source |
| **Dexie.js 4** | IndexedDB local storage & transactions | Free / Open Source |
| **Lucide React** | Modern icons | Free / Open Source |
| **Recharts** | Analytics & financial trend charts | Free / Open Source |
| **html5-qrcode** | Barcode camera scanning | Free / Open Source |
| **PapaParse** | CSV import & export engine | Free / Open Source |
| **Canvas Confetti** | Checkout feedback animation | Free / Open Source |

---

## 🚀 Running the Project Locally

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm

### Steps
1. Navigate to the project directory:
   ```bash
   cd "c:\Users\kj901\Desktop\mohit kirana"
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to:
   ```text
   http://localhost:5173/
   ```

---

## 📦 Building for Production

To create an optimized production bundle:
```bash
npm run build
```
The compiled files will be output to the `dist/` folder. You can preview the production bundle locally with:
```bash
npm run preview
```

---

## 🌐 Free Deployment Guide

Because **Mohit Kirana** is a 100% client-side, local-first application, it can be hosted on any eligible free static hosting provider without needing a backend server or paid database.

### Option A: Vercel (Free Tier)
1. Push this repository to GitHub.
2. Sign in to [Vercel](https://vercel.com/) with GitHub.
3. Click **Add New Project** and select `mohit-kirana`.
4. Framework Preset will auto-detect as **Vite**.
5. Click **Deploy**. Your app will be live with free SSL.

### Option B: Netlify (Free Tier)
1. Drag and drop the `dist` folder directly onto [Netlify Drop](https://app.netlify.com/drop), or connect your GitHub repository.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Click **Deploy Site**.

### Option C: GitHub Pages (Free)
1. In `vite.config.ts`, set `base: '/<repo-name>/'`.
2. Run `npm run build`.
3. Deploy the `dist` folder to the `gh-pages` branch using GitHub Actions.

---

---

## 📱 Android App (Native APK & PWA)

You have **two complete ways** to run Mohit Kirana on Android:

### Method 1: Native Android App (Capacitor + Android Studio)
The repository now includes a full native Android project under the `android/` directory!

1. **Sync latest changes to Android:**
   ```bash
   npm run android:build
   ```
2. **Open in Android Studio:**
   ```bash
   npm run android:open
   ```
   *(Or simply open the `android/` folder in Android Studio)*
3. **Build APK in Android Studio:**
   - Go to **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
   - The generated `app-debug.apk` can be transferred directly to any Android smartphone or tablet via USB/WhatsApp/Drive!
4. **Direct Phone Testing:** Connect your Android phone with USB Debugging enabled and press the green **Run (▶)** button in Android Studio.

### Method 2: Automated Cloud APK Build via GitHub Actions (Zero Local Setup)
A workflow has been configured in `.github/workflows/build-apk.yml`:
1. Push this project to your GitHub repository.
2. Go to the **Actions** tab on GitHub -> click **Build Android APK** -> **Run workflow**.
3. Once completed in ~2 minutes, click on the workflow run to download `Mohit-Kirana-Android-APK` (`app-debug.apk`) directly to your phone.

### Method 3: Instant 1-Click PWA App (No APK download required)
1. Open your hosted store URL (or local Wi-Fi IP e.g. `http://192.168.31.130:5173/`) in **Google Chrome** on your Android phone.
2. Tap the **"Install App"** banner at the top, or tap the three dots (⋮) menu -> **"Install app"** / **"Add to Home screen"**.
3. The app installs directly onto your phone's app launcher with full offline database and camera barcode scanner capabilities.

---

## 💻 Installing on Desktop (Windows / Mac)
1. Open the website in Google Chrome or Microsoft Edge.
2. Click the **Install** icon on the right side of the URL address bar.
3. Launch Mohit Kirana directly from your Start Menu, Dock, or Desktop shortcut.

---

## 💾 Data Backup & Device Independence Note

> [!IMPORTANT]
> Because Mohit Kirana does not use paid cloud databases, your data is stored locally in the current browser's IndexedDB.
> - Data does not automatically synchronize between separate physical devices.
> - **Best Practice:** Go to **Settings -> Download Full Backup (JSON)** at the end of every business day.
> - If you ever switch computers or phones, simply open Settings on the new device and click **Restore from Backup File** to immediately load your entire shop database.

---

## 📄 License
This application is open-source and free for retail grocery store operations. Built with pride for **Mohit Kirana**.
