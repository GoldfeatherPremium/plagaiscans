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
        description="Learn how PlagaiScans collects, uses, and protects your personal data. GDPR compliant privacy policy for our plagiarism detection service."
        keywords="privacy policy, data protection, GDPR, document privacy"
        canonicalUrl="/privacy-policy"
        structuredData={generateWebPageSchema('Privacy Policy', 'How we protect your data', '/privacy-policy')}
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
            <h1 className="text-4xl font-display font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

            <Card>
              <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">1. Data Controller</h2>
                  <p className="text-muted-foreground">
                    <strong>Goldfeather Prem Ltd</strong> (United Kingdom), operating as PlagaiScans, 
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
                    <li>Subscription status and billing dates</li>
                    <li>Promo code usage history</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-4 mb-2">Notification Preferences</h3>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Email notification preferences</li>
                    <li>Push notification subscriptions</li>
                    <li>Communication preferences</li>
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
                  <h2 className="text-2xl font-bold mb-4">3. How We Use Your Information</h2>
                  <p className="text-muted-foreground mb-4">We use your information to:</p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Provide and maintain our document analysis services</li>
                    <li>Process your transactions and manage your account</li>
                    <li>Manage credit balances, subscriptions, and validity periods</li>
                    <li>Send service-related notifications (document completion, credit expiry warnings)</li>
                    <li>Send renewal reminders and subscription updates</li>
                    <li>Respond to your inquiries and provide customer support</li>
                    <li>Improve our services and develop new features</li>
                    <li>Detect and prevent fraud or unauthorized access</li>
                    <li>Comply with legal obligations</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">4. Automated Communications</h2>
                  <p className="text-muted-foreground mb-4">
                    We send automated emails and push notifications for:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Document analysis completion</li>
                    <li>Credit expiration reminders (7 days and 1 day before expiry)</li>
                    <li>Subscription renewal reminders</li>
                    <li>Payment confirmations and receipts</li>
                    <li>Account security notifications</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    You can manage your notification preferences in your account settings.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">5. Document Handling and Storage</h2>
                  <p className="text-muted-foreground mb-4">
                    We take the security and privacy of your documents seriously:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Documents are stored securely using encrypted cloud storage</li>
                    <li>Access to documents is restricted to authorized personnel only</li>
                    <li>Documents are processed in non-repository instructor accounts</li>
                    <li>Your documents are not shared with other users or third parties</li>
                    <li>Users may delete their documents and reports at any time after processing</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">6. Data Security</h2>
                  <p className="text-muted-foreground mb-4">
                    We implement appropriate technical and organizational measures to protect your data:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Encryption of data in transit (HTTPS/TLS)</li>
                    <li>Secure cloud infrastructure with access controls</li>
                    <li>Regular security assessments and updates</li>
                    <li>Employee training on data protection</li>
                    <li>Incident response procedures</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">7. Third-Party Services</h2>
                  <p className="text-muted-foreground mb-4">
                    We use trusted third-party services to operate our platform:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li><strong>Payment Processors:</strong> To securely process payments (card details are handled directly by payment providers)</li>
                    <li><strong>Cloud Hosting:</strong> To store and serve our application and data</li>
                    <li><strong>Email Services:</strong> To send transactional and notification emails</li>
                    <li><strong>Push Notification Services:</strong> To deliver browser and mobile notifications</li>
                    <li><strong>Analytics:</strong> To understand how users interact with our service</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    These third parties are contractually obligated to protect your data and use it only 
                    for the purposes we specify.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">8. Your Rights (GDPR)</h2>
                  <p className="text-muted-foreground mb-4">
                    Under data protection laws, you have the following rights:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li><strong>Right of Access:</strong> Request a copy of your personal data</li>
                    <li><strong>Right to Rectification:</strong> Request correction of inaccurate data</li>
                    <li><strong>Right to Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
                    <li><strong>Right to Restrict Processing:</strong> Request limitation of data processing</li>
                    <li><strong>Right to Data Portability:</strong> Request transfer of your data</li>
                    <li><strong>Right to Object:</strong> Object to certain types of processing</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Users may delete their uploaded files at any time after processing is completed. 
                    This permanently removes the document and associated reports from our systems.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">9. Data Retention</h2>
                  <p className="text-muted-foreground">
                    We retain your data for as long as necessary to provide our services and comply with 
                    legal obligations. Account data is retained until you request deletion. Transaction 
                    records may be retained for accounting and legal purposes as required by law. Credit 
                    validity and expiration records are maintained for audit purposes.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">10. Cookies</h2>
                  <p className="text-muted-foreground">
                    We use essential cookies to maintain your session and provide core functionality. 
                    We may also use analytics cookies to understand how users interact with our service. 
                    You can control cookie preferences through your browser settings.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">11. International Transfers</h2>
                  <p className="text-muted-foreground">
                    Your data may be transferred to and processed in countries outside your country of 
                    residence. We ensure appropriate safeguards are in place for such transfers in 
                    compliance with applicable data protection laws.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">12. Changes to This Policy</h2>
                  <p className="text-muted-foreground">
                    We may update this Privacy Policy from time to time. We will notify you of significant 
                    changes by posting the new policy on our website and updating the "Last updated" date.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">13. Contact Us</h2>
                  <p className="text-muted-foreground">
                    For questions about this Privacy Policy or to exercise your rights, please contact us at:
                  </p>
                  <p className="text-muted-foreground mt-4">
                    <strong>Email:</strong> support@plagaiscans.com<br />
                    <strong>Data Controller:</strong> Goldfeather Prem Ltd<br />
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
