import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileCheck, ArrowLeft, Mail, Shield, Loader2, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SEO, generateWebPageSchema } from '@/components/SEO';

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
    <>
      <SEO
        title="Refund Policy"
        description="Learn about our refund policy. All refund requests are reviewed by our admin team on a case-by-case basis."
        keywords="refund policy, credit refunds, plagiarism checker refund, admin-managed refunds"
        canonicalUrl="/refund-policy"
        structuredData={generateWebPageSchema('Refund Policy', 'Our refund and cancellation policy', '/refund-policy')}
      />
      <div className="min-h-screen bg-background">
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

        <main className="container-width px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-display font-bold mb-4">Refund Policy</h1>
            <p className="text-muted-foreground mb-8">Last updated: December 2024</p>


            {/* 14-Day Refund Window Notice */}
            <Card className="mb-8 border-green-500/30 bg-green-500/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Calendar className="h-8 w-8 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                  <div>
                    <h2 className="text-xl font-bold mb-2">14-Day Refund Window</h2>
                    <p className="text-muted-foreground mb-3">
                      We offer a <strong>14-day refund window</strong> from the date of purchase. If you haven't used any of your purchased credits within this period, you're eligible to request a full refund.
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        Request must be made within 14 days of purchase
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        Credits must be unused (0 credits consumed)
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        Full refund to your original payment method
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Admin-Managed Refunds Notice */}
            <Card className="mb-8 border-primary/30 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Shield className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h2 className="text-xl font-bold mb-2">Admin Review Process</h2>
                    <p className="text-muted-foreground mb-3">
                      All refund requests are personally reviewed by our admin team to ensure fair and consistent handling. Here's what to expect:
                    </p>
                    <div className="grid sm:grid-cols-3 gap-4 mt-4">
                      <div className="text-center p-3 bg-background/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">1</div>
                        <div className="text-sm text-muted-foreground">Submit your request</div>
                      </div>
                      <div className="text-center p-3 bg-background/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">2</div>
                        <div className="text-sm text-muted-foreground">Admin reviews within 24-48hrs</div>
                      </div>
                      <div className="text-center p-3 bg-background/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">3</div>
                        <div className="text-sm text-muted-foreground">Decision sent via email</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-8">
              <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">1. Credit Purchase Policy</h2>
                  <p className="text-muted-foreground mb-4">
                    By purchasing credits on PlagaiScans, you acknowledge and agree that:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Credits cannot be transferred to other accounts</li>
                    <li>Credits cannot be exchanged for cash or other payment methods</li>
                    <li>Unused credits may expire based on your package terms</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">2. Refund Eligibility</h2>
                  <p className="text-muted-foreground mb-4">
                    You are eligible for a refund in the following situations:
                  </p>
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                    <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">✓ Eligible for Refund</h3>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li><strong>14-day window:</strong> Request made within 14 days of purchase with no credits used</li>
                      <li><strong>Technical errors:</strong> System failures that prevented service delivery</li>
                      <li><strong>Duplicate charges:</strong> You were accidentally charged twice for the same purchase</li>
                      <li><strong>Service outages:</strong> Extended unavailability that affected your ability to use credits</li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 border border-border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">× Not Eligible for Refund</h3>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li>Credits have already been used (even partially)</li>
                      <li>Request made after 14 days from purchase date</li>
                      <li>Change of mind or no longer needing credits</li>
                      <li>Expired credits (use them before they expire!)</li>
                    </ul>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">3. Refund Request Process</h2>
                  <p className="text-muted-foreground mb-4">
                    To request a refund review, submit a request with:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Your account email address</li>
                    <li>Transaction or order reference number</li>
                    <li>Date of purchase</li>
                    <li>Detailed reason for the refund request</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Our admin team will review your request and respond within 24-48 business hours.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">4. Refund Processing</h2>
                  <p className="text-muted-foreground mb-4">
                    If your refund is approved by our admin team:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Credit/Debit Card: 5-10 business days</li>
                    <li>Bank Transfer: 7-14 business days</li>
                    <li>Cryptocurrency: Case-by-case basis (may not be available)</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Processing times depend on your financial institution and payment method.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">5. Subscription Cancellation</h2>
                  <p className="text-muted-foreground mb-4">
                    For subscription plans:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>You may cancel your subscription at any time</li>
                    <li>Subscription remains active until the end of the current billing period</li>
                    <li>No prorated refunds for partial billing periods</li>
                    <li>Unused subscription credits expire when the subscription ends</li>
                    <li>You may request a review within 14 days of renewal if you forgot to cancel</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">6. Credit Expiration</h2>
                  <p className="text-muted-foreground mb-4">
                    Credit validity varies by package:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li><strong>One-time packages:</strong> Credits expire after the specified validity period (30, 60, or 90 days)</li>
                    <li><strong>Subscription credits:</strong> Credits are renewed monthly and expire if subscription ends</li>
                    <li>You'll receive notifications before credits expire</li>
                    <li>Expired credits cannot be refunded or restored</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">7. Disputes and Chargebacks</h2>
                  <p className="text-muted-foreground">
                    Before initiating a chargeback with your bank, please contact us first. We're committed to 
                    resolving issues fairly and promptly. Unauthorized chargebacks may result in account suspension 
                    and collection actions for disputed amounts.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">8. Contact Us</h2>
                  <p className="text-muted-foreground">
                    For refund inquiries or to submit a refund request:
                  </p>
                  <p className="text-muted-foreground mt-4">
                    <strong>Email:</strong> support@plagaiscans.com<br />
                    <strong>Response Time:</strong> 24-48 business hours<br />
                    <strong>Trading Name:</strong> PlagaiScans<br />
                    <strong>Legal Entity:</strong> Goldfeather Prem Ltd<br />
                    <strong>Country:</strong> United Kingdom
                  </p>
                </section>
              </CardContent>
            </Card>

            {/* Quick Contact Card */}
            <Card className="bg-muted/30 border-border">
              <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <h3 className="font-bold text-lg">Need to Request a Review?</h3>
                    <p className="text-muted-foreground text-sm">Our admin team will review your case within 24-48 hours</p>
                  </div>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Mail className="h-4 w-4 mr-2" />
                      Submit Request
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Request Refund Review</DialogTitle>
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
                          placeholder="Optional but helpful"
                        />
                      </div>
                      <div>
                        <label htmlFor="refund-reason" className="text-sm font-medium mb-1.5 block">
                          Reason for Request *
                        </label>
                        <Textarea
                          id="refund-reason"
                          value={formData.reason}
                          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                          placeholder="Please explain your situation in detail..."
                          className="min-h-[100px]"
                          required
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Note: Submitting a request does not guarantee approval. Each case is reviewed individually by our admin team.
                      </p>
                      <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          'Submit for Review'
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
    </>
  );
}
