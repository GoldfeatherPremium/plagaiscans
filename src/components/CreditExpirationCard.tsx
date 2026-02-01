import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, AlertTriangle, Calendar, Coins } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';

interface CreditValidity {
  id: string;
  credits_amount: number;
  remaining_credits: number;
  expires_at: string;
  created_at: string;
  expired: boolean;
  credit_type: string;
}

export const CreditExpirationCard: React.FC = () => {
  const { user } = useAuth();
  const [validityRecords, setValidityRecords] = useState<CreditValidity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchValidity = async () => {
      const { data } = await supabase
        .from('credit_validity')
        .select('*')
        .eq('user_id', user.id)
        .eq('expired', false)
        .gt('remaining_credits', 0)
        .order('expires_at', { ascending: true });

      if (data) {
        // Filter out already expired ones
        const activeRecords = data.filter(v => !isPast(new Date(v.expires_at)));
        setValidityRecords(activeRecords as CreditValidity[]);
      }
      setLoading(false);
    };

    fetchValidity();

    // Real-time subscription
    const channel = supabase
      .channel('credit-validity-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'credit_validity',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchValidity()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading || validityRecords.length === 0) {
    return null;
  }

  // Calculate separate totals for full and similarity credits
  const totalFullCredits = validityRecords
    .filter(v => v.credit_type === 'full')
    .reduce((sum, v) => sum + v.remaining_credits, 0);
  
  const totalSimilarityCredits = validityRecords
    .filter(v => v.credit_type === 'similarity')
    .reduce((sum, v) => sum + v.remaining_credits, 0);

  const soonestExpiry = validityRecords[0];
  const daysUntilExpiry = differenceInDays(new Date(soonestExpiry.expires_at), new Date());
  const isExpiringSoon = daysUntilExpiry <= 7;

  return (
    <Card className={`${isExpiringSoon ? 'border-amber-500/50 bg-amber-500/5' : ''}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-amber-500" />
          Time-Limited Credits
          {isExpiringSoon && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Expiring Soon
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Unused credits that will expire if not used
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Separate Summary for Full and Similarity Credits */}
        <div className="grid grid-cols-2 gap-3">
          {totalFullCredits > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI Scan</span>
              </div>
              <span className="text-xl font-bold text-primary">{totalFullCredits}</span>
            </div>
          )}
          {totalSimilarityCredits > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Similarity</span>
              </div>
              <span className="text-xl font-bold text-orange-500">{totalSimilarityCredits}</span>
            </div>
          )}
        </div>

        {/* Individual Records */}
        <div className="space-y-2">
          {validityRecords.slice(0, 5).map((record) => {
            const days = differenceInDays(new Date(record.expires_at), new Date());
            const hours = Math.floor((new Date(record.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60));
            const isUrgent = days <= 3;
            const isWarning = days <= 7;

            // Show more precise time for urgent items
            const timeDisplay = days <= 0 
              ? (hours <= 0 ? 'Expiring now' : `${hours}h left`)
              : days === 1 
                ? 'Tomorrow' 
                : `${days} days left`;

            return (
              <div 
                key={record.id}
                className={`flex items-center justify-between p-2 rounded-md border ${
                  isUrgent ? 'border-red-500/30 bg-red-500/5' :
                  isWarning ? 'border-amber-500/30 bg-amber-500/5' :
                  'border-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className={`h-4 w-4 ${isUrgent ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  <span className="text-sm">
                    {timeDisplay}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={record.credit_type === 'full' ? 'default' : 'secondary'}
                    className={record.credit_type === 'full' ? '' : 'bg-orange-500/10 text-orange-600 border-orange-500/20'}
                  >
                    {record.credit_type === 'full' ? 'AI Scan' : 'Similarity'}
                  </Badge>
                  <Badge 
                    variant={isUrgent ? 'destructive' : isWarning ? 'outline' : 'secondary'}
                    className={isWarning && !isUrgent ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : ''}
                  >
                    {record.remaining_credits} unused
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(record.expires_at), 'MMM dd, HH:mm')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {validityRecords.length > 5 && (
          <p className="text-xs text-muted-foreground text-center">
            +{validityRecords.length - 5} more expiring batches
          </p>
        )}
      </CardContent>
    </Card>
  );
};
