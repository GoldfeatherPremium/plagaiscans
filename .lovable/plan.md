

## Plan: Fix AI Detection Analysis to Be Real and Comprehensive

### Problem
The database confirms the issue: scores alternate between 25 → 65 → 85 → 65 → 85 in a repeating pattern. The AI detection model (Gemini 2.5 Flash) is being asked to both humanize AND judge its own output — creating a conflict of interest where the same model tends to give repetitive, non-analytical scores. The detection prompt also lacks grounding in concrete, measurable heuristics.

### Root Causes
1. **Same model judges its own work** — Gemini 2.5 Flash humanizes the text, then the same model scores it. This creates bias.
2. **Detection prompt is too vague** — It asks the model to "analyze" but doesn't force concrete measurement (e.g., actual sentence length variance, vocabulary stats).
3. **Fallback score of 85** — When detection fails, it silently returns 85%, making it look like a fixed number.
4. **No real computational metrics** — The prompt asks AI to subjectively rate perplexity/burstiness instead of computing them.

### Solution: Hybrid Approach (Computed Metrics + AI Judgment)

Combine **real computed text statistics** with AI analysis for a comprehensive, honest score.

### Changes

**1. Edge Function (`supabase/functions/humanize-text/index.ts`)**

**A. Add real computed metrics function** that calculates from the humanized text:
- **Sentence length variance** (standard deviation of word counts per sentence)
- **Vocabulary richness** (unique words / total words ratio)
- **Sentence opener diversity** (% of unique first-2-words across sentences)
- **Average sentence length** and min/max spread
- **Paragraph length variance**
- **Transition word density** (count of formulaic transitions like "Furthermore", "Moreover", etc.)

**B. Use a different model for detection** — Use `google/gemini-2.5-pro` (or `openai/gpt-5-mini`) for the detection call so it's not the same model judging its own output.

**C. Enhance detection prompt** — Provide the computed metrics TO the AI detector so it can make a grounded judgment rather than guessing:
```
Here are the computed text statistics:
- Sentence count: 24
- Avg sentence length: 18.3 words
- Sentence length std dev: 8.7
- Vocabulary richness: 0.62
- Unique sentence openers: 87%
- Transition word density: 2.1%
- Paragraph count: 5, length variance: 12.4

Based on these concrete metrics AND your linguistic analysis, score this text...
```

**D. Weighted final score** — Combine the computed metrics score (40% weight) with the AI judgment score (60% weight) so the result is grounded in real data.

**E. Remove the fallback score of 85** — If detection fails, return `null` instead so the UI can show "Analysis unavailable" rather than a fake number.

**F. Log the computed metrics** alongside the AI score for transparency.

**2. Frontend (`src/pages/AIHumanizer.tsx`)**

- Handle `null` score gracefully (show "Analysis unavailable" message)
- Update wording from "Turnitin-style" to "AI Human-Likeness Analysis"
- Display some computed metrics (sentence variance, vocabulary richness) as concrete numbers instead of only vague labels like "high"/"low"
- Show both the computed stats and AI assessment sections separately for transparency

### Technical Details
- Computed metrics are deterministic — same text always produces same stats
- Using a different model for detection eliminates self-judgment bias
- Weighted scoring prevents the AI from arbitrarily picking numbers
- Passing real stats to the detector gives it concrete evidence to reason about

### Files Modified
1. `supabase/functions/humanize-text/index.ts` — add computed metrics, use different model for detection, weighted scoring, remove fallback
2. `src/pages/AIHumanizer.tsx` — handle null scores, update wording, show computed metrics

