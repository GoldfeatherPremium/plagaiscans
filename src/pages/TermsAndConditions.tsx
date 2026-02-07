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
        title="Terms of Service"
        description="Terms of Service for Plagaiscans text similarity and content analysis platform."
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
            <p className="text-muted-foreground mb-8">Last updated: February 2026</p>

            <Card>
              <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
                  <p className="text-muted-foreground">
                    Welcome to Plagaiscans. These Terms of Service ("Terms") govern your access to and use of the Plagaiscans 
                    website and services. By accessing or using our services, you agree to be bound by these Terms. If you 
                    do not agree, please do not use our services.
                  </p>
                  <p className="text-muted-foreground mt-4">
                    These services are provided by <strong>Plagaiscans Technologies Ltd</strong> (Company No. 16998013), 
                    a company registered in the United Kingdom, operating under the brand name <strong>Plagaiscans</strong>.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">2. Eligibility</h2>
                  <p className="text-muted-foreground">
                    You must be at least 18 years of age, or the age of majority in your jurisdiction, to create an account 
                    and use our services. By registering, you represent and warrant that you meet these requirements and that 
                    all information you provide is accurate and complete.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">3. Account Registration</h2>
                  <p className="text-muted-foreground">
                    To access certain features, you must create an account. You are responsible for:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Providing accurate and complete registration information</li>
                    <li>Maintaining the confidentiality of your account credentials</li>
                    <li>All activities that occur under your account</li>
                    <li>Notifying us immediately of any unauthorized use of your account</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">4. Description of Service</h2>
                  <p className="text-muted-foreground">
                    Plagaiscans is a subscription-based software-as-a-service (SaaS) platform that provides:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>AI-powered plagiarism and text similarity detection</li>
                    <li>AI-generated content analysis</li>
                    <li>Detailed PDF reports with source references and similarity indicators</li>
                    <li>Secure document processing and handling</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    All outputs are advisory indicators intended to support human review and decision-making. 
                    Results depend on available indexed sources and may not be exhaustive.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">5. Acceptable Use Policy</h2>
                  <p className="text-muted-foreground mb-4">You agree NOT to use this service for:</p>
                  <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                    <li>Academic cheating, misconduct, or dishonesty</li>
                    <li>Circumventing institutional review or integrity systems</li>
                    <li>Misrepresentation, fraud, or deception of any kind</li>
                    <li>Submitting reports as official certification or verification</li>
                    <li>Uploading content that infringes on copyrights or intellectual property rights</li>
                    <li>Uploading malicious files, viruses, or harmful code</li>
                    <li>Attempting to circumvent, reverse-engineer, or manipulate our systems</li>
                    <li>Any illegal or unlawful purposes</li>
                    <li>Sharing, reselling, or sublicensing access to your account</li>
                    <li>Creating multiple accounts to abuse promotional offers</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    <strong>Accounts engaging in prohibited use may be suspended or terminated without refund.</strong>
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">6. User Content Ownership</h2>
                  <p className="text-muted-foreground">
                    You retain full ownership of all documents and content you submit to Plagaiscans. By submitting content, 
                    you grant us a limited, non-exclusive license solely to process and analyze it for the purpose of delivering 
                    our services. We do not claim any ownership rights over your content.
                  </p>
                  <p className="text-muted-foreground mt-4">
                    Your content is not used to train AI models, shared with third parties, or added to any public database.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">7. Intellectual Property</h2>
                  <p className="text-muted-foreground">
                    The Plagaiscans platform, including its design, software, features, branding, and technology, is owned by 
                    Plagaiscans Technologies Ltd and protected by intellectual property laws. You may not copy, modify, distribute, 
                    or create derivative works based on our platform without prior written consent.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">8. Payments & Billing</h2>
                  <p className="text-muted-foreground">
                    All payments are processed by <strong>Paddle</strong>, which acts as the Merchant of Record for all transactions. 
                    By making a purchase, you also agree to Paddle's terms of service and privacy policy.
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Our service operates on a credit-based, pay-as-you-go model</li>
                    <li>Pricing is displayed clearly before checkout</li>
                    <li>One (1) credit is required per document submission</li>
                    <li>Credits are deducted at the time of document submission</li>
                    <li>Credits cannot be transferred between accounts</li>
                    <li>Credit packages have defined validity periods as stated at the time of purchase</li>
                    <li>Expired credits cannot be restored or refunded</li>
                    <li>You will receive notifications before credits expire</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">9. Refund Policy</h2>
                  <p className="text-muted-foreground">
                    For full details on our refund policy, please refer to our dedicated{' '}
                    <Link to="/refund-policy" className="text-primary hover:underline">Refund Policy</Link> page. 
                    In summary, refund requests must be submitted within 7 days of purchase and are subject to review by our team.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">10. Service Availability & Modifications</h2>
                  <p className="text-muted-foreground">
                    We strive to maintain high availability but do not guarantee uninterrupted service. We reserve the right to:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Modify, suspend, or discontinue any part of the service with reasonable notice</li>
                    <li>Perform scheduled maintenance that may temporarily affect availability</li>
                    <li>Update features, pricing, and terms with appropriate notice to users</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">11. Disclaimer of Warranties</h2>
                  <p className="text-muted-foreground">
                    Plagaiscans provides services on an "AS IS" and "AS AVAILABLE" basis. We make no warranties, 
                    express or implied, including but not limited to:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>The accuracy, completeness, or reliability of analysis results</li>
                    <li>Uninterrupted or error-free service availability</li>
                    <li>Fitness for any particular purpose</li>
                    <li>Detection of all potential text overlaps or AI-generated content</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Language analysis is probabilistic and dependent on multiple variables. Results should be interpreted 
                    as advisory indicators and reviewed by a qualified human.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">12. Limitation of Liability</h2>
                  <p className="text-muted-foreground">
                    To the maximum extent permitted by applicable law, Plagaiscans Technologies Ltd shall not be liable for 
                    any indirect, incidental, special, consequential, or punitive damages arising out of or related to your 
                    use of the service. Our total liability for any claims shall not exceed the amount you paid for the service 
                    in the preceding 12 months.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">13. Termination</h2>
                  <p className="text-muted-foreground">
                    We reserve the right to suspend or terminate your account if you:
                  </p>
                  <ul className="list-disc pl-6 text-muted-foreground mt-4 space-y-2">
                    <li>Violate these Terms of Service</li>
                    <li>Engage in fraudulent or abusive behavior</li>
                    <li>Abuse promotional codes or referral programs</li>
                    <li>Initiate unauthorized chargebacks</li>
                    <li>Attempt to exploit or harm our platform</li>
                  </ul>
                  <p className="text-muted-foreground mt-4">
                    Upon termination, unused credits will be forfeited. You may also terminate your account at any time by 
                    contacting our support team.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">14. Governing Law</h2>
                  <p className="text-muted-foreground">
                    These Terms of Service are governed by and construed in accordance with the laws of the United Kingdom. 
                    Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of 
                    the United Kingdom.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">15. Changes to Terms</h2>
                  <p className="text-muted-foreground">
                    We reserve the right to modify these Terms at any time. We will notify users of material changes by 
                    posting the updated Terms on our website and updating the "Last updated" date. Continued use of the 
                    service after changes constitutes acceptance of the new Terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">16. Contact Information</h2>
                  <p className="text-muted-foreground">
                    For questions about these Terms of Service, please contact us at:
                  </p>
                  <p className="text-muted-foreground mt-4">
                    <strong>Email:</strong> support@plagaiscans.com<br />
                    <strong>Billing:</strong> billing@plagaiscans.com<br />
                    <strong>Company:</strong> Plagaiscans Technologies Ltd<br />
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
