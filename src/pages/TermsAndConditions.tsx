import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileCheck, ArrowLeft, AlertTriangle } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';

export default function TermsAndConditions() {
  return (
    <>
      <SEO
        title="Terms of Service"
        description="Terms of Service for Plagaiscans text similarity and originality analysis platform. Read our service agreement and user responsibilities."
        keywords="terms of service, service agreement, user agreement"
        canonicalUrl="/terms-and-conditions"
        structuredData={generateWebPageSchema('Terms of Service', 'Service agreement and user responsibilities', '/terms-and-conditions')}
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
            <h1 className="text-4xl font-display font-bold mb-4">Terms of Service</h1>
            <p className="text-muted-foreground mb-8">Last updated: February 2025</p>

            {/* Important Service Disclaimer */}
            <Alert className="mb-8 border-amber-500/30 bg-amber-500/5">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <AlertDescription>
                <h2 className="text-lg font-bold mb-3 text-foreground">IMPORTANT SERVICE DISCLAIMER</h2>
                <p className="text-muted-foreground mb-4">
                  This service is provided for <strong>INFORMATIONAL PURPOSES ONLY</strong>. Plagaiscans:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                  <li>Does NOT guarantee the accuracy, completeness, or reliability of any report</li>
                  <li>Does NOT verify, approve, or certify content for academic or professional purposes</li>
                  <li>Does NOT provide any guarantee of institutional acceptance</li>
                  <li>Does NOT make academic, legal, employment, or disciplinary determinations</li>
                  <li>Does NOT constitute legal, academic, or professional advice</li>
                </ul>
                <p className="text-muted-foreground mb-4">
                  <strong>Users acknowledge that:</strong>
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>All reports are advisory indicators only</li>
                  <li>Final responsibility for content review lies with the user</li>
                  <li>Results depend on currently indexed sources and may not be exhaustive</li>
                  <li>No warranty is made regarding detection accuracy</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Card>
              <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
                  <p className="text-muted-foreground">
                    Welcome to Plagaiscans. These Terms of Service govern your use of our website 
                    and services. By accessing or using our services, you agree to be bound by these terms.
                  </p>
                  <p className="text-muted-foreground mt-4">
                    These services are provided by <strong>Plagaiscans Technologies Ltd</strong> (United Kingdom, Company No. 16998013), 
                    operating under the brand name <strong>Plagaiscans</strong>.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">2. Description of Services</h2>
                  <p className="text-muted-foreground">
                    Plagaiscans is a subscription-based software-as-a-service (SaaS) platform that provides 
                    text similarity and originality analysis. The service is designed to assist editors, 
                    educators, publishers, and content teams in reviewing written material.
                  </p>
                  <p className="text-muted-foreground mt-4">
                    The platform analyzes user-submitted text and generates reports indicating:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Text similarity patterns</li>
                    <li>Overlap indicators</li>
                    <li>Stylistic and structural signals</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    All outputs are advisory indicators intended to support human review and decision-making.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">3. Intended Use</h2>
                  <p className="text-muted-foreground mb-4">Plagaiscans is intended for:</p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Editorial review processes</li>
                    <li>Publishing and content quality checks</li>
                    <li>Internal documentation review</li>
                    <li>Writing improvement and training purposes</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    The service is not intended to be used as the sole basis for academic grading, 
                    disciplinary action, or enforcement decisions.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">4. Prohibited Uses</h2>
                  <p className="text-muted-foreground mb-4">Users may NOT use this service for:</p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Academic cheating or misconduct</li>
                    <li>Circumventing institutional review systems</li>
                    <li>Misrepresentation or deception</li>
                    <li>Submitting reports as official certification</li>
                    <li>Submitting content that infringes on copyrights or intellectual property rights</li>
                    <li>Uploading malicious files, viruses, or harmful code</li>
                    <li>Attempting to circumvent or manipulate our systems</li>
                    <li>Using the service for any illegal purposes</li>
                    <li>Sharing or reselling access to your account</li>
                    <li>Creating multiple accounts to abuse promotional offers</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    <strong>Accounts engaging in prohibited use may be suspended or terminated without refund.</strong>
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">5. User Accounts and Responsibilities</h2>
                  <p className="text-muted-foreground">Users are responsible for:</p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Maintaining the confidentiality of their account credentials</li>
                    <li>All activities that occur under their account</li>
                    <li>Ensuring that submitted documents do not violate any third-party rights</li>
                    <li>Using the service in compliance with applicable laws and regulations</li>
                    <li>Reviewing and interpreting all report findings</li>
                    <li>Managing their credit balance and understanding expiration terms</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">6. Pricing and Billing</h2>
                  <p className="text-muted-foreground">
                    Plagaiscans operates on a prepaid subscription model:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Plans may include usage limits and feature restrictions as described at the time of purchase</li>
                    <li>Pricing is displayed clearly before checkout</li>
                    <li>One (1) credit is required per document submission</li>
                    <li>Credits are deducted at the time of document submission</li>
                    <li>Credits cannot be transferred between accounts</li>
                    <li>Credit packages have defined validity periods as stated at purchase</li>
                    <li>Expired credits cannot be restored or refunded</li>
                    <li>You will receive notifications before credits expire</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">7. Refund Policy</h2>
                  <p className="text-muted-foreground mb-4">
                    Refund eligibility:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li><strong>Monthly subscriptions:</strong> Refund requests accepted within 7 days of purchase if usage is minimal</li>
                    <li><strong>Annual subscriptions:</strong> Prorated refunds accepted within 14 days</li>
                    <li><strong>No refunds</strong> for accounts suspended due to policy violations</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Refund requests must be submitted via email to support@plagaiscans.com.
                  </p>
                  <p className="text-muted-foreground mt-4">
                    For full details, please refer to our <Link to="/refund-policy" className="text-primary hover:underline">Refund Policy</Link>.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">8. Account Suspension and Termination</h2>
                  <p className="text-muted-foreground">
                    We reserve the right to suspend or terminate accounts that:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Violate these Terms of Service</li>
                    <li>Engage in fraudulent or abusive behavior</li>
                    <li>Abuse promotional codes or referral programs</li>
                    <li>Initiate unauthorized chargebacks</li>
                    <li>Attempt to exploit or harm our platform</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Upon termination, unused credits will be forfeited.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">9. Accuracy Disclaimer</h2>
                  <p className="text-muted-foreground">
                    Language analysis is probabilistic and dependent on multiple variables including writing style, 
                    available reference material, and context. Results may vary and should be interpreted cautiously.
                  </p>
                  <p className="text-muted-foreground mt-4">
                    <strong>Plagaiscans makes no guarantees regarding detection accuracy, completeness, or outcomes.</strong>
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">10. Limitation of Liability</h2>
                  <p className="text-muted-foreground">
                    Plagaiscans and Plagaiscans Technologies Ltd provide services on an "as is" basis. We make 
                    no warranties, express or implied, regarding:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>The accuracy or completeness of analysis results</li>
                    <li>Uninterrupted or error-free service availability</li>
                    <li>Fitness for any particular purpose</li>
                    <li>Detection of all potential text overlaps</li>
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
                    The Plagaiscans platform, including its design, features, and technology, is owned by 
                    Plagaiscans Technologies Ltd and protected by intellectual property laws.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">12. Governing Law</h2>
                  <p className="text-muted-foreground">
                    These Terms of Service are governed by and construed in accordance with the laws 
                    of the United Kingdom. Any disputes shall be resolved in the courts of the United Kingdom.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">13. Changes to Terms</h2>
                  <p className="text-muted-foreground">
                    We reserve the right to modify these Terms of Service at any time. Continued use 
                    of the service after changes constitutes acceptance of the new terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">14. Contact Information</h2>
                  <p className="text-muted-foreground">
                    For questions about these Terms of Service, please contact us at:
                  </p>
                  <p className="text-muted-foreground mt-4">
                    <strong>Email:</strong> support@plagaiscans.com<br />
                    <strong>Billing:</strong> billing@plagaiscans.com<br />
                    <strong>Company:</strong> Plagaiscans Technologies Ltd<br />
                    <strong>Registration:</strong> 16998013<br />
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