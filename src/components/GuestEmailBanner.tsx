import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Bell, X, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GuestEmailBannerProps {
  token: string;
  onEmailSaved: (email: string, name?: string) => void;
}

export function GuestEmailBanner({ token, onEmailSaved }: GuestEmailBannerProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem(`guest-email-dismissed-${token}`) === 'true';
  });

  const handleDismiss = () => {
    sessionStorage.setItem(`guest-email-dismissed-${token}`, 'true');
    setDismissed(true);
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubscribe = async () => {
    if (!email.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }

    if (!validateEmail(email)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('magic_upload_links')
        .update({ 
          guest_email: email.trim(),
          guest_name: name.trim() || null 
        })
        .eq('token', token);

      if (error) throw error;

      toast({
        title: 'Email Saved!',
        description: 'You will receive notifications when your documents are ready',
      });

      onEmailSaved(email.trim(), name.trim() || undefined);
    } catch (error) {
      console.error('Error saving guest email:', error);
      toast({
        title: 'Error',
        description: 'Failed to save email. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (dismissed) return null;

  return (
    <Card className="border-primary/30 bg-primary/5 mb-6">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground">Get notified when your documents are ready!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your email to receive a notification when your document processing is complete.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor="guest-email" className="sr-only">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="guest-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={saving}
                  />
                </div>
              </div>
              
              <div className="sm:w-40 space-y-2">
                <Label htmlFor="guest-name" className="sr-only">Name (optional)</Label>
                <Input
                  id="guest-name"
                  type="text"
                  placeholder="Your name (optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                />
              </div>
              
              <Button 
                onClick={handleSubscribe}
                disabled={saving || !email.trim()}
                className="shrink-0"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Subscribe
                  </>
                )}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground">
              We'll only use this email to notify you about your document status. No spam, ever.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
