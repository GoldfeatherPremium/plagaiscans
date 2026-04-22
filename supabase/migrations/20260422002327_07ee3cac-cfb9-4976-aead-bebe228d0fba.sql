-- Force sign out all users by deleting all active refresh tokens and sessions
DELETE FROM auth.refresh_tokens;
DELETE FROM auth.sessions;