-- Add Stripe columns to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_invoice_url TEXT,
ADD COLUMN IF NOT EXISTS stripe_receipt_url TEXT;

-- Add Stripe columns to receipts table
ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS stripe_receipt_url TEXT,
ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;

-- Index for faster lookups by Stripe invoice ID
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id 
ON invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

-- Index for receipts by Stripe charge ID
CREATE INDEX IF NOT EXISTS idx_receipts_stripe_charge_id 
ON receipts(stripe_charge_id) WHERE stripe_charge_id IS NOT NULL;