import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const SYSTEM_PROMPT = `You are an AI Admin Helper for a document processing platform. Your role is to assist the admin in understanding what changes they want to make and provide clear, structured responses.

You can help with:
1. UI & CONTENT EDITING: Edit texts, labels, buttons, page content, email templates, notification messages, WhatsApp templates, footer links, social media links
2. BUSINESS LOGIC CONFIGURATION: Adjust subscription rules, toggle features, modify inventory behavior, adjust referral rewards, coupon rules, payment flow messages

STRICT BOUNDARIES - You CANNOT:
- Delete database tables
- Remove authentication or role-based access
- Bypass payments, security, or access control rules
- Access or expose user passwords or credentials
- Execute unrestricted backend code

When responding to admin requests:
1. Clearly explain what changes would be made
2. List which system areas would be affected
3. Provide a structured JSON summary of proposed changes

For every request, your response MUST include:
- A clear explanation of the change
- Affected areas list
- A JSON block with the proposed changes in this format:
\`\`\`json
{
  "change_type": "ui_content|business_logic|configuration",
  "description": "Brief description",
  "affected_areas": ["area1", "area2"],
  "changes": [
    {
      "target": "what is being changed",
      "current_value": "current value if known",
      "new_value": "proposed new value",
      "action": "update|toggle|add|remove"
    }
  ],
  "requires_code_change": true|false,
  "safety_level": "safe|review_required|not_allowed"
}
\`\`\`

If a request violates the strict boundaries, respond with safety_level: "not_allowed" and explain why.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if AI helper is enabled
    const { data: settings } = await supabase
      .from('ai_admin_settings')
      .select('is_enabled')
      .single();

    if (!settings?.is_enabled) {
      return new Response(JSON.stringify({ error: 'AI Admin Helper is disabled' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { prompt, conversationHistory = [] } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build messages array with conversation history
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user', content: prompt }
    ];

    console.log('Calling Lovable AI gateway with prompt:', prompt.substring(0, 100));

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'No response generated';

    // Log the interaction
    await supabase.from('ai_audit_logs').insert({
      admin_id: user.id,
      prompt_text: prompt,
      ai_response: aiResponse,
      status: 'pending',
    });

    console.log('AI response generated successfully');

    return new Response(JSON.stringify({ 
      response: aiResponse,
      admin_id: user.id 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('AI Admin Helper error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
