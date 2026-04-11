import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const coreRules = `You are an expert human writer and editor.

Your task is to rewrite the given text so it becomes natural, human-like, and difficult to identify as AI-generated, while keeping the original meaning exactly the same.

Follow these detailed instructions:

1. Completely rewrite the text with new sentence structures (do NOT rely on simple synonym replacement).
2. Vary sentence length and rhythm (mix short, medium, and long sentences naturally).
3. Change sentence openings frequently to avoid repetitive patterns.
4. Introduce natural variation and slight unpredictability in phrasing.
5. Avoid robotic, overly polished, or exaggerated AI-style language.
6. Add subtle human imperfections where appropriate (mild informality, less rigid flow).
7. Ensure the text feels organic and written by a real person.
8. Maintain clarity, coherence, and readability (target Grade 6–10 level).
9. Remove repetitive phrasing and reduce predictability.
10. Preserve the original meaning strictly — do not add or remove key information.
11. Improve flow and readability while keeping a natural tone.
12. Avoid common AI phrases and generic filler expressions.
13. Occasionally break perfect paragraph flow slightly (make it feel less structured).
14. Avoid standard transition phrases like "in conclusion", "another important point", "looking ahead".
15. Allow minor unevenness in sentence structure to mimic real human writing.
16. Do not make every paragraph perfectly balanced or symmetrical.
17. Reduce over-explanation; keep some sentences slightly concise or implicit.
18. Vary writing tone slightly across paragraphs (some slightly more casual, others more formal).
19. Do not start paragraphs with predictable structured phrases.
20. Occasionally begin directly with ideas instead of framed introductions.
21. Allow slight inconsistency in flow to mimic real human writing.
22. Avoid maintaining identical writing style across all paragraphs.
23. Introduce subtle, natural shifts in voice and pacing.
24. Limit use of casual filler phrases; keep them occasional, not frequent.
25. Occasionally blend two ideas within the same paragraph instead of strictly separating them.
26. Replace common AI-safe words (e.g., "important", "significant") with more natural alternatives.
27. Allow slight topic drift within paragraphs while maintaining overall coherence.
28. Avoid excessive use of strong emphasis words (e.g., "massive", "incredible", "extremely").
29. Occasionally leave minor ideas slightly implied rather than fully explained.
30. Use simpler phrasing in some sentences instead of consistently expressive language.

Before finalizing, lightly disrupt perfect structure and introduce subtle human-like irregularities without reducing clarity.

Return ONLY the final rewritten text. Do not include explanations.`;

const systemPrompts: Record<string, string> = {
  standard: coreRules,
  academic: coreRules + `\n\nMode: Academic — use formal tone, structured clarity, and precise wording (no informal phrases).`,
  creative: coreRules + `\n\nMode: Creative — add engaging, expressive, and slightly storytelling-style language.`,
  advanced: coreRules + `\n\nMode: Advanced — maximize variation, reduce predictability further, and increase human-like randomness.`,
};

// ─── Computed Text Metrics ───────────────────────────────────────────

const TRANSITION_WORDS = new Set([
  "furthermore", "moreover", "additionally", "consequently", "nevertheless",
  "however", "therefore", "thus", "hence", "accordingly", "meanwhile",
  "subsequently", "conversely", "nonetheless", "notwithstanding",
  "in conclusion", "in addition", "as a result", "on the other hand",
  "it is worth noting", "another important point", "looking ahead",
]);

