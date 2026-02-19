import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailViaSendPulse, logEmail, incrementEmailCounter, wrapEmailContent, getEmailFooter, EMAIL_CONFIG } from "../_shared/email-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generatePassword(length = 12): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;

  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  // Ensure at least one of each type
  let password = '';
  password += upper[array[0] % upper.length];
  password += lower[array[1] % lower.length];
  password += digits[array[2] % digits.length];
  password += special[array[3] % special.length];

  for (let i = 4; i < length; i++) {
    password += all[array[i] % all.length];
  }

  // Shuffle
  const shuffled = password.split('');
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = array[i] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate admin auth
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

    // Check admin role
    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', adminId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { email, creditAmount, creditType, expiryDays } = await req.json();

    if (!email || !creditAmount || creditAmount <= 0) {
      return new Response(JSON.stringify({ error: 'Email and valid credit amount are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check if email already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingProfile) {
      return new Response(JSON.stringify({ error: 'This email is already registered. Use the existing credit management to add credits.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Generate password
    const password = generatePassword(12);

    // Create user via admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
    });

    if (createError || !newUser?.user) {
      console.error('Create user error:', createError);
      return new Response(JSON.stringify({ error: createError?.message || 'Failed to create user' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = newUser.user.id;

    // Upsert profile (trigger may have already created it)
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email: email.toLowerCase().trim(),
      full_name: null,
      phone: null,
      credit_balance: creditType === 'full' ? creditAmount : 0,
      similarity_credit_balance: creditType === 'similarity_only' ? creditAmount : 0,
    }, { onConflict: 'id' });

    // Assign customer role
    await supabaseAdmin.from('user_roles').insert({
      user_id: userId,
      role: 'customer',
    });

    // Create credit transaction
    const balanceField = creditType === 'full' ? 'credit_balance' : 'similarity_credit_balance';
    const { data: txData } = await supabaseAdmin.from('credit_transactions').insert({
      user_id: userId,
      amount: creditAmount,
      balance_before: 0,
      balance_after: creditAmount,
      transaction_type: 'add',
      credit_type: creditType === 'full' ? 'full' : 'similarity_only',
      description: 'Pre-registration credits added by admin',
      performed_by: adminId,
    }).select('id').single();

    // Create credit validity if expiry set
    if (expiryDays && expiryDays > 0) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      await supabaseAdmin.from('credit_validity').insert({
        user_id: userId,
        credits_amount: creditAmount,
        remaining_credits: creditAmount,
        expires_at: expiresAt.toISOString(),
        credit_type: creditType === 'full' ? 'full' : 'similarity_only',
        transaction_id: txData?.id || null,
      });
    }

    // Send welcome email
    const senderApiKey = Deno.env.get('SENDPULSE_CLIENT_ID'); // just check if configured
    let emailSent = false;

    if (senderApiKey) {
      const creditTypeLabel = creditType === 'full' ? 'Full Credits' : 'Similarity Credits';
      const validityText = expiryDays ? `${expiryDays} days` : 'No expiry';
      const loginUrl = `${EMAIL_CONFIG.SITE_URL}/auth`;

      const serviceDescription = creditType === 'full'
        ? 'Log in, upload your documents, and receive Turnitin.com-generated AI detection and similarity reports.'
        : 'Log in, upload your documents, and receive Turnitin.com-generated similarity reports.';

      const emailContent = `
        <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 22px;">Welcome to Plagaiscans!</h2>
        <p style="color: #4b5563; margin: 0 0 8px 0; line-height: 1.6;">
          An account has been created for you with credits ready to use.
        </p>
        <p style="color: #4b5563; margin: 0 0 20px 0; line-height: 1.6;">
          ${serviceDescription}
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

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 20px 0;">
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 8px; padding: 20px;">
              <p style="color: white; margin: 0 0 4px 0; font-size: 14px;">Your Credits</p>
              <p style="color: white; margin: 0 0 8px 0; font-size: 28px; font-weight: bold;">${creditAmount} ${creditTypeLabel}</p>
              <p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 13px;">Validity: ${validityText}</p>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
          <tr>
            <td align="center">
              <a href="${loginUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Login Now
              </a>
            </td>
          </tr>
        </table>

        <p style="color: #b91c1c; font-size: 13px; margin: 20px 0 0 0; padding: 12px; background: #fef2f2; border-radius: 6px;">
          Please change your password after your first login for security.
        </p>

        ${getEmailFooter()}
      `;

      const htmlEmail = wrapEmailContent(emailContent, '🎉', 'Welcome to Plagaiscans');

      const emailResult = await sendEmailViaSendPulse(
        { email: email.toLowerCase().trim(), name: email.split('@')[0] },
        'Your Plagaiscans Account Is Ready',
        htmlEmail
      );

      emailSent = emailResult.success;

      await logEmail(supabaseAdmin, {
        emailType: 'pre_registration_welcome',
        recipientId: userId,
        recipientEmail: email,
        subject: 'Your Plagaiscans Account Is Ready',
        status: emailResult.success ? 'sent' : 'failed',
        providerResponse: emailResult.response,
        errorMessage: emailResult.error,
        metadata: { creditAmount, creditType, expiryDays },
      });

      if (emailResult.success) {
        await incrementEmailCounter(supabaseAdmin);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      userId,
      password,
      emailSent,
      message: `User created with ${creditAmount} credits`,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
