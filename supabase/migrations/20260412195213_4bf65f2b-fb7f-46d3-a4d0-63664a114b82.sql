
UPDATE public.remark_presets
SET remark_text = 'AI writing detection is unavailable for this submission

Reasons could include:

• Submission file is an unsupported file type
• Submission text is in an unsupported language
• Qualifying text is either fewer than 300 words or more than 30,000 words'
WHERE remark_text LIKE 'AI writing detection is unavailable%';
