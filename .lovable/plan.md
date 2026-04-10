

## Plan: Replace Random Scoring with AI-Based Detection Analysis

### Problem
Currently, the humanized text score is randomly generated within a range. The user wants a comprehensive, Turnitin-style AI detection analysis that actually evaluates the humanized output.

### Approach
Use a second AI call to analyze the humanized text for AI-detection signals — the same linguistic patterns that detectors like Turnitin use: perplexity, burstiness, sentence uniformity, vocabulary predictability, and structural regularity. The AI will act as an AI content detector and return a structured score.

### Changes

**1. `supabase/functions/humanize-text/index.ts`**

After humanizing the text, make a second AI call with a detection-focused system prompt that instructs the model to:

- Analyze **perplexity** (how predictable/uniform the word choices are)
- Analyze **burstiness** (variation in sentence length and complexity)
- Check for **repetitive sentence patterns** and uniform paragraph structure
- Detect **common AI phrases** and overly polished language
- Evaluate **vocabulary diversity** and naturalness
- Check **transition predictability** and structural rigidity

The detection prompt will use tool calling (structured output) to return:
```json
{
  "ai_score": 15,
  "human_score": 85,
  "analysis": {
    "perplexity": "high",
    "burstiness": "high", 
    "vocabulary_diversity": "good",
    "sentence_uniformity": "low",
    "overall_assessment": "Text shows natural variation..."
  }
}
```

Replace the random score generation (lines 144-155) with this second AI call. The `increaseHumanScore` flag will still trigger a re-humanize pass if the initial score is below a threshold.

**2. `src/pages/AIHumanizer.tsx`**

Update the frontend to display the richer analysis data (perplexity, burstiness, etc.) alongside the human score, giving users more detailed feedback on why their text scored as it did.

### Technical Details

- Uses the same Lovable AI gateway with `google/gemini-2.5-flash`
- Structured output via tool calling ensures reliable JSON parsing
- Detection prompt mirrors Turnitin's known methodology: statistical analysis of perplexity, burstiness, vocabulary patterns, and structural uniformity
- Adds ~1 extra second of processing time for the analysis call

### Files Modified
1. `supabase/functions/humanize-text/index.ts` — replace random scoring with AI-based detection analysis
2. `src/pages/AIHumanizer.tsx` — display detailed analysis breakdown

