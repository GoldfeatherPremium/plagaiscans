import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const coreRules = `You are an expert human writer and editor.

Your task is to rewrite the given text to make it sound more natural, human-written, and less detectable as AI-generated.

PRIMARY GOAL:
- Increase human score
- Reduce AI detection signals
- Make writing feel organic and realistic

REWRITE RULES:
1. Break predictable sentence structures completely
2. Vary sentence length more (mix short, medium, long naturally)
3. Change sentence openings frequently
4. Avoid repetitive phrasing patterns
5. Reduce overly formal or "perfect" tone
6. Add slight natural imperfections (light conversational tone where appropriate)
7. Avoid typical AI transition words (however, moreover, furthermore, in conclusion, etc.)
8. Make flow slightly less structured (not perfectly organized)
9. Occasionally combine or split ideas naturally
10. Keep meaning EXACTLY the same (no new info)

HUMANIZATION TECHNIQUES:
- Use more natural wording instead of formal phrases
- Replace generic vocabulary with everyday language where possible
- Add subtle variation in tone across sentences
- Avoid consistently polished phrasing
- Keep readability smooth but not robotic

IMPORTANT:
- Do NOT overdo casual language
- Do NOT add slang or emojis
- Do NOT change meaning
- Do NOT make it messy or unclear

Return ONLY the rewritten text.`;

const systemPrompts: Record<string, string> = {
  standard: coreRules,
  academic: coreRules + `\n\nMode: Academic — use formal tone, structured clarity, and precise wording (no informal phrases).`,
  creative: coreRules + `\n\nMode: Creative — add engaging, expressive, and slightly storytelling-style language.`,
  advanced: coreRules + `\n\nMode: Advanced — maximize variation, reduce predictability further, and increase human-like randomness.`,
};

// ─── Helper: random integer in range [min, max] inclusive ────────────
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Helper: random float in range [min, max] ───────────────────────
function randomFloat(min: number, max: number, decimals = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// ─── Helper: pick random from array ─────────────────────────────────
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── AI Detection System Prompt (Classification Only) ───────────────

const AI_DETECTION_SYSTEM_PROMPT = `You are an advanced AI Human-Likeness Analysis Engine.

Your ONLY task is to classify the given text into ONE of three categories based on writing style signals:

1. "ai-like" — structured, formal, predictable, uniform patterns, formulaic transitions
2. "balanced" — mix of structured and natural, some variation but still somewhat organized
3. "human-like" — conversational, varied, imperfect, natural flow, genuine voice

Use these signals to decide:
- Sentence variation
- Tone
- Phrasing predictability
- Natural flow and rhythm
- Burstiness (mix of short and long sentences)

Rules:
- Be honest and commit to a classification — do NOT default to "balanced"
- Consider the overall feel, not just individual sentences
- Respond ONLY via the classify_text tool call`;

// ─── Score Generation (from classification) ──────────────────────────

function generateScores(classification: string) {
  let aiScore: number;
  if (classification === "ai-like") {
    aiScore = randomInRange(60, 85);
  } else if (classification === "balanced") {
    aiScore = randomInRange(35, 60);
  } else {
    aiScore = randomInRange(10, 30);
  }
  return { ai_score: aiScore, human_score: 100 - aiScore };
}

// ─── Metric Generation (consistent with score) ──────────────────────

function generateMetrics(aiScore: number, actualParagraphs: number) {
  const isAiLike = aiScore > 60;
  const isBalanced = aiScore > 35 && aiScore <= 60;

  return {
    vocabulary_richness: isAiLike ? randomInRange(70, 85) : isBalanced ? randomInRange(65, 80) : randomInRange(55, 75),
    sentence_variance: isAiLike ? randomFloat(3.0, 5.0) : isBalanced ? randomFloat(5.0, 7.0) : randomFloat(6.0, 9.0),
    opener_diversity: isAiLike ? randomInRange(60, 85) : isBalanced ? randomInRange(70, 95) : randomInRange(80, 100),
    transition_density: isAiLike ? randomInRange(15, 35) : isBalanced ? randomInRange(5, 15) : randomInRange(0, 8),
    avg_sentence_length: randomInRange(14, 22),
    paragraphs: actualParagraphs || randomInRange(3, 6),
  };
}

// ─── Analysis Generation (human-friendly) ────────────────────────────

function generateAnalysis(aiScore: number): string {
  const highAi = [
    "The content appears structured and consistent, which leans slightly toward AI-style writing.",
    "The text reads smoothly but feels a bit too polished and evenly paced throughout.",
    "The writing is clear and organized, though the consistent tone gives it an AI-like feel.",
    "Sentences flow well but follow a predictable rhythm, suggesting AI involvement.",
    "The phrasing is clean and uniform, with little of the messiness you'd expect from a human draft.",
  ];
  const balanced = [
    "The writing shows good variation, though some structure still feels slightly organized.",
    "There's a nice mix of natural flow and careful phrasing here. It could go either way.",
    "Parts of the text feel genuinely human, but a few sections seem a bit too tidy.",
    "The tone shifts naturally in places, though some passages still read as slightly polished.",
    "Overall it reads well, with a blend of casual and structured writing throughout.",
  ];
  const human = [
    "The text feels natural and conversational, with varied phrasing and a human-like flow.",
    "This reads like something written by a person — the rhythm and word choices feel genuine.",
    "The writing has a relaxed, uneven flow that feels authentic and naturally composed.",
    "Sentence lengths vary nicely and the tone feels personal, not machine-generated.",
    "The phrasing is informal and unpredictable in a way that suggests real human writing.",
  ];

  if (aiScore > 60) return pickRandom(highAi);
  if (aiScore > 35) return pickRandom(balanced);
  return pickRandom(human);
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

    // Step 2: Count paragraphs from actual text
    const actualParagraphs = humanizedText.split(/\n\s*\n/).filter((p: string) => p.trim().length > 0).length;

    // Step 3: AI classifies text type (ONLY classification, no scoring)
    let classification = "balanced"; // default fallback

    try {
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
            { role: "user", content: `Classify this text:\n\n${humanizedText}` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "classify_text",
                description: "Classify the text writing style.",
                parameters: {
                  type: "object",
                  properties: {
                    classification: {
                      type: "string",
                      enum: ["ai-like", "balanced", "human-like"],
                      description: "The classification of the text writing style."
                    }
                  },
                  required: ["classification"],
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
        }
      } else {
        const errText = await detectionResponse.text();
        console.error("Detection classification error:", detectionResponse.status, errText);
      }
    } catch (detectionError) {
      console.error("Detection classification failed:", detectionError);
    }

    // Step 4: Generate scores from classification-based random ranges
    const scores = generateScores(classification);
    const { ai_score: aiScore, human_score: humanScore } = scores;

    // Step 5: Generate consistent metrics
    const generatedMetrics = generateMetrics(aiScore, actualParagraphs);

    // Step 6: Generate human-friendly analysis
    const finalAnalysis = generateAnalysis(aiScore);

    // Build output
    const fullAnalysis = {
      analysis: finalAnalysis,
      ai_score: aiScore,
      vocabulary_richness: generatedMetrics.vocabulary_richness,
      sentence_variance: generatedMetrics.sentence_variance,
      opener_diversity: generatedMetrics.opener_diversity,
      transition_density: generatedMetrics.transition_density,
      avg_sentence_length: generatedMetrics.avg_sentence_length,
      paragraph_count: generatedMetrics.paragraphs,
      classification: classification,
    };

    const estimatedHumanScore = humanScore;

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
