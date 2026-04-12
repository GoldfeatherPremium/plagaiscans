import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[VALIDATE-REFERRAL] ${step}${detailsStr}`);
};

// Common disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  "tempmail.com", "throwaway.email", "guerrillamail.com", "guerrillamail.info",
  "grr.la", "guerrillamail.biz", "guerrillamail.de", "guerrillamail.net",
  "guerrillamail.org", "sharklasers.com", "guerrillamailblock.com",
  "pokemail.net", "spam4.me", "yopmail.com", "yopmail.fr", "yopmail.net",
  "cool.fr.nf", "jetable.fr.nf", "nospam.ze.tc", "nomail.xl.cx",
  "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf", "moncourrier.fr.nf",
  "monemail.fr.nf", "monmail.fr.nf", "mailinator.com", "mailinater.com",
  "mailinator2.com", "mailtothis.com", "trashmail.com", "trashmail.me",
  "trashmail.net", "trashymail.com", "trashymail.net", "10minutemail.com",
  "tempail.com", "tempr.email", "discard.email", "discardmail.com",
  "discardmail.de", "disposableemailaddresses.emailmiser.com",
  "disposable-email.ml", "dodgeit.com", "emailondeck.com",
  "fakeinbox.com", "fastacura.com", "filzmail.com", "gishpuppy.com",
  "mailcatch.com", "mailexpire.com", "mailnesia.com", "mailnull.com",
  "mailshell.com", "mailsiphon.com", "mailzilla.com", "mintemail.com",
  "mt2015.com", "mytrashmail.com", "nobulk.com", "noclickemail.com",
  "nogmailspam.info", "notsharingmy.info", "nowhere.org",
  "spamfree24.org", "spamgourmet.com", "spamherelots.com",
  "tempomail.fr", "throwam.com", "trash-mail.at", "wegwerfmail.de",
  "wegwerfmail.net", "wh4f.org", "mailnator.com", "binkmail.com",
  "bobmail.info", "chammy.info", "devnullmail.com", "letthemeatspam.com",
  "mailme.lv", "meltmail.com", "safetymail.info", "spamavert.com",
  "spambox.us", "spamcero.com", "spamcorptastic.com", "spamday.com",
  "spamfighter.cf", "spamfighter.ga", "spamfighter.gq", "spamfighter.ml",
  "spamfighter.tk", "spamfree.eu", "spammotel.com", "spaml.com",
  "uggsrock.com",
]);

// Max referrals per referrer per day
const MAX_REFERRALS_PER_DAY = 5;
// Max IPs for same referral chain
const MAX_IP_USES = 3;

function normalizeEmail(email: string): string {
  const [localPart, domain] = email.toLowerCase().trim().split("@");
  if (!domain) return email.toLowerCase().trim();
  // Remove +alias for gmail-like providers
  const gmailLike = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "protonmail.com"];
  let normalized = localPart;
  if (gmailLike.includes(domain)) {
    normalized = localPart.split("+")[0];
    // Also remove dots for gmail
    if (domain === "gmail.com" || domain === "googlemail.com") {
      normalized = normalized.replace(/\./g, "");
    }
  }
  const normalizedDomain = domain === "googlemail.com" ? "gmail.com" : domain;
  return `${normalized}@${normalizedDomain}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { referralCode, email, ip, action } = body;

    // Handle IP logging action
    if (action === "log_ip") {
      const { ip: logIp, userId, referrerId } = body;
      if (logIp && userId) {
        await supabaseAdmin.from("referral_ip_log").insert({
          ip_address: logIp,
          user_id: userId,
          referrer_id: referrerId || null,
        });
        logStep("IP logged", { ip: logIp, userId });
      }
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!referralCode || !email) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Validating referral", { referralCode, email: email.substring(0, 3) + "***", ip });

    // 1. Look up referrer by code
    const { data: referrer } = await supabaseAdmin
      .from("profiles")
      .select("id, email, signup_ip")
      .eq("referral_code", referralCode)
      .maybeSingle();

    if (!referrer) {
      logStep("Invalid referral code");
      return new Response(
        JSON.stringify({ valid: false, reason: "Invalid referral code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Self-referral check
    const normalizedNewEmail = normalizeEmail(email);
    const normalizedReferrerEmail = normalizeEmail(referrer.email);
    if (normalizedNewEmail === normalizedReferrerEmail) {
      logStep("Self-referral detected via email");
      return new Response(
        JSON.stringify({ valid: false, reason: "Self-referral detected", referrerId: referrer.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Disposable email check
    const emailDomain = email.toLowerCase().split("@")[1];
    if (DISPOSABLE_DOMAINS.has(emailDomain)) {
      logStep("Disposable email detected", { domain: emailDomain });
      return new Response(
        JSON.stringify({ valid: false, reason: "Disposable email not allowed", referrerId: referrer.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Email alias detection - check if normalized email matches referrer's or any existing referred user
    const { data: existingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("referred_by", referrer.id);

    const existingNormalized = new Set(
      (existingProfiles || []).map((p) => normalizeEmail(p.email))
    );
    existingNormalized.add(normalizedReferrerEmail);

    if (existingNormalized.has(normalizedNewEmail)) {
      logStep("Email alias of existing user detected");
      return new Response(
        JSON.stringify({ valid: false, reason: "Email alias of existing account detected", referrerId: referrer.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. IP-based fraud checks (if IP provided)
    if (ip) {
      // Check if referrer has same IP
      if (referrer.signup_ip === ip) {
        logStep("IP matches referrer's signup IP");
        return new Response(
          JSON.stringify({ valid: false, reason: "Same IP as referrer", referrerId: referrer.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check IP reuse count across all referrals
      const { count: ipUseCount } = await supabaseAdmin
        .from("referral_ip_log")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ip);

      if ((ipUseCount || 0) >= MAX_IP_USES) {
        logStep("IP used too many times", { count: ipUseCount });
        return new Response(
          JSON.stringify({ valid: false, reason: "IP address used too many times for referrals", referrerId: referrer.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if same IP already used for this referrer
      const { data: existingIpForReferrer } = await supabaseAdmin
        .from("referral_ip_log")
        .select("id")
        .eq("ip_address", ip)
        .eq("referrer_id", referrer.id)
        .maybeSingle();

      if (existingIpForReferrer) {
        logStep("IP already used for this referrer");
        return new Response(
          JSON.stringify({ valid: false, reason: "IP already used for this referrer", referrerId: referrer.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 6. Rate limiting - max referrals per referrer per day
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { count: recentCount } = await supabaseAdmin
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", referrer.id)
      .gte("created_at", oneDayAgo.toISOString());

    if ((recentCount || 0) >= MAX_REFERRALS_PER_DAY) {
      logStep("Rate limit exceeded", { recentCount });
      return new Response(
        JSON.stringify({ valid: false, reason: "Referrer rate limit exceeded", referrerId: referrer.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // All checks passed
    logStep("Referral validated successfully");
    return new Response(
      JSON.stringify({ valid: true, referrerId: referrer.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("Error", { error: message });
    return new Response(
      JSON.stringify({ valid: false, reason: "Validation error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