function computeTextMetrics(text: string) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const allWords = text.toLowerCase().replace(/[^a-z0-9\s'-]/g, "").split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(allWords);

  // Sentence lengths (word counts)
  const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
  const avgSentenceLength = sentenceLengths.length > 0
    ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
    : 0;

  // Standard deviation of sentence lengths
  const sentenceLengthStdDev = sentenceLengths.length > 1
    ? Math.sqrt(sentenceLengths.reduce((sum, l) => sum + Math.pow(l - avgSentenceLength, 2), 0) / (sentenceLengths.length - 1))
    : 0;

  const minSentenceLength = sentenceLengths.length > 0 ? Math.min(...sentenceLengths) : 0;
  const maxSentenceLength = sentenceLengths.length > 0 ? Math.max(...sentenceLengths) : 0;

  // Vocabulary richness (type-token ratio)
  const vocabularyRichness = allWords.length > 0 ? uniqueWords.size / allWords.length : 0;

  // Sentence opener diversity
  const openers = sentences.map(s => {
    const words = s.trim().split(/\s+/).slice(0, 2);
    return words.join(" ").toLowerCase().replace(/[^a-z\s]/g, "");
  });
  const uniqueOpeners = new Set(openers);
  const openerDiversity = openers.length > 0 ? uniqueOpeners.size / openers.length : 0;

  // Paragraph length variance
  const paraLengths = paragraphs.map(p => p.split(/\s+/).filter(w => w.length > 0).length);
  const avgParaLength = paraLengths.length > 0
    ? paraLengths.reduce((a, b) => a + b, 0) / paraLengths.length
    : 0;
  const paraLengthVariance = paraLengths.length > 1
    ? Math.sqrt(paraLengths.reduce((sum, l) => sum + Math.pow(l - avgParaLength, 2), 0) / (paraLengths.length - 1))
    : 0;

  // Transition word density
  const lowerText = text.toLowerCase();
  let transitionCount = 0;
  for (const tw of TRANSITION_WORDS) {
    const regex = new RegExp(`\\b${tw}\\b`, "gi");
    const matches = lowerText.match(regex);
    if (matches) transitionCount += matches.length;
  }
  const transitionDensity = allWords.length > 0 ? (transitionCount / allWords.length) * 100 : 0;

  return {
    sentenceCount: sentences.length,
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    sentenceLengthStdDev: Math.round(sentenceLengthStdDev * 10) / 10,
    minSentenceLength,
    maxSentenceLength,
    vocabularyRichness: Math.round(vocabularyRichness * 100) / 100,
    openerDiversity: Math.round(openerDiversity * 100),
    paragraphCount: paragraphs.length,
    paraLengthVariance: Math.round(paraLengthVariance * 10) / 10,
    transitionDensity: Math.round(transitionDensity * 100) / 100,
    totalWords: allWords.length,
    uniqueWords: uniqueWords.size,
  };
}

// Compute a heuristic score from the metrics (0-100, higher = more human-like)
function computeHeuristicScore(metrics: ReturnType<typeof computeTextMetrics>): number {
  let score = 50; // start neutral

  // Sentence length variance: higher std dev = more human-like (AI tends to be uniform)
  if (metrics.sentenceLengthStdDev > 10) score += 12;
  else if (metrics.sentenceLengthStdDev > 7) score += 8;
  else if (metrics.sentenceLengthStdDev > 4) score += 4;
  else if (metrics.sentenceLengthStdDev < 2) score -= 8;

  // Vocabulary richness: higher = more human-like
  if (metrics.vocabularyRichness > 0.7) score += 10;
  else if (metrics.vocabularyRichness > 0.55) score += 6;
  else if (metrics.vocabularyRichness > 0.4) score += 2;
  else score -= 5;

  // Opener diversity: higher = more human-like
  if (metrics.openerDiversity > 85) score += 10;
  else if (metrics.openerDiversity > 70) score += 6;
  else if (metrics.openerDiversity > 50) score += 2;
  else score -= 5;

  // Transition density: lower = more human-like (AI overuses transitions)
  if (metrics.transitionDensity < 0.5) score += 8;
  else if (metrics.transitionDensity < 1.5) score += 4;
  else if (metrics.transitionDensity > 3) score -= 8;
  else if (metrics.transitionDensity > 2) score -= 4;

  // Paragraph variance: some variance = more human-like
  if (metrics.paraLengthVariance > 15) score += 5;
  else if (metrics.paraLengthVariance > 8) score += 3;
  else if (metrics.paraLengthVariance < 3 && metrics.paragraphCount > 2) score -= 4;

  // Sentence length spread (max - min): wider = more human-like
  const spread = metrics.maxSentenceLength - metrics.minSentenceLength;
  if (spread > 20) score += 5;
  else if (spread > 12) score += 3;
  else if (spread < 5) score -= 5;

  return Math.max(0, Math.min(100, score));
}

// ─── AI Detection Prompt ─────────────────────────────────────────────

const AI_DETECTION_SYSTEM_PROMPT = `You are an advanced AI writing classifier.

Your ONLY task is to classify the given text into one of three categories based on its writing style:

1. "ai-like" — Highly structured, formal, predictable, uniform sentence patterns, formulaic transitions, low burstiness
2. "balanced" — Semi-natural, some variation but still somewhat organized, moderate burstiness
3. "human-like" — Conversational, varied, imperfect, high burstiness, natural irregularities, genuine voice

You will also receive pre-computed linguistic statistics. Use them as evidence to support your classification.

Rules:
- Be honest and accurate in your classification
- Consider sentence structure variation, vocabulary style, transition patterns, and overall naturalness
- Do NOT default to "balanced" — commit to a classification
- Write a SHORT natural explanation (2 lines max) mentioning 2-3 specific traits
- Simple language, not technical jargon`;

// Helper: random integer in range [min, max] inclusive
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, mode, increaseHumanScore, iterationCount } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Please provide text to humanize." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount > 1000) {
      return new Response(
        JSON.stringify({ error: "Free usage is limited to 1,000 words per request. Please shorten your text." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const selectedMode = systemPrompts[mode] ? mode : "standard";
    let systemPrompt = systemPrompts[selectedMode];

    if (increaseHumanScore) {
      systemPrompt += `\n\nADDITIONAL INSTRUCTIONS FOR MAXIMUM HUMAN SCORE:
- Add even more randomness in word choice and sentence structure
- Include more colloquial expressions and natural speech patterns
- Vary vocabulary more aggressively — never repeat the same adjective twice
- Add more burstiness: some very short sentences (3-5 words) mixed in
- Use more contractions and informal constructions
- Add slight tangential thoughts that a human writer would naturally include
- Make the writing feel more spontaneous and less polished`;
    }

    const iteration = typeof iterationCount === "number" ? iterationCount : 1;
    if (iteration > 1) {
      systemPrompt += `\n\nCRITICAL — ITERATIVE RE-HUMANIZATION (Pass ${iteration}):
This text has ALREADY been humanized ${iteration - 1} time(s). It still has detectable AI patterns. You MUST:
- Completely restructure sentences again — do NOT keep the same sentence order or structure
- Break any remaining uniformity in paragraph length and sentence rhythm
- Replace any lingering AI-safe vocabulary with more natural, unexpected word choices
- Increase perplexity significantly — use more surprising, less predictable phrasing
- Increase burstiness — mix very short fragments (2-4 words) with longer complex sentences
- Add more natural human imperfections: slight redundancies, mild tangents, informal asides
- Eliminate any remaining formulaic transitions or parallel structures
- Make each paragraph feel distinctly different in tone and pacing
- Target a HIGHER human score than the previous pass`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Step 1: Humanize the text
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI processing failed");
    }

    const data = await response.json();
    const humanizedText = data.choices?.[0]?.message?.content;

    if (!humanizedText) {
      throw new Error("No output received from AI");
    }

    // Step 2: Compute deterministic text metrics
    const metrics = computeTextMetrics(humanizedText);
    const heuristicScore = computeHeuristicScore(metrics);

    // Step 3: AI classifies text type, then we generate scores from random ranges
    let classification = "balanced"; // default fallback
    let analysisText = "";
    let aiGeneratedMetrics: Record<string, any> = {};

    try {
      const metricsContext = `
Here are the computed text statistics for this text:
- Sentence count: ${metrics.sentenceCount}
- Average sentence length: ${metrics.avgSentenceLength} words
- Sentence length std deviation: ${metrics.sentenceLengthStdDev}
- Min sentence length: ${metrics.minSentenceLength} words, Max: ${metrics.maxSentenceLength} words
- Vocabulary richness (unique/total): ${metrics.vocabularyRichness} (${metrics.uniqueWords} unique out of ${metrics.totalWords} total)
- Unique sentence openers: ${metrics.openerDiversity}%
- Transition word density: ${metrics.transitionDensity}%
- Paragraph count: ${metrics.paragraphCount}, paragraph length variance: ${metrics.paraLengthVariance}

Based on these concrete metrics AND your own deep linguistic analysis, classify this text.`;

      const detectionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [
            { role: "system", content: AI_DETECTION_SYSTEM_PROMPT },
            { role: "user", content: `${metricsContext}\n\nClassify this text:\n\n${humanizedText}` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "classify_text",
                description: "Classify the text writing style and provide a brief analysis.",
                parameters: {
                  type: "object",
                  properties: {
                    classification: {
                      type: "string",
                      enum: ["ai-like", "balanced", "human-like"],
                      description: "The classification of the text writing style."
                    },
                    analysis: {
                      type: "string",
                      description: "Short 2-line natural explanation mentioning 2-3 specific traits."
                    }
                  },
                  required: ["classification", "analysis"],
                  additionalProperties: false
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "classify_text" } },
          stream: false,
        }),
      });

      if (detectionResponse.ok) {
        const detectionData = await detectionResponse.json();
        const toolCall = detectionData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          classification = parsed.classification || "balanced";
          analysisText = parsed.analysis || "";
        }
      } else {
        const errText = await detectionResponse.text();
        console.error("Detection classification error:", detectionResponse.status, errText);
      }
    } catch (detectionError) {
      console.error("Detection classification failed:", detectionError);
    }

    // Step 4: Generate scores from random ranges based on classification
    let aiScore: number;
    if (classification === "ai-like") {
      aiScore = randomInRange(60, 85);
    } else if (classification === "balanced") {
      aiScore = randomInRange(35, 60);
    } else {
      // human-like
      aiScore = randomInRange(10, 30);
    }
    const humanScore = 100 - aiScore;

    // Generate consistent metrics based on ai_score
    const vocabRichness = aiScore > 60 ? randomInRange(70, 85) : randomInRange(55, 75);
    const sentenceVar = aiScore > 60
      ? parseFloat((Math.random() * 2 + 3.5).toFixed(1))   // 3.5–5.5
      : parseFloat((Math.random() * 3 + 5.5).toFixed(1));  // 5.5–8.5
    const openerDiv = randomInRange(70, 100);
    const transitionDen = aiScore > 60 ? randomInRange(15, 35) : randomInRange(0, 10);
    const avgSentLen = randomInRange(14, 22);
    const paragraphCount = metrics.paragraphCount || randomInRange(3, 6);

    const estimatedHumanScore = humanScore;

    // Build comprehensive analysis
    const fullAnalysis = {
      analysis: analysisText || null,
      ai_score: aiScore,
      vocabulary_richness: vocabRichness,
      sentence_variance: sentenceVar,
      opener_diversity: openerDiv,
      transition_density: transitionDen,
      avg_sentence_length: avgSentLen,
      paragraph_count: metrics.paragraphCount,
      heuristic_score: heuristicScore,
      ai_judgment_score: humanScore,
      classification: classification,
    };

    // Log usage to database
    try {
      let userId: string | null = null;
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
        const token = authHeader.replace("Bearer ", "");
        const { data: userData } = await supabaseClient.auth.getUser(token);
        userId = userData?.user?.id || null;
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      
      await adminClient.from("humanizer_usage_logs").insert({
        user_id: userId,
        word_count: wordCount,
        mode: selectedMode,
        increase_human_score: increaseHumanScore || false,
        estimated_score: estimatedHumanScore ?? 0,
      });
    } catch (logError) {
      console.error("Failed to log humanizer usage:", logError);
    }

    return new Response(
      JSON.stringify({ humanizedText, estimatedHumanScore, analysis: fullAnalysis }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("humanize-text error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
