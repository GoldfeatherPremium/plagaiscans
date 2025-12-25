import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileCheck, ArrowLeft, Mail } from 'lucide-react';
import Footer from '@/components/Footer';

export default function RefundPolicy() {
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
          <h1 className="text-4xl font-display font-bold mb-4">Refund & Cancellation Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

          <Card className="mb-8">
            <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">1. Credit-Based System</h2>
                <p className="text-muted-foreground">
                  PlagaiScans operates on a credit-based payment system. Credits are purchased in advance 
                  and used to process document submissions. Each document submission requires one (1) credit.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">2. Refund Eligibility</h2>
                
                <h3 className="text-xl font-semibold mt-4 mb-2">Non-Refundable Situations</h3>
                <p className="text-muted-foreground mb-4">
                  Digital credits are generally <strong>non-refundable once used</strong>. This includes:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Credits that have been consumed for document processing</li>
                  <li>Credits purchased more than 30 days ago (unused)</li>
                  <li>Change of mind after purchase</li>
                  <li>Dissatisfaction with analysis results (as results are based on objective analysis)</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-2">Refundable Situations</h3>
                <p className="text-muted-foreground mb-4">
                  We will provide refunds in the following circumstances:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>Duplicate Charges:</strong> If you were charged multiple times for the same purchase</li>
                  <li><strong>Technical Failure:</strong> If our system fails to process your document and no report is generated</li>
                  <li><strong>Service Unavailability:</strong> If the service is unavailable for an extended period preventing credit use</li>
                  <li><strong>Unauthorized Charges:</strong> If someone made a purchase on your account without authorization</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">3. How to Request a Refund</h2>
                <p className="text-muted-foreground mb-4">
                  To request a refund, please follow these steps:
                </p>
                <ol className="list-decimal pl-6 text-muted-foreground space-y-2">
                  <li>Email us at <strong>support@plagaiscans.com</strong></li>
                  <li>Include your account email address</li>
                  <li>Provide the transaction ID or payment reference</li>
                  <li>Explain the reason for your refund request</li>
                  <li>Include any relevant screenshots or documentation</li>
                </ol>
                <p className="text-muted-foreground mt-4">
                  We will review your request within 3-5 business days and respond with our decision.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">4. Refund Processing</h2>
                <p className="text-muted-foreground">
                  Approved refunds will be processed to the original payment method within 5-10 business 
                  days. The time for the refund to appear in your account depends on your payment provider.
                </p>
                <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                  <li>Credit/Debit Card: 5-10 business days</li>
                  <li>Cryptocurrency: Refund in equivalent USDT value at time of original purchase</li>
                  <li>Bank Transfer: 7-14 business days</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">5. Subscription Cancellation</h2>
                <p className="text-muted-foreground mb-4">
                  If you have an active subscription:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>You can cancel your subscription at any time through your account settings</li>
                  <li>Cancellation takes effect at the end of your current billing period</li>
                  <li>You will retain access to your credits until they are used</li>
                  <li>No partial refunds are provided for unused subscription periods</li>
                  <li>Recurring charges will stop after your current period ends</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">6. Credit Expiration</h2>
                <p className="text-muted-foreground">
                  Purchased credits <strong>do not expire</strong> and will remain in your account until 
                  used. However, in the event of account termination due to Terms of Service violations, 
                  unused credits may be forfeited.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">7. Chargebacks</h2>
                <p className="text-muted-foreground">
                  We encourage customers to contact us directly before initiating a chargeback with their 
                  payment provider. Chargebacks may result in account suspension pending investigation. 
                  Fraudulent chargebacks may result in permanent account termination and legal action.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold mb-4">8. Disputes</h2>
                <p className="text-muted-foreground">
                  If you disagree with our refund decision, you may request a review by emailing us with 
                  additional information. We are committed to fair resolution of all disputes.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4">9. Contact Us</h2>
                <p className="text-muted-foreground">
                  For refund requests or questions about this policy, please contact us:
                </p>
                <p className="text-muted-foreground mt-4">
                  <strong>Email:</strong> support@plagaiscans.com<br />
                  <strong>Company:</strong> Goldfeather Prem Ltd<br />
                  <strong>Country:</strong> United Kingdom
                </p>
                <p className="text-muted-foreground mt-4">
                  We aim to respond to all inquiries within 24-48 hours during business days.
                </p>
              </section>
            </CardContent>
          </Card>

          {/* Quick Contact Card */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg">Need Help with a Refund?</h3>
                <p className="text-muted-foreground text-sm">Contact our support team for assistance</p>
              </div>
              <a href="mailto:support@plagaiscans.com">
                <Button>
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Support
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
