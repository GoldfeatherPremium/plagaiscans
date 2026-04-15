import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';

interface AdminResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { id: string; email: string; full_name: string | null } | null;
}

export function AdminResetPasswordDialog({ open, onOpenChange, user }: AdminResetPasswordDialogProps) {
  const { toast } = useToast();
  const [customPassword, setCustomPassword] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const reset = () => {
    setCustomPassword('');
    setUseCustom(false);
    setLoading(false);
    setNewPassword(null);
    setCopied(false);
    setShowPassword(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const handleReset = async () => {
    if (!user) return;
    setLoading(true);

    const payload: any = { userId: user.id };
    if (useCustom && customPassword.length >= 8) {
      payload.newPassword = customPassword;
    }

    const { data, error } = await supabase.functions.invoke('admin-reset-user-password', {
      body: payload,
    });

    setLoading(false);

    if (error || data?.error) {
      toast({ title: 'Error', description: data?.error || error?.message || 'Failed to reset password', variant: 'destructive' });
      return;
    }

    setNewPassword(data.password);
    toast({ title: 'Password reset successfully' });
  };

  const copyPassword = async () => {
    if (!newPassword) return;
    await navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            Reset password for {user?.full_name || user?.email}
          </DialogDescription>
        </DialogHeader>

        {newPassword ? (
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <Label className="text-xs text-muted-foreground">New Password</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-background border rounded px-3 py-2 text-sm font-mono break-all">
                  {showPassword ? newPassword : '••••••••••••'}
                </code>
                <Button size="icon" variant="outline" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="outline" onClick={copyPassword}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
              ⚠️ Share this password securely with the customer. They should change it after logging in.
            </p>
            <Button className="w-full" onClick={() => handleClose(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={!useCustom ? 'default' : 'outline'}
                onClick={() => setUseCustom(false)}
              >
                Auto-generate
              </Button>
              <Button
                size="sm"
                variant={useCustom ? 'default' : 'outline'}
                onClick={() => setUseCustom(true)}
              >
                Custom password
              </Button>
            </div>

            {useCustom && (
              <div className="space-y-1">
                <Label>Custom Password (min 8 characters)</Label>
                <Input
                  type="text"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="Enter new password..."
                />
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleReset}
              disabled={loading || (useCustom && customPassword.length < 8)}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
