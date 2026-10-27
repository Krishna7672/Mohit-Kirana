-- ====================================================================
-- MOHIT KIRANA - SUPABASE CLOUD DATABASE SCHEMA (100% FREE TIER)
-- Cloud backup & multi-device sync setup
-- ====================================================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your Mohit Kirana project (or create one for free)
-- 3. In the left sidebar, click "SQL Editor" -> "New Query"
-- 4. Paste this entire file and click "Run" (Green Button)
-- ====================================================================

-- 1. Store Settings Table
CREATE TABLE IF NOT EXISTS store_settings (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  barcode TEXT,
  selling_price NUMERIC,
  stock_quantity NUMERIC,
  unit TEXT,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  outstanding_udhar NUMERIC DEFAULT 0,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  total_amount NUMERIC,
  payment_method TEXT,
  date TIMESTAMPTZ,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Udhar Ledger Table
CREATE TABLE IF NOT EXISTS udhar_ledger (
  id BIGINT PRIMARY KEY,
  customer_id BIGINT,
  invoice_id BIGINT,
  amount NUMERIC,
  date TIMESTAMPTZ,
  data JSONB NOT NULL
);

-- 6. Stock Movements Table
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGINT PRIMARY KEY,
  product_id BIGINT,
  type TEXT,
  quantity_change NUMERIC,
  date TIMESTAMPTZ,
  data JSONB NOT NULL
);

-- 7. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  data JSONB NOT NULL
);

-- 8. Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
  id BIGINT PRIMARY KEY,
  supplier_id BIGINT,
  purchase_invoice_no TEXT,
  total_cost NUMERIC,
  date TIMESTAMPTZ,
  data JSONB NOT NULL
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE udhar_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Create Open Access Policies for Public Anon API Key
DROP POLICY IF EXISTS "Public access store_settings" ON store_settings;
CREATE POLICY "Public access store_settings" ON store_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access products" ON products;
CREATE POLICY "Public access products" ON products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access customers" ON customers;
CREATE POLICY "Public access customers" ON customers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access invoices" ON invoices;
CREATE POLICY "Public access invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access udhar_ledger" ON udhar_ledger;
CREATE POLICY "Public access udhar_ledger" ON udhar_ledger FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access stock_movements" ON stock_movements;
CREATE POLICY "Public access stock_movements" ON stock_movements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access suppliers" ON suppliers;
CREATE POLICY "Public access suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access purchases" ON purchases;
CREATE POLICY "Public access purchases" ON purchases FOR ALL USING (true) WITH CHECK (true);
