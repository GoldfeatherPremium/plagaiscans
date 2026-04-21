import { useCallback, useEffect, useRef, useState } from 'react';

interface UseIdleTimerOptions {
  idleMs: number;
  warnMs: number; // milliseconds before expire to fire onWarn
  isPaused?: boolean;
  enabled?: boolean;
  onWarn?: () => void;
  onExpire?: () => void;
  onActivity?: () => void;
  storageKey?: string;
}

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

const THROTTLE_MS = 1000;

export function useIdleTimer({
  idleMs,
  warnMs,
  isPaused = false,
  enabled = true,
  onWarn,
  onExpire,
  onActivity,
  storageKey = 'plagai_last_activity',
}: UseIdleTimerOptions) {
  const [secondsUntilExpire, setSecondsUntilExpire] = useState<number>(Math.ceil(idleMs / 1000));
  const [isWarning, setIsWarning] = useState(false);

  const lastActivityRef = useRef<number>(Date.now());
  const lastWriteRef = useRef<number>(0);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warnedRef = useRef(false);
  const expiredRef = useRef(false);
  const pausedRef = useRef(isPaused);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  const writeActivity = useCallback(
    (ts: number) => {
      try {
        localStorage.setItem(storageKey, String(ts));
      } catch {
        // ignore
      }
    },
    [storageKey],
  );

  const readActivity = useCallback((): number => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v) return parseInt(v, 10) || Date.now();
    } catch {
      // ignore
    }
    return Date.now();
  }, [storageKey]);

  const reset = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    lastWriteRef.current = now;
    warnedRef.current = false;
    expiredRef.current = false;
    setIsWarning(false);
    setSecondsUntilExpire(Math.ceil(idleMs / 1000));
    writeActivity(now);
  }, [idleMs, writeActivity]);

  const dismissWarning = useCallback(() => {
    setIsWarning(false);
    warnedRef.current = false;
  }, []);

  // Activity handler
  const handleActivity = useCallback(() => {
    if (!enabled) return;
    if (pausedRef.current) {
      // Still record activity time so resuming doesn't immediately expire
      const now = Date.now();
      lastActivityRef.current = now;
      if (now - lastWriteRef.current > THROTTLE_MS) {
        lastWriteRef.current = now;
        writeActivity(now);
      }
      return;
    }
    const now = Date.now();
    if (now - lastActivityRef.current < THROTTLE_MS) return;
    lastActivityRef.current = now;
    lastWriteRef.current = now;
    writeActivity(now);
    onActivity?.();
  }, [enabled, onActivity, writeActivity]);

  // Subscribe to activity events
  useEffect(() => {
    if (!enabled) return;

    const onEvt = () => handleActivity();
    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, onEvt, { passive: true });
    });

    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey || !e.newValue) return;
      const ts = parseInt(e.newValue, 10);
      if (!Number.isFinite(ts)) return;
      if (ts > lastActivityRef.current) {
        lastActivityRef.current = ts;
        warnedRef.current = false;
        expiredRef.current = false;
        setIsWarning(false);
      }
    };
    window.addEventListener('storage', onStorage);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        // Sync from storage in case other tabs were active
        const stored = readActivity();
        if (stored > lastActivityRef.current) {
          lastActivityRef.current = stored;
        }
        // Force a tick check
        runTick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, onEvt);
      });
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, handleActivity, readActivity, storageKey]);

  // Initialize from storage on mount / when enabled flips on
  useEffect(() => {
    if (!enabled) {
      lastActivityRef.current = Date.now();
      warnedRef.current = false;
      expiredRef.current = false;
      setIsWarning(false);
      return;
    }
    const stored = readActivity();
    const now = Date.now();
    if (!stored || now - stored > idleMs) {
      // Treat as fresh start to avoid immediate expire on first login
      reset();
    } else {
      lastActivityRef.current = stored;
    }
  }, [enabled, idleMs, readActivity, reset]);

  // Tick logic
  const runTick = useCallback(() => {
    if (!enabled) return;
    if (pausedRef.current) {
      // While paused, keep activity timestamp moving so we don't expire on resume
      const now = Date.now();
      lastActivityRef.current = now;
      if (now - lastWriteRef.current > THROTTLE_MS * 5) {
        lastWriteRef.current = now;
        writeActivity(now);
      }
      setSecondsUntilExpire(Math.ceil(idleMs / 1000));
      setIsWarning(false);
      warnedRef.current = false;
      return;
    }

    const now = Date.now();
    const elapsed = now - lastActivityRef.current;
    const remaining = idleMs - elapsed;
    setSecondsUntilExpire(Math.max(0, Math.ceil(remaining / 1000)));

    if (remaining <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      setIsWarning(false);
      onExpire?.();
      return;
    }

    if (remaining <= warnMs && !warnedRef.current) {
      warnedRef.current = true;
      setIsWarning(true);
      onWarn?.();
    }
  }, [enabled, idleMs, warnMs, onExpire, onWarn, writeActivity]);

  useEffect(() => {
    if (!enabled) {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      return;
    }

    tickIntervalRef.current = setInterval(runTick, 1000);
    runTick();

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [enabled, runTick]);

  return { secondsUntilExpire, isWarning, reset, dismissWarning };
}
