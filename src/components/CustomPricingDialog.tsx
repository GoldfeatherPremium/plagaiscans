import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, MessageSquare, Building2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CustomPricingDialogProps {
  children: React.ReactNode;
}

export function CustomPricingDialog({ children }: CustomPricingDialogProps) {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    companyName: '',
    estimatedCredits: '',
    creditType: 'full',
    useCase: '',
    additionalNotes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyName.trim() || !formData.estimatedCredits.trim() || !formData.useCase.trim()) {
      toast({
        title: 'Please fill all required fields',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    
    // Build the message
    const message = `
**Custom Pricing Request**

**Company/Organization:** ${formData.companyName}
**Estimated Monthly Credits:** ${formData.estimatedCredits}
**Credit Type:** ${formData.creditType === 'full' ? 'AI Scan Credits' : 'Similarity Only Credits'}

**Use Case:**
${formData.useCase}

${formData.additionalNotes ? `**Additional Notes:**\n${formData.additionalNotes}` : ''}

**Contact Email:** ${profile?.email || user?.email || 'Not provided'}
**Contact Name:** ${profile?.full_name || 'Not provided'}
    `.trim();

    const { error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user?.id || '00000000-0000-0000-0000-000000000000',
        subject: `Custom Pricing Request: ${formData.companyName}`,
        message,
        ticket_type: 'custom_pricing',
        priority: 'high',
        status: 'open',
      });

    setSubmitting(false);

    if (error) {
      toast({
        title: 'Error submitting request',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Request Submitted!',
        description: 'Our team will review your custom pricing request and get back to you soon.',
      });
      setOpen(false);
      setFormData({
        companyName: '',
        estimatedCredits: '',
        creditType: 'full',
        useCase: '',
        additionalNotes: '',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Request Custom Pricing
          </DialogTitle>
          <DialogDescription>
            Need a custom plan for your organization? Fill out this form and our team will create a tailored pricing package for you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company/Organization Name *</Label>
            <Input
              id="companyName"
              placeholder="Your company name"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimatedCredits">Estimated Monthly Credits *</Label>
              <Input
                id="estimatedCredits"
                placeholder="e.g., 500, 1000+"
                value={formData.estimatedCredits}
                onChange={(e) => setFormData({ ...formData, estimatedCredits: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="creditType">Credit Type</Label>
              <Select 
                value={formData.creditType} 
                onValueChange={(v) => setFormData({ ...formData, creditType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">AI Scan Credits</SelectItem>
                  <SelectItem value="similarity_only">Similarity Only</SelectItem>
                  <SelectItem value="both">Both Types</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="useCase">Use Case *</Label>
            <Textarea
              id="useCase"
              placeholder="Describe how you plan to use our service (e.g., academic institution, content agency, etc.)"
              value={formData.useCase}
              onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalNotes">Additional Notes (Optional)</Label>
            <Textarea
              id="additionalNotes"
              placeholder="Any special requirements or questions?"
              value={formData.additionalNotes}
              onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
              rows={2}
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Request
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            We typically respond within 24-48 hours
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
