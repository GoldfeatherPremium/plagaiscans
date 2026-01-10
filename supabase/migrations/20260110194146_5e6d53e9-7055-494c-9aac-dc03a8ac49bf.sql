-- Add guest_email and guest_name columns to magic_upload_links table
ALTER TABLE public.magic_upload_links 
ADD COLUMN IF NOT EXISTS guest_email text,
ADD COLUMN IF NOT EXISTS guest_name text;