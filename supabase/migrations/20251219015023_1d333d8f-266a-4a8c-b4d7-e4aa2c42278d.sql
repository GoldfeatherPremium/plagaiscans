-- Personal (user-targeted) notifications
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz NULL,
  created_by uuid NULL
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id_created_at
  ON public.user_notifications (user_id, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own user notifications"
ON public.user_notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "Users can update own user notifications"
ON public.user_notifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Staff/Admin can create notifications for any user
CREATE POLICY "Staff/admin can insert user notifications"
ON public.user_notifications
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'staff'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Admin can manage all (optional but useful)
CREATE POLICY "Admin can delete user notifications"
ON public.user_notifications
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
