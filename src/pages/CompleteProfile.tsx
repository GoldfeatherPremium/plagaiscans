import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FileCheck, Loader2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PhoneInput } from '@/components/PhoneInput';
import { SEO } from '@/components/SEO';
import { useTranslation } from 'react-i18next';

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation('auth');
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [error, setError] = useState('');

  const needsName = !profile?.full_name;
  // Phone is optional now — only show field if not yet provided
  const showPhoneField = !profile?.phone;

  useEffect(() => {
    // Only name is required for completion
    if (profile && profile.full_name) {
      navigate('/dashboard');
    }
  }, [profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (needsName && !fullName.trim()) {
      setError('Please enter your full name');
      return;
    }

    // If phone was entered, it must be valid; empty is allowed
    if (showPhoneField && phone && !isPhoneValid) {
      setError('Please enter a valid phone number, or leave it empty');
      return;
    }

    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);

    try {
      const updates: Record<string, string> = {};
      if (needsName) updates.full_name = fullName.trim();
      if (showPhoneField && phone && isPhoneValid) updates.phone = phone;

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      
      toast({
        title: 'Profile completed!',
        description: 'Your profile has been saved.',
      });
      
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      toast({
        title: 'Error',
        description: err.message || 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <SEO
        title="Complete Your Profile"
        description="Complete your PlagaiScans profile to get started."
        noIndex={true}
      />
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        </div>

        <div className="w-full max-w-md page-enter">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4 group">
              <div className="h-11 w-11 rounded-xl gradient-primary flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-lg shadow-primary/20">
                <FileCheck className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-2xl">PlagaiScans</span>
            </div>
            <p className="text-muted-foreground">{t('completeProfile.almostThere', { defaultValue: 'Just one more step before your dashboard.' })}</p>
          </div>

          <Card className="shadow-xl border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>{t('completeProfile.title', { defaultValue: 'Tell us a bit about you' })}</CardTitle>
                  <CardDescription>{t('completeProfile.subtitle', { defaultValue: 'Add your name so we can personalize receipts and invoices.' })}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {needsName && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t('signup.fullNameLabel')}</Label>
                    <Input
                      id="fullName"
                      placeholder={t('signup.fullNamePlaceholder')}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                )}
                {showPhoneField && (
                  <div className="space-y-2">
                    <Label htmlFor="phone">
                      {t('signup.phoneLabel')}{' '}
                      <span className="text-xs font-normal text-muted-foreground">({t('completeProfile.optional', { defaultValue: 'optional' })})</span>
                    </Label>
                    <PhoneInput
                      value={phone}
                      onChange={(fullNumber, valid) => {
                        setPhone(fullNumber);
                        setIsPhoneValid(valid);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('completeProfile.optionalPhoneHelper', {
                        defaultValue: 'Optional — used for WhatsApp delivery alerts and account recovery.',
                      })}
                    </p>
                  </div>
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || (needsName && !fullName.trim())}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('completeProfile.submit', { defaultValue: 'Complete Profile' })}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
