import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { FileCheck, Loader2, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PhoneInput } from '@/components/PhoneInput';
import { SEO } from '@/components/SEO';

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // If user already has a phone number, redirect to dashboard
    if (profile?.phone) {
      navigate('/dashboard');
    }
  }, [profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPhoneValid) {
      setError('Please enter a valid phone number');
      return;
    }

    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ phone })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      
      toast({
        title: 'Profile completed!',
        description: 'Your phone number has been saved.',
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
        description="Add your phone number to complete your PlagaiScans profile."
        noIndex={true}
      />
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background decoration */}
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
            <p className="text-muted-foreground">Complete your profile</p>
          </div>

          <Card className="shadow-xl border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Add Phone Number</CardTitle>
                  <CardDescription>We need your phone number to complete your profile</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <PhoneInput
                    value={phone}
                    onChange={(fullNumber, valid) => {
                      setPhone(fullNumber);
                      setIsPhoneValid(valid);
                    }}
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loading || !isPhoneValid}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Complete Profile
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}