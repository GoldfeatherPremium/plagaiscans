import { supabase } from '@/integrations/supabase/client';

/**
 * Fire-and-forget sync of a single user to SendFox.
 * Failures are logged to the console but never thrown — must NEVER block UX.
 * Safe to call from signup, profile updates, or after credit changes.
 *
 * Note: this is the PROMOTIONAL channel. The SendPulse transactional pipeline
 * is completely separate and unaffected.
 */
export function triggerSendfoxSync(userId: string | null | undefined): void {
  if (!userId) return;
  // Don't await — best effort, runs in the background.
  supabase.functions
    .invoke('sync-contact-to-sendfox', { body: { user_id: userId } })
    .then(({ error }) => {
      if (error) console.warn('[sendfox] sync failed', error.message);
    })
    .catch((e) => console.warn('[sendfox] sync threw', e));
}
