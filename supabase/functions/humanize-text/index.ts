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

const AI_DETECTION_SYSTEM_PROMPT = `You are an advanced AI content detector that uses the same methodology as Turnitin's AI detection system.

Your job is to analyze text and determine how likely it is to be AI-generated vs. human-written.

Analyze the following linguistic signals that real AI detectors use:

1. **Perplexity Analysis**: Measure how predictable the word choices are. AI text tends to have LOW perplexity (very predictable next-word choices). Human text has HIGHER perplexity (more surprising, varied word choices).

2. **Burstiness Analysis**: Measure variation in sentence length and complexity. AI text tends to have LOW burstiness (uniform sentence lengths, consistent complexity). Human text has HIGH burstiness (mix of very short and very long sentences, varying complexity).

3. **Sentence Uniformity**: Check if sentences follow similar patterns (subject-verb-object consistently, similar openings, parallel structure throughout). High uniformity = more likely AI.

4. **Vocabulary Predictability**: Analyze if the text uses "AI-safe" vocabulary — overly common, generic words that AI models favor (e.g., "significant", "crucial", "furthermore", "in conclusion"). More predictable vocabulary = more likely AI.

5. **Structural Regularity**: Check paragraph structure — are all paragraphs similar in length? Do they follow a predictable pattern (intro sentence, supporting sentences, conclusion sentence)? High regularity = more likely AI.

6. **Transition Patterns**: Look for formulaic transitions ("Furthermore", "Moreover", "In addition", "It is worth noting"). Frequent use of these = more likely AI.

7. **Tone Consistency**: Human writing naturally shifts in tone across paragraphs. AI tends to maintain a perfectly consistent tone throughout. Check for natural tone variation.

8. **Repetitive Phrasing Patterns**: AI often repeats structural patterns (e.g., starting multiple sentences the same way, using the same sentence rhythm). Detect these patterns.

Score the text on a scale of 0-100 where:
- 0 = Definitely AI-generated
- 100 = Definitely human-written

Be precise and analytical. Consider ALL signals together. A text can score high on some signals and low on others — weight them appropriately.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, mode, increaseHumanScore } = await req.json();

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

    // Step 2: Analyze the humanized text using AI-based detection (Turnitin-style)
    let estimatedHumanScore = 85;
    let analysisResult: Record<string, any> = {};

    try {
      const detectionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: AI_DETECTION_SYSTEM_PROMPT },
            { role: "user", content: `Analyze this text for AI detection:\n\n${humanizedText}` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "report_ai_detection_score",
                description: "Report the AI detection analysis results for the given text.",
                parameters: {
                  type: "object",
                  properties: {
                    human_score: {
                      type: "number",
                      description: "Score from 0-100 where 0=definitely AI, 100=definitely human"
                    },
                    perplexity: {
                      type: "string",
                      enum: ["very_low", "low", "moderate", "high", "very_high"],
                      description: "How unpredictable/varied the word choices are. Higher = more human-like."
                    },
                    burstiness: {
                      type: "string",
                      enum: ["very_low", "low", "moderate", "high", "very_high"],
                      description: "Variation in sentence length and complexity. Higher = more human-like."
                    },
                    vocabulary_diversity: {
                      type: "string",
                      enum: ["poor", "fair", "good", "excellent"],
                      description: "How diverse and natural the vocabulary is."
                    },
                    sentence_uniformity: {
                      type: "string",
                      enum: ["very_high", "high", "moderate", "low", "very_low"],
                      description: "How uniform/repetitive sentence patterns are. Lower = more human-like."
                    },
                    structural_regularity: {
                      type: "string",
                      enum: ["very_high", "high", "moderate", "low", "very_low"],
                      description: "How regular/predictable the paragraph structure is. Lower = more human-like."
                    },
                    overall_assessment: {
                      type: "string",
                      description: "Brief 1-2 sentence assessment of the text's human-likeness."
                    }
                  },
                  required: ["human_score", "perplexity", "burstiness", "vocabulary_diversity", "sentence_uniformity", "structural_regularity", "overall_assessment"],
                  additionalProperties: false
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "report_ai_detection_score" } },
          stream: false,
        }),
      });

      if (detectionResponse.ok) {
        const detectionData = await detectionResponse.json();
        const toolCall = detectionData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          estimatedHumanScore = Math.max(0, Math.min(100, Math.round(parsed.human_score)));
          analysisResult = {
            perplexity: parsed.perplexity,
            burstiness: parsed.burstiness,
            vocabulary_diversity: parsed.vocabulary_diversity,
            sentence_uniformity: parsed.sentence_uniformity,
            structural_regularity: parsed.structural_regularity,
            overall_assessment: parsed.overall_assessment,
          };
        }
      } else {
        const errText = await detectionResponse.text();
        console.error("Detection analysis error:", detectionResponse.status, errText);
      }
    } catch (detectionError) {
      console.error("Detection analysis failed:", detectionError);
      // Fallback: keep default score
    }

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
        estimated_score: estimatedHumanScore,
      });
    } catch (logError) {
      console.error("Failed to log humanizer usage:", logError);
    }

    return new Response(
      JSON.stringify({ humanizedText, estimatedHumanScore, analysis: analysisResult }),
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
