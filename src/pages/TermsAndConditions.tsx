import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileCheck, ArrowLeft } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';

export default function TermsAndConditions() {
  return (
    <>
      <SEO
        title="Terms and Conditions"
        description="Terms and conditions for using PlagaiScans plagiarism detection and AI analysis services. Read our service agreement and user responsibilities."
        keywords="terms and conditions, service agreement, user agreement, plagiarism checker terms"
        canonicalUrl="/terms-and-conditions"
        structuredData={generateWebPageSchema('Terms and Conditions', 'Service agreement and user responsibilities', '/terms-and-conditions')}
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
            <h1 className="text-4xl font-display font-bold mb-4">Terms and Conditions</h1>
            <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

            <Card>
              <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
                  <p className="text-muted-foreground">
                    Welcome to PlagaiScans. These Terms and Conditions govern your use of our website 
                    and services. By accessing or using our services, you agree to be bound by these terms.
                  </p>
                  <p className="text-muted-foreground mt-4">
                    These services are provided by <strong>Goldfeather Prem Ltd</strong> (United Kingdom), 
                    operating under the brand name <strong>PlagaiScans</strong>.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">2. Description of Services</h2>
                  <p className="text-muted-foreground">
                    PlagaiScans provides AI-assisted similarity analysis and plagiarism detection services for 
                    documents. Our services include:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Document similarity analysis against academic and web sources</li>
                    <li>AI-generated content detection</li>
                    <li>Detailed PDF reports with analysis results</li>
                    <li>Secure document handling and processing</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Our services are designed for educational purposes and content verification. Results 
                    should be used as guidance and not as definitive legal proof of plagiarism or originality.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">3. User Accounts and Responsibilities</h2>
                  <p className="text-muted-foreground">Users are responsible for:</p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Maintaining the confidentiality of their account credentials</li>
                    <li>All activities that occur under their account</li>
                    <li>Ensuring that submitted documents do not violate any third-party rights</li>
                    <li>Using the service in compliance with applicable laws and regulations</li>
                    <li>Managing their credit balance and understanding expiration terms</li>
                    <li>Keeping their notification preferences up to date</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">4. Credits, Pricing, and Subscriptions</h2>
                  <p className="text-muted-foreground">
                    Our services operate on a credit-based system. Credits can be purchased through:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li><strong>One-time packages:</strong> Credits with a defined validity period (30, 60, or 90 days)</li>
                    <li><strong>Subscription plans:</strong> Monthly recurring credits that renew automatically</li>
                  </ul>
                  
                  <h3 className="text-xl font-semibold mt-6 mb-2">Credit Usage</h3>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>One (1) credit is required per document submission</li>
                    <li>Credits are deducted at the time of document submission</li>
                    <li>Credits cannot be transferred between accounts</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-6 mb-2">Credit Expiration</h3>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>One-time package credits expire after the specified validity period</li>
                    <li>Subscription credits expire when the subscription ends or is cancelled</li>
                    <li>You will receive email and push notifications before credits expire</li>
                    <li>Expired credits cannot be restored or refunded</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-6 mb-2">Subscription Terms</h3>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Subscriptions renew automatically at the start of each billing period</li>
                    <li>You may cancel your subscription at any time</li>
                    <li>Cancellation takes effect at the end of the current billing period</li>
                    <li>No prorated refunds for partial billing periods</li>
                    <li>Unused subscription credits expire when the subscription ends</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">5. Refund Policy</h2>
                  <p className="text-muted-foreground">
                    <strong>Important:</strong> Purchased credits are non-refundable once added to your account.
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>All refund requests are reviewed and managed by our admin team</li>
                    <li>There are no automatic refunds under any circumstances</li>
                    <li>Refunds may be considered within 14 days of purchase if credits are unused</li>
                    <li>Each refund request is evaluated on a case-by-case basis</li>
                    <li>Subscription cancellations do not automatically trigger refunds</li>
                    <li>Expired credits are not eligible for refunds</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    For full details, please refer to our <Link to="/refund-policy" className="text-primary hover:underline">Refund Policy</Link>.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">6. Promo Codes</h2>
                  <p className="text-muted-foreground">
                    Promotional codes may be offered from time to time:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Promo codes may provide bonus credits or percentage discounts</li>
                    <li>Only one promo code can be applied per transaction</li>
                    <li>Promo codes have specific validity periods and usage limits</li>
                    <li>We reserve the right to revoke or modify promo codes at any time</li>
                    <li>Promo codes cannot be combined or applied retroactively</li>
                    <li>Abuse of promo codes may result in account suspension</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">7. Prohibited Uses</h2>
                  <p className="text-muted-foreground">You may not use our services to:</p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Submit content that infringes on copyrights, trademarks, or other intellectual property rights</li>
                    <li>Upload malicious files, viruses, or harmful code</li>
                    <li>Attempt to circumvent or manipulate our detection systems</li>
                    <li>Use the service for any illegal purposes</li>
                    <li>Share or resell access to your account</li>
                    <li>Create multiple accounts to abuse promo codes or free trials</li>
                    <li>Submit content that is defamatory, obscene, or otherwise objectionable</li>
                    <li>Harass, abuse, or harm other users or our staff</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">8. Account Suspension and Termination</h2>
                  <p className="text-muted-foreground">
                    We reserve the right to suspend or terminate accounts that:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Violate these Terms and Conditions</li>
                    <li>Engage in fraudulent or abusive behavior</li>
                    <li>Abuse promo codes or referral programs</li>
                    <li>Initiate unauthorized chargebacks</li>
                    <li>Attempt to exploit or harm our platform or other users</li>
                    <li>Fail to pay for services rendered</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Upon termination, unused credits will be forfeited and are not eligible for refund.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">9. Notifications and Communications</h2>
                  <p className="text-muted-foreground">
                    By using our service, you agree to receive:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Transactional emails (document completion, payment confirmations)</li>
                    <li>Service notifications (credit expiry warnings, subscription reminders)</li>
                    <li>Account security notifications</li>
                    <li>Push notifications (if enabled)</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    You can manage your notification preferences in your account settings. Essential 
                    service and security notifications cannot be disabled.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">10. Limitation of Liability</h2>
                  <p className="text-muted-foreground">
                    PlagaiScans and Goldfeather Prem Ltd provide services on an "as is" basis. We make 
                    no warranties, express or implied, regarding:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>The accuracy or completeness of analysis results</li>
                    <li>Uninterrupted or error-free service availability</li>
                    <li>Fitness for any particular purpose</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Our total liability for any claims arising from your use of the service shall not exceed 
                    the amount you paid for the service in the preceding 12 months.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">11. Intellectual Property</h2>
                  <p className="text-muted-foreground">
                    You retain ownership of documents you submit. By submitting documents, you grant us a 
                    limited license to process and analyze them for the purpose of providing our services.
                  </p>
                  <p className="text-muted-foreground mt-4">
                    The PlagaiScans platform, including its design, features, and technology, is owned by 
                    Goldfeather Prem Ltd and protected by intellectual property laws.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">12. Governing Law</h2>
                  <p className="text-muted-foreground">
                    These Terms and Conditions are governed by and construed in accordance with the laws 
                    of the United Kingdom. Any disputes shall be resolved in the courts of the United Kingdom.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">13. Changes to Terms</h2>
                  <p className="text-muted-foreground">
                    We reserve the right to modify these Terms and Conditions at any time. Continued use 
                    of the service after changes constitutes acceptance of the new terms. We will notify 
                    users of significant changes via email or in-app notification.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">14. Contact Information</h2>
                  <p className="text-muted-foreground">
                    For questions about these Terms and Conditions, please contact us at:
                  </p>
                  <p className="text-muted-foreground mt-4">
                    <strong>Email:</strong> support@plagaiscans.com<br />
                    <strong>Company:</strong> Goldfeather Prem Ltd<br />
                    <strong>Country:</strong> United Kingdom
                  </p>
                </section>
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
