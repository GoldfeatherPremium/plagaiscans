
INSERT INTO public.remark_presets (remark_text, is_active, sort_order)
VALUES (
  'AI writing detection is unavailable for this submission. Reasons could include: Submission file is an unsupported file type, Submission text is in an unsupported language, Qualifying text is either fewer than 300 words or more than 30,000 words.',
  true,
  0
)
ON CONFLICT DO NOTHING;
