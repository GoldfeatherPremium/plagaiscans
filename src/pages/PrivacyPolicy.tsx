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
            <p className="text-muted-foreground mb-8">Last updated: February 2025</p>

            <Card>
              <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">1. Data Controller</h2>
                  <p className="text-muted-foreground">
                    <strong>Plagaiscans Technologies Ltd</strong> (United Kingdom, Company No. 16998013), operating as Plagaiscans, 
                    is the data controller responsible for your personal data. This privacy policy 
                    explains how we collect, use, and protect your information.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">2. Information We Collect</h2>
                  <p className="text-muted-foreground mb-4">We collect the following types of information:</p>
                  
                  <h3 className="text-xl font-semibold mt-4 mb-2">Account Information</h3>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Email address (required for account creation)</li>
                    <li>Full name (optional)</li>
                    <li>Phone number (optional)</li>
                    <li>Password (encrypted)</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-4 mb-2">Document Data</h3>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Uploaded document files for analysis</li>
                    <li>Document metadata (file name, size, upload time)</li>
                    <li>Analysis results and reports</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-4 mb-2">Payment Information</h3>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Transaction IDs and payment references</li>
                    <li>Payment method used (we do not store full card details)</li>
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
                  <h2 className="text-2xl font-bold mb-4">3. Data Handling and Privacy</h2>
                  <p className="text-muted-foreground mb-4">
                    <strong>How Your Content Is Processed:</strong>
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>User-submitted content is processed solely to deliver analysis results</li>
                    <li>Content is not sold or shared with third parties</li>
                    <li>Data retention is limited to operational requirements</li>
                    <li>Users may request data deletion at any time</li>
                  </ul>
                  
                  <p className="text-muted-foreground mt-4 mb-4">
                    <strong>Document Retention:</strong>
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Documents may be retained for up to 30 days after processing unless deleted earlier by the user</li>
                    <li>Users may delete their documents at any time after processing</li>
                    <li>Deletion removes the document and associated reports from our systems</li>
                  </ul>

                  <p className="text-muted-foreground mt-4 mb-4">
                    <strong>Third-Party Disclosure:</strong>
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Documents are NOT shared with other users</li>
                    <li>Documents are NOT added to any public database</li>
                    <li>Analysis may use third-party APIs (no document storage by third parties)</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">4. How We Use Your Information</h2>
                  <p className="text-muted-foreground mb-4">We use your information to:</p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Provide and maintain our text analysis services</li>
                    <li>Process your transactions and manage your account</li>
                    <li>Manage credit balances and validity periods</li>
                    <li>Send service-related notifications</li>
                    <li>Respond to your inquiries and provide customer support</li>
                    <li>Improve our services</li>
                    <li>Detect and prevent fraud or unauthorized access</li>
                    <li>Comply with legal obligations</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">5. Payment Processing</h2>
                  <p className="text-muted-foreground mb-4">
                    Payments are processed by third-party payment processors including:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Stripe (card payments)</li>
                    <li>PayPal</li>
                    <li>Airwallex</li>
                    <li>Other providers as indicated at checkout</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    These processors handle payment information directly. We do not store complete 
                    payment card details on our servers.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">6. Data Security</h2>
                  <p className="text-muted-foreground mb-4">
                    We implement appropriate technical and organizational measures to protect your data:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Encryption of data in transit (HTTPS/TLS)</li>
                    <li>Secure cloud infrastructure with access controls</li>
                    <li>Regular security assessments</li>
                    <li>Employee training on data protection</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Plagaiscans follows applicable data protection standards.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">7. Data Retention</h2>
                  <p className="text-muted-foreground">
                    We retain your data for as long as necessary to provide our services and comply with 
                    legal obligations:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li><strong>Account data:</strong> Retained until account deletion request</li>
                    <li><strong>Document data:</strong> Retained until user deletion or 30 days after processing</li>
                    <li><strong>Transaction records:</strong> Retained as required by law (typically 7 years)</li>
                    <li><strong>Analysis reports:</strong> Retained until user deletion</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">8. Your Rights (GDPR)</h2>
                  <p className="text-muted-foreground mb-4">
                    Under data protection laws, you have the following rights:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li><strong>Right of Access:</strong> Request a copy of your personal data</li>
                    <li><strong>Right to Rectification:</strong> Request correction of inaccurate data</li>
                    <li><strong>Right to Erasure:</strong> Request deletion of your data</li>
                    <li><strong>Right to Restrict Processing:</strong> Request limitation of data processing</li>
                    <li><strong>Right to Data Portability:</strong> Request transfer of your data</li>
                    <li><strong>Right to Object:</strong> Object to certain types of processing</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">9. Cookies</h2>
                  <p className="text-muted-foreground">
                    We use essential cookies to maintain your session and provide core functionality. 
                    We may also use analytics cookies to understand how users interact with our service. 
                    You can control cookie preferences through your browser settings.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">10. International Transfers</h2>
                  <p className="text-muted-foreground">
                    Your data may be transferred to and processed in countries outside your country of 
                    residence. We ensure appropriate safeguards are in place for such transfers in 
                    compliance with applicable data protection laws.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">11. Changes to This Policy</h2>
                  <p className="text-muted-foreground">
                    We may update this Privacy Policy from time to time. We will notify you of significant 
                    changes by posting the new policy on our website and updating the "Last updated" date.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">12. Contact Us</h2>
                  <p className="text-muted-foreground">
                    For questions about this Privacy Policy or to exercise your rights, please contact us at:
                  </p>
                  <p className="text-muted-foreground mt-4">
                    <strong>Email:</strong> support@plagaiscans.com<br />
                    <strong>Billing:</strong> billing@plagaiscans.com<br />
                    <strong>Data Controller:</strong> Plagaiscans Technologies Ltd<br />
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