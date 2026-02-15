import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Mail, CreditCard, Calendar, Copy, Check } from 'lucide-react';

interface PreRegisterCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PreRegisterCreditDialog({ open, onOpenChange, onSuccess }: PreRegisterCreditDialogProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditType, setCreditType] = useState<'full' | 'similarity_only'>('full');
  const [expiryDays, setExpiryDays] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');
  const [result, setResult] = useState<{ password: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setEmail('');
    setCreditAmount('');
    setCreditType('full');
    setExpiryDays('');
    setStep('form');
    setResult(null);
    setCopied(false);
  };

  const handleClose = (value: boolean) => {
    if (!value) resetForm();
    onOpenChange(value);
  };

  const handleConfirm = () => {
    if (!email.trim() || !creditAmount || parseInt(creditAmount) <= 0) {
      toast({ title: 'Error', description: 'Please fill in email and a valid credit amount.', variant: 'destructive' });
      return;
    }
    setStep('confirm');
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user-with-credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          creditAmount: parseInt(creditAmount),
          creditType,
          expiryDays: expiryDays ? parseInt(expiryDays) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setResult({ password: data.password, emailSent: data.emailSent });
      setStep('success');
      onSuccess();

      toast({
        title: 'User Created Successfully',
        description: `Account created for ${email} with ${creditAmount} credits.`,
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = () => {
    if (result?.password) {
      navigator.clipboard.writeText(result.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const creditTypeLabel = creditType === 'full' ? 'Full Credits' : 'Similarity Credits';
  const validityText = expiryDays ? `${expiryDays} days` : 'No expiry';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {step === 'success' ? 'User Created' : 'Pre-Register User'}
          </DialogTitle>
          <DialogDescription>
            {step === 'form' && 'Create a new account and assign credits. A welcome email will be sent.'}
            {step === 'confirm' && 'Please review the details below before proceeding.'}
            {step === 'success' && 'The account has been created and the email has been sent.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
              <Input
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Credit Type</Label>
              <Select value={creditType} onValueChange={(v) => setCreditType(v as 'full' | 'similarity_only')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Credits</SelectItem>
                  <SelectItem value="similarity_only">Similarity Credits</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Credit Amount</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 10"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Validity (days, optional)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 90"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  className="flex-1"
                />
                <div className="flex gap-1">
                  {[30, 60, 90].map((d) => (
                    <Button
                      key={d}
                      type="button"
                      variant={expiryDays === String(d) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setExpiryDays(String(d))}
                    >
                      {d}d
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={handleConfirm}>Review & Confirm</Button>
            </DialogFooter>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Email:</span><span className="font-medium">{email}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Credit Type:</span><span className="font-medium">{creditTypeLabel}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span><span className="font-medium">{creditAmount} credits</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Validity:</span><span className="font-medium">{validityText}</span></div>
            </div>
            <p className="text-xs text-muted-foreground">
              A password will be auto-generated and the customer will receive an email with login details.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('form')} disabled={loading}>Back</Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Account
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'success' && result && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-4 space-y-3">
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">✅ Account created successfully!</p>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Email:</span> {email}</p>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Password:</span>
                  <code className="bg-background px-2 py-0.5 rounded text-xs font-mono">{result.password}</code>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={copyPassword}>
                    {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <p><span className="text-muted-foreground">Email sent:</span> {result.emailSent ? '✅ Yes' : '❌ Failed'}</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
