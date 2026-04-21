import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, CheckCircle, AlertCircle, Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type DocumentStatus = 'pending' | 'in_progress' | 'completed' | 'error' | 'cancelled';

interface StatusBadgeProps {
  status: DocumentStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { t } = useTranslation('common');

  const config = {
    pending: {
      labelKey: 'status.pending',
      className: 'status-pending border',
      icon: Clock,
    },
    in_progress: {
      labelKey: 'status.inProgress',
      className: 'status-progress border',
      icon: Loader2,
    },
    completed: {
      labelKey: 'status.completed',
      className: 'status-completed border',
      icon: CheckCircle,
    },
    error: {
      labelKey: 'status.error',
      className: 'bg-destructive/10 text-destructive border-destructive/30 border',
      icon: AlertCircle,
    },
    cancelled: {
      labelKey: 'status.cancelled',
      className: 'bg-red-100 text-red-700 border-red-300 border dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
      icon: Ban,
    },
  };

  const { labelKey, className, icon: Icon } = config[status];

  return (
    <Badge variant="outline" className={`${className} gap-1.5 font-medium`}>
      <Icon className={`h-3.5 w-3.5 ${status === 'in_progress' ? 'animate-spin' : ''}`} />
      {t(labelKey)}
    </Badge>
  );
};
