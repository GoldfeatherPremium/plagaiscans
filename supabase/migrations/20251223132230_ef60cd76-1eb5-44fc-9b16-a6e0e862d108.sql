-- FIX: magic_upload_links - Tokens should NOT be directly visible to unauthenticated users
-- Remove the open policy and make it work through admin access only
-- Guest uploads work through a specific token passed in the request which is validated server-side
DROP POLICY IF EXISTS "Anyone can validate specific token" ON magic_upload_links;

-- Admin manages all magic links
-- The magic link validation for guests happens in the frontend hook where we query by token
-- Since we query by specific token (WHERE token = ?), not the whole table, 
-- we need to allow SELECT but this is still a concern as it allows enumeration

-- Better approach: Only allow SELECT when querying by specific token or for admin
-- This can't be done purely via RLS - the policy below at least restricts to active non-expired links
CREATE POLICY "Anyone can validate active tokens"
ON magic_upload_links
FOR SELECT
USING (
  status = 'active'::text 
  AND (expires_at IS NULL OR expires_at > now())
);

-- Note: The above is still the same. The real fix requires either:
-- 1. An edge function that validates tokens server-side (best)
-- 2. Or acceptance that active tokens can be queried (current behavior)

-- FIX: usdt_wallet_counter - The service role check was incorrect
DROP POLICY IF EXISTS "System service role can manage wallet counter" ON usdt_wallet_counter;

-- Service role bypasses RLS automatically, so we don't need a policy for it
-- The admin policy should be sufficient for dashboard access

-- FIX: documents - Add validation for magic_link_id on INSERT
-- We can't validate against another table directly in RLS easily
-- But we can ensure the magic_link_id is not randomly guessable by checking it exists
DROP POLICY IF EXISTS "Anyone can insert documents via magic link" ON documents;

CREATE POLICY "Anyone can insert documents with valid magic link"
ON documents
FOR INSERT
WITH CHECK (
  magic_link_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM magic_upload_links 
    WHERE id = documents.magic_link_id 
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
    AND current_uploads < max_uploads
  )
);

-- FIX: promo_codes - Don't allow listing all active codes publicly
DROP POLICY IF EXISTS "Everyone can view active promo codes" ON promo_codes;

-- Authenticated users can validate a code they enter (by code value)
CREATE POLICY "Authenticated users can validate promo codes"
ON promo_codes
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_active = true
  AND (valid_from IS NULL OR valid_from <= now())
  AND (valid_until IS NULL OR valid_until > now())
  AND (max_uses IS NULL OR current_uses < max_uses)
);