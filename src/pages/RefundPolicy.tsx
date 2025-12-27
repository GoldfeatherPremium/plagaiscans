import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileCheck, ArrowLeft, Mail, Shield, Loader2 } from 'lucide-react';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function RefundPolicy() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    transactionId: '',
    reason: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.reason.trim()) {
      toast({
        title: "Please fill required fields",
        description: "Name, email, and reason are required.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000',
          subject: `Refund Request: ${formData.name}`,
          message: `Name: ${formData.name}\nEmail: ${formData.email}\nTransaction ID: ${formData.transactionId || 'Not provided'}\n\nReason:\n${formData.reason}`,
          priority: 'high',
          status: 'open'
        });

      if (error) throw error;

      toast({
        title: "Refund Request Submitted",
        description: "We'll review your request and respond within 24-48 hours.",
      });
      setFormData({ name: '', email: '', transactionId: '', reason: '' });
      setIsOpen(false);
    } catch (error) {
      console.error('Error submitting refund request:', error);
      toast({
        title: "Failed to submit request",
        description: "Please try again or email us directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container-width flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <FileCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg">PlagaiScans</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container-width px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-display font-bold mb-4">Refund Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

          {/* Key Refund Notice */}
          <Card className="mb-8 border-primary/30 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Shield className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h2 className="text-xl font-bold mb-2">14-Day Money Back Guarantee</h2>
                  <p className="text-muted-foreground">
                    All purchases made through PlagaiScans are eligible for a full refund within 14 days of purchase. 
                    Refunds are processed to your original payment method.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">1. Refund Period</h2>
                <p className="text-muted-foreground">
                  You may request a full refund within <strong>14 days</strong> of your purchase date. 
                  This applies to all credit packages purchased through our platform.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">2. How to Request a Refund</h2>
                <p className="text-muted-foreground mb-4">
                  To request a refund, simply contact us at <strong>support@plagaiscans.com</strong> with:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Your account email address</li>
                  <li>The order or transaction reference</li>
                  <li>Date of purchase</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">3. Refund Processing</h2>
                <p className="text-muted-foreground">
                  Approved refunds are processed to your original payment method. Processing times vary 
                  depending on your payment provider:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                  <li>Credit/Debit Card: 5-10 business days</li>
                  <li>PayPal: 3-5 business days</li>
                  <li>Other payment methods: Up to 14 business days</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">4. Merchant of Record</h2>
                <p className="text-muted-foreground">
                  Paddle.com acts as the Merchant of Record for all purchases. When you make a purchase, 
                  your payment is processed by Paddle, who handles all payment processing, invoicing, 
                  and tax compliance on our behalf.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">5. Subscription Cancellation</h2>
                <p className="text-muted-foreground">
                  If you have an active subscription, you may cancel at any time. Upon cancellation:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                  <li>Your subscription will remain active until the end of your current billing period</li>
                  <li>No further charges will be made</li>
                  <li>You may request a refund within 14 days of your most recent payment</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">6. Credit Validity</h2>
                <p className="text-muted-foreground">
                  Purchased credits do not expire and will remain in your account until used.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4">7. Contact Us</h2>
                <p className="text-muted-foreground">
                  For refund requests or questions about this policy, please contact us:
                </p>
                <p className="text-muted-foreground mt-4">
                  <strong>Email:</strong> support@plagaiscans.com<br />
                  <strong>Trading Name:</strong> PlagaiScans<br />
                  <strong>Legal Entity:</strong> Goldfeather Prem Ltd<br />
                  <strong>Country:</strong> United Kingdom
                </p>
                <p className="text-muted-foreground mt-4">
                  We aim to respond to all refund requests within 24-48 hours during business days.
                </p>
              </section>
            </CardContent>
          </Card>

          {/* Quick Contact Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg">Need a Refund?</h3>
                <p className="text-muted-foreground text-sm">Contact us within 14 days of purchase</p>
              </div>
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Mail className="h-4 w-4 mr-2" />
                    Request Refund
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Request a Refund</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div>
                      <label htmlFor="refund-name" className="text-sm font-medium mb-1.5 block">
                        Your Name *
                      </label>
                      <Input
                        id="refund-name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="refund-email" className="text-sm font-medium mb-1.5 block">
                        Email Address *
                      </label>
                      <Input
                        id="refund-email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="john@example.com"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="refund-transaction" className="text-sm font-medium mb-1.5 block">
                        Transaction/Order ID
                      </label>
                      <Input
                        id="refund-transaction"
                        value={formData.transactionId}
                        onChange={(e) => setFormData({ ...formData, transactionId: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label htmlFor="refund-reason" className="text-sm font-medium mb-1.5 block">
                        Reason for Refund *
                      </label>
                      <Textarea
                        id="refund-reason"
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        placeholder="Please explain why you're requesting a refund..."
                        className="min-h-[100px]"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Refund Request'
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}