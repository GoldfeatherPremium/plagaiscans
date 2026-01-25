-- Add 'cancelled' to document_status enum
ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Add cancellation tracking columns to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancelled_by UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS credit_refunded BOOLEAN DEFAULT FALSE;