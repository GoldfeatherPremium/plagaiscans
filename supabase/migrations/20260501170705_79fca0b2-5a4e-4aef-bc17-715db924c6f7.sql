-- Backfill AI percentages for documents already processed by the external API.
-- The API returns aiScore on a 0-1 scale, but values were saved without *100.
-- Multiply existing tiny ai_percentage values (<= 1) for API-processed docs.
UPDATE public.documents
SET ai_percentage = ROUND(ai_percentage * 100)
WHERE external_api_order_id IS NOT NULL
  AND ai_percentage IS NOT NULL
  AND ai_percentage > 0
  AND ai_percentage <= 1;