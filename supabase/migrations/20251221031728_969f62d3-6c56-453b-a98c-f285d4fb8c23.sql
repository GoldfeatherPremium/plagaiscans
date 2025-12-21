-- Enable realtime for manual_payments table
ALTER TABLE public.manual_payments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_payments;