import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailViaSendPulse, logEmail, incrementEmailCounter, wrapEmailContent, getEmailFooter, EMAIL_CONFIG } from "../_shared/email-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generatePassword(length = 14): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  let pwd = '';
  pwd += upper[arr[0] % upper.length];
  pwd += lower[arr[1] % lower.length];
  pwd += digits[arr[2] % digits.length];
  pwd += special[arr[3] % special.length];
  for (let i = 4; i < length; i++) pwd += all[arr[i] % all.length];
  const sh = pwd.split('');
  for (let i = sh.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1);
    [sh[i], sh[j]] = [sh[j], sh[i]];
  }
  return sh.join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const adminId = claimsData.claims.sub;

    const { data: adminRole } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', adminId).eq('role', 'admin').maybeSingle();
    if (!adminRole) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { name, contact_email, webhook_url, initial_credits } = await req.json();
    if (!name || !contact_email) {
      return new Response(JSON.stringify({ error: 'Name and contact_email are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const email = String(contact_email).toLowerCase().trim();
    const password = generatePassword(14);

    // Create auth user (cleanup stale if present)
    let { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
    });

    if (createError?.message?.includes('already been registered')) {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ filter: email });
      const existing = users?.find(u => u.email === email);
      if (existing) {
        // Check if existing user already has a reseller record
        const { data: existingReseller } = await supabaseAdmin
          .from('resellers').select('id').eq('user_id', existing.id).maybeSingle();
        if (existingReseller) {
          return new Response(JSON.stringify({ error: 'A reseller account already exists for this email.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Check if used by another active user (customer/staff)
        const { data: profile } = await supabaseAdmin
          .from('profiles').select('id').eq('id', existing.id).maybeSingle();
        if (profile) {
          return new Response(JSON.stringify({ error: 'This email belongs to an existing account. Use a different email for the reseller.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // Stale auth user — delete and recreate
        await supabaseAdmin.auth.admin.deleteUser(existing.id);
      }
      const result = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
      newUser = result.data;
      createError = result.error;
    }

    if (createError || !newUser?.user) {
      console.error('Create reseller user error:', createError);
      return new Response(JSON.stringify({ error: createError?.message || 'Failed to create user' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = newUser.user.id;

    // Remove default 'customer' role added by handle_new_user trigger
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    // Assign reseller role
    await supabaseAdmin.from('user_roles').insert({ user_id: userId, role: 'reseller' });
    // Remove auto-created profile (resellers don't have profiles)
    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    // Create reseller record
    const { data: reseller, error: resellerError } = await supabaseAdmin
      .from('resellers')
      .insert({
        name,
        contact_email: email,
        webhook_url: webhook_url || null,
        user_id: userId,
        created_by: adminId,
      })
      .select()
      .single();

    if (resellerError) {
      // Cleanup auth user on failure
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: resellerError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Optional initial credits top-up
    if (initial_credits && Number(initial_credits) > 0) {
      await supabaseAdmin.rpc('topup_reseller_credits', {
        p_reseller_id: reseller.id,
        p_amount: Number(initial_credits),
        p_description: 'Initial credits on reseller creation',
        p_performed_by: adminId,
      });
    }

    // Send welcome email with credentials
    const loginUrl = `${EMAIL_CONFIG.SITE_URL}/auth`;
    const emailContent = `
      <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 22px;">Welcome to PlagaiScans Reseller Program</h2>
      <p style="color: #4b5563; margin: 0 0 8px 0; line-height: 1.6;">
        Hi ${name},
      </p>
      <p style="color: #4b5563; margin: 0 0 20px 0; line-height: 1.6;">
        A reseller account has been created for you. You can log in to access your reseller dashboard, generate API keys, view your credit balance, monitor scans, and configure webhooks.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px 0;">
        <tr>
          <td style="background: #f3f4f6; border-radius: 8px; padding: 20px;">
            <p style="color: #374151; margin: 0 0 8px 0;"><strong>Email:</strong> ${email}</p>
            <p style="color: #374151; margin: 0 0 8px 0;"><strong>Password:</strong> ${password}</p>
            <p style="color: #374151; margin: 0;"><strong>Login link:</strong> <a href="${loginUrl}" style="color: #6366f1; text-decoration: none;">${loginUrl}</a></p>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
        <tr>
          <td align="center">
            <a href="${loginUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Login to Reseller Dashboard
            </a>
          </td>
        </tr>
      </table>

      <p style="color: #4b5563; margin: 20px 0 0 0; line-height: 1.6;">
        After logging in, head to the API Keys section to generate a key and read the <a href="${EMAIL_CONFIG.SITE_URL}/api-docs" style="color: #6366f1;">API documentation</a> to start integrating.
      </p>

      <p style="color: #b91c1c; font-size: 13px; margin: 20px 0 0 0; padding: 12px; background: #fef2f2; border-radius: 6px;">
        Please change your password after your first login for security.
      </p>

      ${getEmailFooter()}
    `;
    const htmlEmail = wrapEmailContent(emailContent, '🤝', 'Reseller Account Ready');

    let emailSent = false;
    try {
      const emailResult = await sendEmailViaSendPulse(
        { email, name },
        'Your PlagaiScans Reseller Account Is Ready',
        htmlEmail
      );
      emailSent = emailResult.success;
      await logEmail(supabaseAdmin, {
        emailType: 'reseller_welcome',
        recipientId: userId,
        recipientEmail: email,
        subject: 'Your PlagaiScans Reseller Account Is Ready',
        status: emailResult.success ? 'sent' : 'failed',
        providerResponse: emailResult.response,
        errorMessage: emailResult.error,
        metadata: { resellerId: reseller.id },
      });
      if (emailResult.success) await incrementEmailCounter(supabaseAdmin);
    } catch (e: any) {
      console.error('Email send failed:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      reseller,
      password,
      emailSent,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
