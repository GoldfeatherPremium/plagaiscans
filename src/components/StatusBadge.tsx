import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { DocumentStatus } from '@/hooks/useDocuments';

interface StatusBadgeProps {
  status: DocumentStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = {
    pending: {
      label: 'Pending',
      className: 'status-pending border',
      icon: Clock,
    },
    in_progress: {
      label: 'In Progress',
      className: 'status-progress border',
      icon: Loader2,
    },
    completed: {
      label: 'Completed',
      className: 'status-completed border',
      icon: CheckCircle,
    },
    error: {
      label: 'Error',
      className: 'bg-destructive/10 text-destructive border-destructive/30 border',
      icon: AlertCircle,
    },
  };

  const { label, className, icon: Icon } = config[status];

  return (
    <Badge variant="outline" className={`${className} gap-1.5 font-medium`}>
      <Icon className={`h-3.5 w-3.5 ${status === 'in_progress' ? 'animate-spin' : ''}`} />
      {label}
    </Badge>
  );
};