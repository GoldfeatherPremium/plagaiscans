-- Allow customers to insert their own credit transactions (for document uploads)
CREATE POLICY "Users can insert own credit transactions" 
ON public.credit_transactions 
FOR INSERT 
WITH CHECK (user_id = auth.uid());