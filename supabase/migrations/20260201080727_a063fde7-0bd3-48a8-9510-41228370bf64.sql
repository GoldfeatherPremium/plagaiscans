-- Create ticket messages table for conversation threads
CREATE TABLE public.ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- Admin can manage all messages
CREATE POLICY "Admin can manage all ticket messages"
ON public.ticket_messages
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view messages on their own tickets
CREATE POLICY "Users can view messages on own tickets"
ON public.ticket_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets 
    WHERE support_tickets.id = ticket_messages.ticket_id 
    AND support_tickets.user_id = auth.uid()
  )
);

-- Users can insert messages on their own tickets
CREATE POLICY "Users can insert messages on own tickets"
ON public.ticket_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets 
    WHERE support_tickets.id = ticket_messages.ticket_id 
    AND support_tickets.user_id = auth.uid()
  )
  AND is_admin = false
  AND sender_id = auth.uid()
);

-- Add ticket_type column to support_tickets for categorization
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS ticket_type TEXT NOT NULL DEFAULT 'contact';

-- Create index for faster queries
CREATE INDEX idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX idx_support_tickets_type ON public.support_tickets(ticket_type);