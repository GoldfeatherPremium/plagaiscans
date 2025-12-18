import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, CheckCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: 'pending' | 'in_progress' | 'completed';
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
  };

  const { label, className, icon: Icon } = config[status];

  return (
    <Badge variant="outline" className={`${className} gap-1.5 font-medium`}>
      <Icon className={`h-3.5 w-3.5 ${status === 'in_progress' ? 'animate-spin' : ''}`} />
      {label}
    </Badge>
  );
};