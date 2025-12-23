import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { History, CheckCircle, XCircle, Clock, Send, Users, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PushLog {
  id: string;
  event_type: string;
  title: string;
  body: string;
  target_audience: string;
  target_user_id: string | null;
  recipient_count: number;
  success_count: number;
  failed_count: number;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

const statusConfig: Record<string, { icon: React.ElementType; color: string }> = {
  pending: { icon: Clock, color: 'text-amber-500' },
  sending: { icon: Send, color: 'text-blue-500' },
  completed: { icon: CheckCircle, color: 'text-green-500' },
  failed: { icon: XCircle, color: 'text-red-500' },
};

const audienceLabels: Record<string, string> = {
  all: 'All Users',
  customers: 'Customers',
  staff: 'Staff',
  admins: 'Admins',
  specific: 'Specific User',
  multiple: 'Multiple Users',
};

export const PushNotificationLogs: React.FC = () => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['push-notification-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('push_notification_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as PushLog[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Push Notification Logs
        </CardTitle>
        <CardDescription>
          Recent push notification delivery history
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!logs || logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No push notifications sent yet
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {logs.map((log) => {
                const statusInfo = statusConfig[log.status] || statusConfig.pending;
                const StatusIcon = statusInfo.icon;

                return (
                  <div
                    key={log.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <StatusIcon className={cn("h-4 w-4", statusInfo.color)} />
                          <h4 className="font-medium truncate">{log.title}</h4>
                          <Badge variant="outline" className="text-xs">
                            {log.event_type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {log.body}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {log.target_user_id ? <User className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                            {audienceLabels[log.target_audience] || log.target_audience}
                          </span>
                          <span>
                            {log.success_count}/{log.recipient_count} delivered
                          </span>
                          {log.failed_count > 0 && (
                            <span className="text-red-500">
                              {log.failed_count} failed
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-red-500 mt-2 p-2 bg-red-50 dark:bg-red-950/30 rounded">
                        {log.error_message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
