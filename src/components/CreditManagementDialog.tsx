import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, CalendarClock, Plus, Minus, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  credit_balance: number;
  similarity_credit_balance: number;
}

interface CreditManagementDialogProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreditManagementDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: CreditManagementDialogProps) {
  const { toast } = useToast();
  const [creditType, setCreditType] = useState<'full' | 'similarity_only'>('full');
  const [amount, setAmount] = useState('');
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  }, []);

  const resetForm = useCallback(() => {
    setAmount('');
    setExpiryDate(undefined);
    setCreditType('full');
  }, []);

  const handleClose = useCallback((openState: boolean) => {
    if (!openState) {
      resetForm();
    }
    onOpenChange(openState);
  }, [onOpenChange, resetForm]);

  const updateCredits = async (isAdd: boolean) => {
    if (!user || !amount) return;

    const numAmount = parseInt(amount) || 0;
    if (numAmount <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }

    const finalAmount = isAdd ? numAmount : -numAmount;
    const currentBalance = creditType === 'full' ? user.credit_balance : user.similarity_credit_balance;
    const newBalance = currentBalance + finalAmount;

    if (newBalance < 0) {
      toast({ title: 'Error', description: 'Balance cannot be negative', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      const updateField = creditType === 'full' ? 'credit_balance' : 'similarity_credit_balance';
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [updateField]: newBalance })
        .eq('id', user.id);

      if (updateError) throw updateError;

      const description = creditType === 'full'
        ? (isAdd ? 'Full credits added by admin' : 'Full credits deducted by admin')
        : (isAdd ? 'Similarity credits added by admin' : 'Similarity credits deducted by admin');

      const { data: transactionData } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: user.id,
          amount: finalAmount,
          balance_before: currentBalance,
          balance_after: newBalance,
          transaction_type: isAdd ? 'add' : 'deduct',
          credit_type: creditType,
          description,
          performed_by: currentUser?.id,
        })
        .select('id')
        .single();

      // If adding credits and expiry date is set, create credit_validity record
      if (isAdd && expiryDate) {
        await supabase.from('credit_validity').insert({
          user_id: user.id,
          credits_amount: numAmount,
          remaining_credits: numAmount,
          expires_at: expiryDate.toISOString(),
          credit_type: creditType,
          transaction_id: transactionData?.id || null,
        });
      }

      toast({
        title: 'Success',
        description: `${creditType === 'full' ? 'Full' : 'Similarity'} credits ${isAdd ? 'added' : 'deducted'}${expiryDate && isAdd ? ` (expires ${format(expiryDate, 'PPP')})` : ''}`,
      });

      handleClose(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to update credits:', error);
      toast({ title: 'Error', description: 'Failed to update credits', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const currentBalance = creditType === 'full' ? user.credit_balance : user.similarity_credit_balance;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Manage Credits
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* User Info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium">{user.full_name || 'Unnamed User'}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="flex gap-4 mt-2">
              <div>
                <span className="text-xs text-muted-foreground">Full: </span>
                <span className="font-bold text-primary">{user.credit_balance}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Similarity: </span>
                <span className="font-bold text-blue-600">{user.similarity_credit_balance}</span>
              </div>
            </div>
          </div>

          {/* Credit Type Tabs */}
          <Tabs value={creditType} onValueChange={(v) => setCreditType(v as 'full' | 'similarity_only')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="full">Full Credits</TabsTrigger>
              <TabsTrigger value="similarity_only">Similarity Credits</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              placeholder="Enter credit amount"
              value={amount}
              onChange={handleAmountChange}
              min="1"
              autoFocus
            />
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <Label>Expiry Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expiryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarClock className="mr-2 h-4 w-4" />
                  {expiryDate ? format(expiryDate, "PPP") : "Select expiry date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={expiryDate}
                  onSelect={setExpiryDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
                <div className="p-2 border-t flex gap-1 flex-wrap">
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setExpiryDate(addDays(new Date(), 30))}>30d</Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setExpiryDate(addDays(new Date(), 60))}>60d</Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setExpiryDate(addDays(new Date(), 90))}>90d</Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setExpiryDate(undefined)}>Clear</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Current Balance Display */}
          <div className="text-center text-sm text-muted-foreground">
            Current {creditType === 'full' ? 'Full' : 'Similarity'} Balance: <span className="font-bold">{currentBalance}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => updateCredits(true)}
              disabled={loading || !amount}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Credits
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => updateCredits(false)}
              disabled={loading || !amount}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Minus className="h-4 w-4 mr-2" />}
              Deduct Credits
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
