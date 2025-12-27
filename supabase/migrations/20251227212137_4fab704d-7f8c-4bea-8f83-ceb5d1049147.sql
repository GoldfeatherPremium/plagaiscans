-- Add column to track if pending reminder was sent
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS pending_reminder_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for efficient querying of pending documents
CREATE INDEX IF NOT EXISTS idx_documents_pending_unassigned 
ON public.documents (status, assigned_staff_id, uploaded_at) 
WHERE status = 'pending' AND assigned_staff_id IS NULL;