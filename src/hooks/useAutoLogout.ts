import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface UseAutoLogoutOptions {
  timeoutMinutes?: number;
  warningMinutes?: number;
  enabled?: boolean;
}

export const useAutoLogout = ({
  timeoutMinutes = 30,
  warningMinutes = 5,
  enabled = true,
}: UseAutoLogoutOptions = {}) => {
  const { user, signOut } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    clearTimers();
    toast.info('Session expired due to inactivity', {
      description: 'Please log in again to continue.',
      duration: 5000,
    });
    await signOut();
  }, [signOut, clearTimers]);

  const showWarning = useCallback(() => {
    if (!warningShownRef.current) {
      warningShownRef.current = true;
      toast.warning(`Session expiring in ${warningMinutes} minutes`, {
        description: 'Move your mouse or press a key to stay logged in.',
        duration: 10000,
      });
    }
  }, [warningMinutes]);

  const resetTimer = useCallback(() => {
    if (!enabled || !user) return;

    clearTimers();
    warningShownRef.current = false;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    const warningMs = (timeoutMinutes - warningMinutes) * 60 * 1000;

    // Set warning timer
    if (warningMinutes > 0 && warningMs > 0) {
      warningRef.current = setTimeout(showWarning, warningMs);
    }

    // Set logout timer
    timeoutRef.current = setTimeout(handleLogout, timeoutMs);
  }, [enabled, user, timeoutMinutes, warningMinutes, clearTimers, showWarning, handleLogout]);

  useEffect(() => {
    if (!enabled || !user) {
      clearTimers();
      return;
    }

    // Activity events to track
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    // Throttle reset to avoid too many calls
    let lastReset = Date.now();
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastReset > 1000) { // Only reset every 1 second max
        lastReset = now;
        resetTimer();
      }
    };

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, throttledReset, { passive: true });
    });

    // Start the initial timer
    resetTimer();

    return () => {
      clearTimers();
      events.forEach((event) => {
        window.removeEventListener(event, throttledReset);
      });
    };
  }, [enabled, user, resetTimer, clearTimers]);

  return {
    resetTimer,
  };
};
