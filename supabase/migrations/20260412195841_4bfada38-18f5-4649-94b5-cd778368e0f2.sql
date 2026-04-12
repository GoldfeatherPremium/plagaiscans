UPDATE public.remark_presets
SET remark_text = E'AI writing detection is unavailable for this submission\n\nReasons could include:\n• Submission file is an unsupported file type\n• Submission text is in an unsupported language\n• Qualifying text is either fewer than 300 words or more than 30,000 words'
WHERE remark_text LIKE 'AI writing detection is unavailable%';