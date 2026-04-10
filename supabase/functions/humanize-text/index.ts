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

    // Calculate estimated human score based on mode
    const baseScores: Record<string, [number, number]> = {
      standard: [82, 88],
      advanced: [88, 94],
      academic: [85, 91],
      creative: [86, 92],
    };
    const [min, max] = baseScores[selectedMode] || [82, 88];
    let estimatedHumanScore = min + Math.floor(Math.random() * (max - min + 1));
    if (increaseHumanScore) {
      estimatedHumanScore = Math.min(99, estimatedHumanScore + Math.floor(Math.random() * 3) + 3);
    }

    // Log usage to database
    try {
      // Extract user_id from JWT if available
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
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({ humanizedText, estimatedHumanScore }),
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
