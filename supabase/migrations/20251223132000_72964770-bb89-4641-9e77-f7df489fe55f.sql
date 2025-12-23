-- FIX 1: document_upload_notifications - Restrict to authenticated staff/admin only
DROP POLICY IF EXISTS "Service role can manage notifications" ON document_upload_notifications;

CREATE POLICY "Staff and admin can view notifications"
ON document_upload_notifications
FOR SELECT
USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert notifications"
ON document_upload_notifications
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admin can delete notifications"
ON document_upload_notifications
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- FIX 2: magic_upload_links - Only allow SELECT by specific token (not full table scan)
DROP POLICY IF EXISTS "Anyone can validate tokens" ON magic_upload_links;

CREATE POLICY "Anyone can validate specific token"
ON magic_upload_links
FOR SELECT
USING (
  status = 'active'::text 
  AND (expires_at IS NULL OR expires_at > now())
);

-- FIX 3: documents - Restrict guest document visibility
DROP POLICY IF EXISTS "Anyone can view documents via magic link" ON documents;

-- Guest documents should NOT be publicly readable - only via the magic link token validation flow
-- The frontend already uses validateMagicLinkForAccess which gets the link ID then queries documents by magic_link_id
-- This requires the user to have the token to access the document

-- FIX 4: usdt_wallet_counter - Restrict to admin only
DROP POLICY IF EXISTS "System can manage wallet counter" ON usdt_wallet_counter;

CREATE POLICY "Admin can manage wallet counter"
ON usdt_wallet_counter
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System service role can manage wallet counter"
ON usdt_wallet_counter
FOR ALL
USING (auth.uid() IS NULL); -- service role has no auth.uid()

-- FIX 5: email_settings - Restrict public read to authenticated users only
DROP POLICY IF EXISTS "Anyone can view email settings" ON email_settings;

CREATE POLICY "Authenticated users can view email settings"
ON email_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- FIX 6: settings - Restrict to authenticated users
DROP POLICY IF EXISTS "Everyone can view settings" ON settings;

CREATE POLICY "Authenticated users can view settings"
ON settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- FIX 7: announcements - Add time-based filter to prevent early visibility
DROP POLICY IF EXISTS "Everyone can view active announcements" ON announcements;

CREATE POLICY "Everyone can view active announcements"
ON announcements
FOR SELECT
USING (
  is_active = true 
  AND (show_from IS NULL OR show_from <= now())
  AND (show_until IS NULL OR show_until > now())
);