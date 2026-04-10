import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const coreRules = `You are an expert human writer and editor. Your task is to rewrite the given text so that it sounds completely natural, human-written, and engaging while preserving the original meaning.

Follow these strict rules:

1. Rewrite the content with completely varied sentence structures (do NOT just replace words with synonyms).
2. Use a mix of short, medium, and long sentences to create natural rhythm.
3. Introduce slight human imperfections (subtle informality where appropriate).
4. Avoid repetitive phrasing and predictable patterns.
5. Ensure the tone matches human writing, not robotic or overly polished AI style.
6. Maintain clarity, coherence, and readability (Grade 6–10 level).
7. Do NOT change the meaning or add new information.
8. Avoid generic AI phrases and filler words.
9. Increase burstiness and perplexity naturally without harming readability.
10. Make the text sound like it was written by a real person.

Return ONLY the rewritten text without explanations.`;

const systemPrompts: Record<string, string> = {
  standard: coreRules,

  academic: coreRules + `\n\nAdditional mode instruction: Use formal tone, structured clarity, and precise wording. Maintain scholarly standards while keeping it naturally human.`,

  creative: coreRules + `\n\nAdditional mode instruction: Add engaging, slightly expressive language. Use vivid word choices and storytelling rhythm while keeping meaning intact.`,

  advanced: coreRules + `\n\nAdditional mode instruction: Aggressively restructure sentences for maximum human-like variation. Break every predictable pattern. Use unexpected but appropriate constructions.`,
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
