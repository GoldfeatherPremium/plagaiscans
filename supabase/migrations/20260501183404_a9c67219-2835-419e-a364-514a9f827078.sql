-- 1. Add 'reseller' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reseller';

-- 2. Add user_id to resellers (link to auth user)
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE;

-- 3. Helper: is current user this reseller?
CREATE OR REPLACE FUNCTION public.is_reseller_owner(_reseller_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resellers
    WHERE id = _reseller_id AND user_id = auth.uid()
  )
$$;

-- 4. RLS policies for resellers (self read/update of allowed fields)
DROP POLICY IF EXISTS "Resellers can view their own record" ON public.resellers;
CREATE POLICY "Resellers can view their own record"
ON public.resellers FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Resellers can update their own record" ON public.resellers;
CREATE POLICY "Resellers can update their own record"
ON public.resellers FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5. RLS for related tables — reseller can view/manage their own
DROP POLICY IF EXISTS "Resellers view own api keys" ON public.reseller_api_keys;
CREATE POLICY "Resellers view own api keys"
ON public.reseller_api_keys FOR SELECT
TO authenticated
USING (public.is_reseller_owner(reseller_id));

DROP POLICY IF EXISTS "Resellers create own api keys" ON public.reseller_api_keys;
CREATE POLICY "Resellers create own api keys"
ON public.reseller_api_keys FOR INSERT
TO authenticated
WITH CHECK (public.is_reseller_owner(reseller_id));

DROP POLICY IF EXISTS "Resellers update own api keys" ON public.reseller_api_keys;
CREATE POLICY "Resellers update own api keys"
ON public.reseller_api_keys FOR UPDATE
TO authenticated
USING (public.is_reseller_owner(reseller_id));

DROP POLICY IF EXISTS "Resellers view own credit transactions" ON public.reseller_credit_transactions;
CREATE POLICY "Resellers view own credit transactions"
ON public.reseller_credit_transactions FOR SELECT
TO authenticated
USING (public.is_reseller_owner(reseller_id));

DROP POLICY IF EXISTS "Resellers view own scans" ON public.reseller_scans;
CREATE POLICY "Resellers view own scans"
ON public.reseller_scans FOR SELECT
TO authenticated
USING (public.is_reseller_owner(reseller_id));

DROP POLICY IF EXISTS "Resellers view own webhook logs" ON public.reseller_webhook_logs;
CREATE POLICY "Resellers view own webhook logs"
ON public.reseller_webhook_logs FOR SELECT
TO authenticated
USING (public.is_reseller_owner(reseller_id));

DROP POLICY IF EXISTS "Resellers view own api logs" ON public.reseller_api_logs;
CREATE POLICY "Resellers view own api logs"
ON public.reseller_api_logs FOR SELECT
TO authenticated
USING (public.is_reseller_owner(reseller_id));