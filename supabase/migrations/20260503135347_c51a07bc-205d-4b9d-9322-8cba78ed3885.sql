UPDATE public.reseller_scans 
SET similarity_percentage = 15,
    similarity_report_path = 'system/847e06e5-1ecc-4fc8-86ab-35e025edb523_similarity_ASA_women.pdf',
    webhook_delivered = false,
    webhook_attempts = 0,
    webhook_next_retry_at = now()
WHERE id = '41b36e3c-ba20-4529-bdb6-3e61066cb72e';