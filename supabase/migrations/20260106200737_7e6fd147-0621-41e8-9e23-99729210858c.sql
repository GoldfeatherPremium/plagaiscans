-- Fix RLS: allow authenticated admins to SELECT from deleted_documents_log
-- The existing policy was restricted to role "public", so logged-in admins (role "authenticated") could not see rows.

ALTER TABLE public.deleted_documents_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view deleted documents log" ON public.deleted_documents_log;

CREATE POLICY "Admins can view deleted documents log"
ON public.deleted_documents_log
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
);
