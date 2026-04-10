

## Plan: Upgrade AI Detection Prompt to Professional Detection Engine

### Problem
The current detection prompt is generic and produces repetitive scores. The user has provided a comprehensive, professional-grade detection prompt that mirrors real AI detection tools.

### Changes

**1. `supabase/functions/humanize-text/index.ts`**

Replace the current `AI_DETECTION_SYSTEM_PROMPT` (lines 178-192) with the user's professional prompt, adapted for the tool-calling format:

- New prompt includes explicit scoring logic with defined ranges (60-90 for structured text, 30-60 for balanced, 5-30 for conversational)
- Requires analysis of 9 specific criteria (sentence structure variation, predictability, repetition, vocabulary style, flow/rhythm, imperfections, tone variation, paragraph structure, burstiness)
- Enforces `ai_score + human_score = 100` constraint
- Mandates short 1-2 sentence explanations mentioning 2-3 specific signals
- Adds ±5 variation requirement to avoid repeating same scores
- Output via tool calling already in place — update the tool schema to return both `ai_score` and `human_score` plus `analysis` text

Update the tool-calling schema (lines 327-349) to match the new prompt's output format:
- Add `ai_score` (number 0-100) property
- Keep `human_score` (number 0-100) property  
- Rename `overall_assessment` to `analysis` (short natural explanation)

Update the response processing (lines 356-366) to use `analysis` instead of `overall_assessment`.

Update `fullAnalysis` object (lines 382-396) to include the new `ai_score` field.

**2. `src/pages/AIHumanizer.tsx`**

- Display both AI Score and Human Score from the analysis
- Use `analysis` field name instead of `overall_assessment` for the text explanation
- Add AI Score indicator alongside the existing Human Score display

### Technical Details
- The detection model remains `openai/gpt-5-mini` (different from the humanizer model) to avoid self-judgment bias
- Computed heuristic metrics still feed into the prompt as context
- Weighted scoring (40% heuristic + 60% AI judgment) remains unchanged
- The structured prompt with scoring ranges should eliminate the repetitive 25/65/85 pattern

### Files Modified
1. `supabase/functions/humanize-text/index.ts` — replace detection prompt, update tool schema
2. `src/pages/AIHumanizer.tsx` — display both scores and updated analysis field

