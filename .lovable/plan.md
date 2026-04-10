

## Plan: Upgrade Humanizer System Prompts

### What
Replace all four system prompts in `supabase/functions/humanize-text/index.ts` with the user's improved guidelines, tailored per mode.

### Changes

**`supabase/functions/humanize-text/index.ts`** — Replace the `systemPrompts` object (lines 10-73) with updated prompts based on the user's strict rules:

- **Standard mode**: Core prompt with all 10 rules verbatim — varied sentence structures, mix of short/medium/long sentences, slight human imperfections, no repetitive phrasing, natural tone, Grade 6-10 readability, meaning preservation, no AI filler, burstiness/perplexity, real person feel.

- **Academic mode**: Same 10 core rules + "use formal tone, structured clarity, and precise wording."

- **Creative mode**: Same 10 core rules + "add engaging, slightly expressive language."

- **Advanced mode**: Same 10 core rules + "aggressively restructure sentences for maximum human-like variation."

The `increaseHumanScore` additional instructions remain unchanged. No other files affected.

### Files Modified
1. `supabase/functions/humanize-text/index.ts` — system prompts only

