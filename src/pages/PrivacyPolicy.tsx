import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileCheck, ArrowLeft } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';

export default function PrivacyPolicy() {
  return (
    <>
      <SEO
        title="Privacy Policy"
        description="Learn how Plagaiscans collects, uses, and protects your personal data. GDPR compliant privacy policy."
        keywords="privacy policy, data protection, GDPR, document privacy"
        canonicalUrl="/privacy-policy"
        structuredData={generateWebPageSchema('Privacy Policy', 'How we protect your data', '/privacy-policy')}
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
            <h1 className="text-4xl font-display font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground mb-8">Last updated: February 2026</p>

            <Card>
              <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">1. Data Controller</h2>
                  <p className="text-muted-foreground">
                    <strong>Plagaiscans Technologies Ltd</strong> (Company No. 16998013), registered in the United Kingdom, 
                    operating as Plagaiscans, is the data controller responsible for your personal data. This Privacy Policy 
                    explains how we collect, use, store, and protect your information when you use our services.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">2. What Data We Collect</h2>
                  
                  <h3 className="text-xl font-semibold mt-4 mb-2">Account Information</h3>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Email address (required for account creation)</li>
                    <li>Full name (optional)</li>
                    <li>Phone number (optional)</li>
                    <li>Password (stored in encrypted form)</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-4 mb-2">Document Data</h3>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Uploaded document files submitted for analysis</li>
                    <li>Document metadata (file name, size, upload time)</li>
                    <li>Analysis results and generated reports</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-4 mb-2">Payment Information</h3>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Transaction IDs and payment references</li>
                    <li>Payment method type (we do not store full card details)</li>
                    <li>Purchase history and credit balance</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-4 mb-2">Technical Information</h3>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>IP address</li>
                    <li>Browser type and version</li>
                    <li>Device information</li>
                    <li>Usage data and analytics</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">3. How Data Is Used</h2>
                  <p className="text-muted-foreground mb-4">We use your information to:</p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Provide and maintain our text analysis and content detection services</li>
                    <li>Process your transactions and manage your account</li>
                    <li>Manage credit balances and validity periods</li>
                    <li>Send service-related notifications and updates</li>
                    <li>Respond to your inquiries and provide customer support</li>
                    <li>Improve our services and develop new features</li>
                    <li>Detect and prevent fraud or unauthorized access</li>
                    <li>Comply with legal obligations</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">4. Cookies & Tracking</h2>
                  <p className="text-muted-foreground">
                    We use essential cookies to maintain your session and provide core functionality. We may also use 
                    analytics cookies to understand how users interact with our service. You can control cookie preferences 
                    through your browser settings.
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li><strong>Essential cookies:</strong> Required for authentication, session management, and core features</li>
                    <li><strong>Analytics cookies:</strong> Help us understand usage patterns and improve the service</li>
                    <li><strong>Preference cookies:</strong> Remember your settings such as language and theme</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">5. Payment Processing</h2>
                  <p className="text-muted-foreground">
                    All payments are processed by <strong>Paddle</strong>, which acts as the Merchant of Record for all transactions. 
                    Paddle handles payment information directly and securely. We do not store complete payment card details on our servers. 
                    For more information, please refer to Paddle's privacy policy.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">6. Data Retention</h2>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li><strong>Account data:</strong> Retained until you request account deletion</li>
                    <li><strong>Document data:</strong> Retained until user-initiated deletion or up to 30 days after processing</li>
                    <li><strong>Transaction records:</strong> Retained as required by law (typically 7 years)</li>
                    <li><strong>Analysis reports:</strong> Retained until user deletion</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Uploaded documents are processed temporarily for analysis. Files are not sold, shared with third parties, 
                    or used for any purpose beyond delivering our service. <strong>We do not train AI models on your content 
                    without your explicit consent.</strong>
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">7. User Rights (GDPR)</h2>
                  <p className="text-muted-foreground mb-4">
                    Under data protection laws, you have the following rights:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li><strong>Right of Access:</strong> Request a copy of your personal data</li>
                    <li><strong>Right to Rectification:</strong> Request correction of inaccurate data</li>
                    <li><strong>Right to Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
                    <li><strong>Right to Restrict Processing:</strong> Request limitation of how we process your data</li>
                    <li><strong>Right to Data Portability:</strong> Request transfer of your data in a machine-readable format</li>
                    <li><strong>Right to Object:</strong> Object to certain types of data processing</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    To exercise any of these rights, please contact us at support@plagaiscans.com. We will respond within 
                    30 days as required by GDPR.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">8. GDPR Compliance</h2>
                  <p className="text-muted-foreground">
                    Plagaiscans Technologies Ltd is committed to complying with the UK General Data Protection Regulation 
                    (UK GDPR) and the Data Protection Act 2018. We process personal data only when we have a lawful basis 
                    to do so, including:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li><strong>Contract:</strong> Processing necessary to fulfil our service agreement with you</li>
                    <li><strong>Legitimate interest:</strong> Improving our services, preventing fraud</li>
                    <li><strong>Consent:</strong> When you opt in to marketing communications</li>
                    <li><strong>Legal obligation:</strong> Compliance with applicable laws</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">9. Security Measures</h2>
                  <p className="text-muted-foreground mb-4">
                    We implement appropriate technical and organisational measures to protect your data:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Encryption of data in transit (HTTPS/TLS)</li>
                    <li>Secure cloud infrastructure with access controls</li>
                    <li>Regular security assessments and monitoring</li>
                    <li>Employee training on data protection practices</li>
                    <li>Row-level security policies on all database tables</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">10. International Transfers</h2>
                  <p className="text-muted-foreground">
                    Your data may be transferred to and processed in countries outside your country of residence. We ensure 
                    appropriate safeguards are in place for such transfers in compliance with applicable data protection laws.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">11. Changes to This Policy</h2>
                  <p className="text-muted-foreground">
                    We may update this Privacy Policy from time to time. We will notify you of significant changes by posting 
                    the updated policy on our website and updating the "Last updated" date. Continued use of the service after 
                    changes constitutes acceptance.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">12. Contact Us</h2>
                  <p className="text-muted-foreground">
                    For questions about this Privacy Policy or to exercise your data rights, please contact us at:
                  </p>
                  <p className="text-muted-foreground mt-4">
                    <strong>Email:</strong> support@plagaiscans.com<br />
                    <strong>Billing:</strong> billing@plagaiscans.com<br />
                    <strong>Data Controller:</strong> Plagaiscans Technologies Ltd<br />
                    <strong>Company No:</strong> 16998013<br />
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
