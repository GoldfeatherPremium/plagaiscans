import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompts: Record<string, string> = {
  standard: `You are an expert text humanizer. Your task is to rewrite AI-generated text so it reads as naturally human-written content.

Rules:
- Completely restructure sentences — do NOT just swap synonyms
- Vary sentence length: mix short punchy sentences with longer flowing ones
- Add natural human imperfections: occasional informal phrasing, conversational transitions
- Reduce repetitive phrasing patterns typical of AI
- Avoid robotic or overly structured patterns (no "Furthermore," "Moreover," "In conclusion" overuse)
- Maintain the EXACT original meaning — do not add or remove information
- Add burstiness: some paragraphs short, some longer
- Add perplexity variation: use unexpected but appropriate word choices
- Ensure grammar correctness and readability (Grade 6-10 level)
- Output ONLY the rewritten text, no explanations or meta-commentary`,

  advanced: `You are a world-class text humanizer specializing in making AI-generated content completely indistinguishable from human writing.

Rules:
- Completely restructure every sentence — never keep the original structure
- Aggressively vary sentence length and rhythm
- Add natural human voice: personal touches, slight colloquialisms, varied transitions
- Break up formulaic patterns entirely
- Use contractions naturally (don't → don't, it is → it's) where appropriate
- Add subtle opinion markers and hedging language humans naturally use ("kind of", "pretty much", "honestly")
- Vary paragraph lengths dramatically
- Use active voice predominantly
- Include occasional rhetorical questions or asides
- Maintain original meaning strictly
- Add significant burstiness and perplexity variation
- Ensure content reads as if written by a thoughtful, experienced human writer
- Output ONLY the rewritten text`,

  academic: `You are an expert academic writer who humanizes AI-generated academic text while maintaining scholarly standards.

Rules:
- Rewrite with formal academic tone but natural human voice
- Restructure sentences completely — avoid AI-typical patterns
- Use discipline-appropriate vocabulary naturally, not forced
- Vary sentence complexity: mix simple clear statements with nuanced complex ones
- Add natural academic hedging ("suggests", "appears to", "may indicate")
- Use proper citation language patterns
- Avoid overuse of transition words AI typically repeats
- Maintain argumentative flow and logical structure
- Keep the exact original meaning and claims
- Use passive voice sparingly and intentionally, not as default
- Add natural paragraph transitions that don't feel formulaic
- Ensure it reads like a well-written student or researcher paper
- Output ONLY the rewritten text`,

  creative: `You are a creative writer who transforms AI-generated text into engaging, naturally human prose.

Rules:
- Completely reimagine sentence structures with creative flair
- Use vivid, specific language instead of generic AI phrasing
- Add storytelling elements: anecdotes-style transitions, engaging hooks
- Vary rhythm dramatically — short fragments mixed with flowing sentences
- Use figurative language naturally where appropriate
- Add personality and voice — the text should feel like it has a unique author
- Include natural conversational elements
- Break conventional patterns — start sentences in unexpected ways
- Maintain the core meaning while enhancing engagement
- Use sensory and concrete language over abstract AI-speak
- Create natural flow that pulls the reader forward
- Output ONLY the rewritten text`,
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
