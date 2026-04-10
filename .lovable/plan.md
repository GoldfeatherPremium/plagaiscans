

## Plan: Update Humanizer System Prompts with Enhanced Guidelines

### What
Replace the `coreRules` prompt in `supabase/functions/humanize-text/index.ts` (lines 10-35) with the user's expanded 12-rule guidelines and updated mode-specific instructions.

### Changes

**`supabase/functions/humanize-text/index.ts`** — Replace lines 10-35:

- **Core rules**: Updated to 12 rules including new instructions for varying sentence openings (#3), natural unpredictability (#4), organic feel (#7), improved flow (#11), and removing generic filler (#12).
- **Mode instructions**:
  - **Standard**: Core 12 rules only
  - **Academic**: + "use formal tone, structured clarity, and precise wording (no informal phrases)"
  - **Creative**: + "add engaging, expressive, and slightly storytelling-style language"
  - **Advanced**: + "maximize variation, reduce predictability further, and increase human-like randomness"

No other files affected. The `increaseHumanScore` additional instructions remain unchanged.

### Files Modified
1. `supabase/functions/humanize-text/index.ts` — system prompts only

