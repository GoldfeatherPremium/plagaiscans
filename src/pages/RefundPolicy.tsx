import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileCheck, ArrowLeft, Mail, Shield, Loader2, Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
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
        description: "We will review your request and respond within 24-48 hours.",
      });
      setFormData({ name: '', email: '', transactionId: '', reason: '' });
      setIsOpen(false);
    } catch (error) {
      console.error('Error submitting refund request:', error);
      toast({
        title: "Failed to submit request",
        description: "Please try again or email us directly at support@plagaiscans.com.",
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
        description="Plagaiscans refund policy. Learn about eligibility, process, and timelines for refund requests."
        keywords="refund policy, credit refunds, cancellation"
        canonicalUrl="/refund-policy"
        structuredData={generateWebPageSchema('Refund Policy', 'Our refund and cancellation policy', '/refund-policy')}
      />
      <div className="min-h-screen bg-background">
        <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container-width flex h-16 items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <FileCheck className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-lg">Plagaiscans</span>
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
            <p className="text-muted-foreground mb-8">Last updated: February 2026</p>

            {/* Service Delivery Statement */}
            <Alert className="mb-8 border-border bg-muted/50">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription>
                <h2 className="text-lg font-bold mb-2 text-foreground">Digital Service — Instant Delivery</h2>
                <p className="text-muted-foreground">
                  Plagaiscans is a digital credit-based service. Credits and access to text analysis services are 
                  delivered instantly upon payment confirmation.
                </p>
              </AlertDescription>
            </Alert>

            {/* Review Process */}
            <Card className="mb-8 border-border">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Shield className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h2 className="text-xl font-bold mb-2">Refund Review Process</h2>
                    <p className="text-muted-foreground mb-3">
                      All refund requests are reviewed by our team to ensure fair handling.
                    </p>
                    <div className="grid sm:grid-cols-3 gap-4 mt-4">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">1</div>
                        <div className="text-sm text-muted-foreground">Submit your request</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">2</div>
                        <div className="text-sm text-muted-foreground">Review within 24-48hrs</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">3</div>
                        <div className="text-sm text-muted-foreground">Decision sent via email</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-8 border-border">
              <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">1. Refund Eligibility</h2>
                  <p className="text-muted-foreground mb-4">
                    Refund requests must be submitted within <strong>7 days</strong> of purchase.
                  </p>
                  <div className="bg-muted/50 border border-border rounded-lg p-4 mb-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Eligible for Refund
                    </h3>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li><strong>Technical failure:</strong> System errors that prevented service delivery</li>
                      <li><strong>Duplicate charge:</strong> You were accidentally charged twice for the same purchase</li>
                      <li><strong>Service not delivered:</strong> Credits were purchased but not applied to your account</li>
                    </ul>
                  </div>
                  <div className="bg-muted/50 border border-border rounded-lg p-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                      Not Eligible for Refund
                    </h3>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li>Credits have been fully used</li>
                      <li>Request made after the 7-day window</li>
                      <li>Change of mind after service has been delivered</li>
                      <li>Expired credits</li>
                      <li>Accounts suspended due to policy violations</li>
                    </ul>
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">2. How to Request a Refund</h2>
                  <p className="text-muted-foreground mb-4">
                    To request a refund, please provide:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Your account email address</li>
                    <li>Transaction or order reference number</li>
                    <li>Date of purchase</li>
                    <li>Reason for the refund request</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Submit your request via email to <strong>support@plagaiscans.com</strong> or use the form below.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">3. Refund Processing</h2>
                  <p className="text-muted-foreground mb-4">
                    If your refund is approved:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Refunds are processed back to your original payment method</li>
                    <li><strong>Paddle</strong> handles all refund processing as the Merchant of Record</li>
                    <li>Processing typically takes 5-10 business days depending on your financial institution</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">4. Disputes and Chargebacks</h2>
                  <p className="text-muted-foreground">
                    Before initiating a chargeback with your bank, please contact us first. We are committed to 
                    resolving issues fairly and promptly. Unauthorized chargebacks may result in account suspension.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">5. Contact Us</h2>
                  <p className="text-muted-foreground">
                    For refund inquiries:
                  </p>
                  <p className="text-muted-foreground mt-4">
                    <strong>Email:</strong> support@plagaiscans.com<br />
                    <strong>Billing:</strong> billing@plagaiscans.com<br />
                    <strong>Response Time:</strong> 24-48 business hours<br />
                    <strong>Legal Entity:</strong> Plagaiscans Technologies Ltd<br />
                    <strong>Country:</strong> United Kingdom
                  </p>
                </section>
              </CardContent>
            </Card>

            {/* Quick Contact Card */}
            <Card className="border-border bg-muted/30">
              <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <h3 className="font-bold text-lg">Need to Request a Refund?</h3>
                    <p className="text-muted-foreground text-sm">Our team will review your case within 24-48 hours</p>
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
                          placeholder="Please explain your situation..."
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
                          'Submit Request'
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
