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
        setValidityRecords(data as CreditValidity[]);
      }
      setLoading(false);
    };

    fetchValidity();
  }, [user]);

  if (loading || validityRecords.length === 0) {
    return null;
  }

  const totalExpiringCredits = validityRecords.reduce((sum, v) => sum + v.remaining_credits, 0);
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
          Credits that will expire if not used
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <Coins className="h-5 w-5 text-amber-500" />
            <span className="font-medium">Total Expiring</span>
          </div>
          <span className="text-2xl font-bold text-amber-600">{totalExpiringCredits}</span>
        </div>

        {/* Individual Records */}
        <div className="space-y-2">
          {validityRecords.slice(0, 3).map((record) => {
            const days = differenceInDays(new Date(record.expires_at), new Date());
            const isUrgent = days <= 3;
            const isWarning = days <= 7;

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
                    {days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days left`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={isUrgent ? 'destructive' : isWarning ? 'outline' : 'secondary'}
                    className={isWarning && !isUrgent ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : ''}
                  >
                    {record.remaining_credits} credits
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(record.expires_at), 'MMM dd')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {validityRecords.length > 3 && (
          <p className="text-xs text-muted-foreground text-center">
            +{validityRecords.length - 3} more expiring batches
          </p>
        )}
      </CardContent>
    </Card>
  );
};
