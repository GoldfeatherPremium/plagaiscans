import React, { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useIdleTimer } from '@/hooks/useIdleTimer';
import { useUploadActivity } from '@/contexts/UploadActivityContext';

const ROLE_LIMITS_MIN: Record<string, number> = {
  admin: 30,
  staff: 45,
  customer: 60,
};

const WARN_MS = 5 * 60 * 1000;

const formatMMSS = (totalSeconds: number) => {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

export const SessionTimeoutManager: React.FC = () => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('common');
  const { isUploading } = useUploadActivity();

  const idleMs = useMemo(() => {
    const minutes = (role && ROLE_LIMITS_MIN[role]) || 60;
    return minutes * 60 * 1000;
  }, [role]);

  const isCheckout =
    location.pathname.startsWith('/checkout') ||
    location.pathname.startsWith('/dashboard/checkout');

  const isPaused = isUploading || isCheckout;
  const enabled = !!user;

  const handleExpire = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // ignore
    }
    toast(t('session.signedOutToast', 'Signed out due to inactivity.'));
    navigate('/auth?reason=timeout', { replace: true });
  }, [navigate, signOut, t]);

  const { secondsUntilExpire, isWarning, reset } = useIdleTimer({
    idleMs,
    warnMs: WARN_MS,
    isPaused,
    enabled,
    onExpire: handleExpire,
  });

  if (!user) return null;

  return (
    <AlertDialog open={isWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('session.timeoutTitle', 'Still there?')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('session.timeoutBody', "You'll be signed out in {{time}} due to inactivity.", {
              time: formatMMSS(secondsUntilExpire),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleExpire()}>
            {t('session.signOutNow', 'Sign out now')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => reset()}>
            {t('session.stay', 'Stay signed in')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SessionTimeoutManager;
