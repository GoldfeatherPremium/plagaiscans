-- Create notifications table
CREATE TABLE public.notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create user notification reads table (to track which users have seen notifications)
CREATE TABLE public.notification_reads (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(notification_id, user_id)
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- Notifications policies - all authenticated users can read active notifications
CREATE POLICY "Authenticated users can view active notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (is_active = true);

-- Only admins can create/update/delete notifications
CREATE POLICY "Admins can manage notifications"
ON public.notifications
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can read their own notification reads
CREATE POLICY "Users can view their own notification reads"
ON public.notification_reads
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can mark notifications as read
CREATE POLICY "Users can mark notifications as read"
ON public.notification_reads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;