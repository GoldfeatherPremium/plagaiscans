

## Plan: Add Clear Button & Iterative Re-humanization

### Changes

**1. `src/pages/AIHumanizer.tsx`** — Two changes:

**A. Clear All button in input card**
- Add an `X` (clear) button in the input card header area, visible only when `inputText` is non-empty
- Clicking it clears `inputText`, `outputText`, `humanScore`, and `analysis`
- Import `X` icon from lucide-react

**B. Iterative re-humanization support**
- Track `humanizeCount` state (number, starts at 0), incremented each time humanization runs
- Pass `humanizeCount` to the edge function so it knows this is a re-humanization pass
- When output exists, show a "Re-Humanize" button below the output that copies `outputText` into `inputText` and triggers humanization
- Display the iteration count (e.g., "Pass 2") near the button

**2. `supabase/functions/humanize-text/index.ts`** — Accept `iterationCount` from request body

- When `iterationCount > 1`, append extra instructions to the system prompt telling the AI this text was already humanized and to focus on:
  - Further reducing any remaining AI patterns
  - Increasing perplexity and burstiness even more
  - Breaking any residual uniformity
  - Making the text feel even more naturally written
  - Targeting a higher human score than the previous pass

### Files Modified
1. `src/pages/AIHumanizer.tsx` — clear button + re-humanize flow
2. `supabase/functions/humanize-text/index.ts` — iterative improvement instructions

