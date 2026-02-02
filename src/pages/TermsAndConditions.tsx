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
        title="Terms and Conditions"
        description="Terms and conditions for using PlagaiScans document analysis services. Read our service agreement and user responsibilities."
        keywords="terms and conditions, service agreement, user agreement"
        canonicalUrl="/terms-and-conditions"
        structuredData={generateWebPageSchema('Terms and Conditions', 'Service agreement and user responsibilities', '/terms-and-conditions')}
      />
      <div className="min-h-screen bg-background">
        <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container-width flex h-16 items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
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
            <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

            {/* Important Service Disclaimer */}
            <Alert className="mb-8 border-amber-500/30 bg-amber-500/5">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <AlertDescription>
                <h2 className="text-lg font-bold mb-3 text-foreground">IMPORTANT SERVICE DISCLAIMER</h2>
                <p className="text-muted-foreground mb-4">
                  This service is provided for <strong>INFORMATIONAL PURPOSES ONLY</strong>. PlagaiScans:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                  <li>Does NOT guarantee the accuracy, completeness, or reliability of any report</li>
                  <li>Does NOT verify, approve, or certify content for academic or professional purposes</li>
                  <li>Does NOT provide any guarantee of institutional acceptance</li>
                  <li>Is NOT affiliated with or endorsed by any educational institution</li>
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
                    Welcome to PlagaiScans. These Terms and Conditions govern your use of our website 
                    and services. By accessing or using our services, you agree to be bound by these terms.
                  </p>
                  <p className="text-muted-foreground mt-4">
                    These services are provided by <strong>Plagaiscans Technologies Ltd</strong> (United Kingdom, Company No. 16998013), 
                    operating under the brand name <strong>PlagaiScans</strong>.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">2. Description of Services</h2>
                  <p className="text-muted-foreground">
                    PlagaiScans provides text similarity checking and content analysis services. 
                    We compare submitted documents against indexed sources to generate similarity indicators. 
                    This is a reference tool intended to support, not replace, human review.
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Document comparison against indexed web and academic sources</li>
                    <li>Content analysis indicators</li>
                    <li>PDF reports showing matched segments and source references</li>
                    <li>Secure document processing</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Results should be used as guidance and not as definitive proof of originality or plagiarism.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">3. Prohibited Uses</h2>
                  <p className="text-muted-foreground mb-4">Users may NOT use this service to:</p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Facilitate academic misconduct or plagiarism</li>
                    <li>Represent reports as institutional approvals or certifications</li>
                    <li>Circumvent academic integrity requirements</li>
                    <li>Misrepresent report findings to third parties</li>
                    <li>Submit content that infringes on copyrights or intellectual property rights</li>
                    <li>Upload malicious files, viruses, or harmful code</li>
                    <li>Attempt to circumvent or manipulate our systems</li>
                    <li>Use the service for any illegal purposes</li>
                    <li>Share or resell access to your account</li>
                    <li>Create multiple accounts to abuse promotional offers</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">4. User Accounts and Responsibilities</h2>
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
                  <h2 className="text-2xl font-bold mb-4">5. Credits, Pricing, and Validity</h2>
                  <p className="text-muted-foreground">
                    Our services operate on a credit-based system:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>One (1) credit is required per document submission</li>
                    <li>Credits are deducted at the time of document submission</li>
                    <li>Credits cannot be transferred between accounts</li>
                    <li>Credit packages have defined validity periods as stated at purchase</li>
                    <li>Expired credits cannot be restored or refunded</li>
                    <li>You will receive notifications before credits expire</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">6. Refund Policy</h2>
                  <p className="text-muted-foreground">
                    All refund requests are reviewed by our team on a case-by-case basis.
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Refunds may be considered within 14 days of purchase if credits are unused</li>
                    <li>Each refund request is evaluated individually</li>
                    <li>Expired credits are not eligible for refunds</li>
                    <li>Used credits (even partially) are not eligible for refunds</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    For full details, please refer to our <Link to="/refund-policy" className="text-primary hover:underline">Refund Policy</Link>.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">7. Account Suspension and Termination</h2>
                  <p className="text-muted-foreground">
                    We reserve the right to suspend or terminate accounts that:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Violate these Terms and Conditions</li>
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
                  <h2 className="text-2xl font-bold mb-4">8. Limitation of Liability</h2>
                  <p className="text-muted-foreground">
                    PlagaiScans and Plagaiscans Technologies Ltd provide services on an "as is" basis. We make 
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
                  <h2 className="text-2xl font-bold mb-4">9. Intellectual Property</h2>
                  <p className="text-muted-foreground">
                    You retain ownership of documents you submit. By submitting documents, you grant us a 
                    limited license to process and analyze them for the purpose of providing our services.
                  </p>
                  <p className="text-muted-foreground mt-4">
                    The PlagaiScans platform, including its design, features, and technology, is owned by 
                    Plagaiscans Technologies Ltd and protected by intellectual property laws.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">10. Governing Law</h2>
                  <p className="text-muted-foreground">
                    These Terms and Conditions are governed by and construed in accordance with the laws 
                    of the United Kingdom. Any disputes shall be resolved in the courts of the United Kingdom.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">11. Changes to Terms</h2>
                  <p className="text-muted-foreground">
                    We reserve the right to modify these Terms and Conditions at any time. Continued use 
                    of the service after changes constitutes acceptance of the new terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">12. Contact Information</h2>
                  <p className="text-muted-foreground">
                    For questions about these Terms and Conditions, please contact us at:
                  </p>
                  <p className="text-muted-foreground mt-4">
                    <strong>Email:</strong> support@plagaiscans.com<br />
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
