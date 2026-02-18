ALTER TABLE credit_validity 
ADD COLUMN credits_expired_unused INTEGER DEFAULT NULL;

UPDATE credit_validity 
SET credits_expired_unused = credits_amount 
WHERE expired = true;