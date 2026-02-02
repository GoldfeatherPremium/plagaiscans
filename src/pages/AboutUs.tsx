import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Shield, Clock, Globe, Mail, ArrowLeft, AlertCircle, XCircle, CheckCircle } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema, generateOrganizationSchema } from '@/components/SEO';
import { useTranslation } from 'react-i18next';

export default function AboutUs() {
  const { t } = useTranslation('common');

  const serviceOutputs = [
    "Text similarity patterns",
    "Overlap indicators",
    "Stylistic and structural signals"
  ];

  const intendedUse = [
    "Editorial review processes",
    "Publishing and content quality checks",
    "Internal documentation review",
    "Writing improvement and training purposes"
  ];

  const notIntendedFor = [
    "Sole basis for academic grading",
    "Disciplinary action decisions",
    "Enforcement decisions",
    "Official certification purposes"
  ];

  const prohibitedUse = [
    "Academic cheating or misconduct",
    "Circumventing institutional review systems",
    "Misrepresentation or deception",
    "Submitting reports as official certification"
  ];

  return (
    <>
      <SEO
        title="About Our Service"
        description="Plagaiscans is a subscription-based SaaS platform providing text similarity and originality analysis for editors, educators, publishers, and content teams."
        keywords="about Plagaiscans, text similarity analysis, Plagaiscans Technologies Ltd"
        canonicalUrl="/about-us"
        ogImage="/og-about.png"
        structuredData={{
          '@context': 'https://schema.org',
          '@graph': [
            generateOrganizationSchema(),
            generateWebPageSchema('About Our Service', 'About Plagaiscans', '/about-us'),
          ],
        }}
      />
      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container-width flex h-16 items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-lg">Plagaiscans</span>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('about.backToHome')}
              </Button>
            </Link>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container-width px-4 py-16">
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
                About Plagaiscans
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                A subscription-based software-as-a-service platform providing text similarity 
                and originality analysis.
              </p>
            </div>

            {/* Primary Description */}
            <Card className="mb-12 border-border">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-4">Service Description</h2>
                <p className="text-muted-foreground mb-4">
                  Plagaiscans is a subscription-based software-as-a-service (SaaS) platform that provides 
                  text similarity and originality analysis. The service is designed to assist editors, 
                  educators, publishers, and content teams in reviewing written material.
                </p>
                <Alert className="border-border bg-muted/50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Plagaiscans provides informational analysis only. It does not make academic, legal, 
                    employment, or disciplinary determinations.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Service Scope */}
            <Card className="mb-12 border-border">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-4">Service Scope</h2>
                <p className="text-muted-foreground mb-4">
                  The platform analyzes user-submitted text and generates reports indicating:
                </p>
                <ul className="space-y-2 mb-6">
                  {serviceOutputs.map((item, index) => (
                    <li key={index} className="flex items-start gap-3 text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground mb-4">
                  All outputs are advisory indicators intended to support human review and decision-making.
                </p>
                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Plagaiscans does not:</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Guarantee accuracy or completeness</li>
                    <li>• Certify originality</li>
                    <li>• Provide legal, academic, or compliance judgments</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Intended Use / Not Intended For */}
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <Card className="border-border">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    Intended Use
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Plagaiscans is intended for:
                  </p>
                  <ul className="space-y-3">
                    {intendedUse.map((item, index) => (
                      <li key={index} className="flex items-start gap-3 text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                    Not Intended For
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    The service is not intended to be used as the:
                  </p>
                  <ul className="space-y-3">
                    {notIntendedFor.map((item, index) => (
                      <li key={index} className="flex items-start gap-3 text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-2 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Prohibited Use */}
            <Card className="mb-12 border-border border-destructive/30 bg-destructive/5">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-4">Prohibited Use</h2>
                <p className="text-muted-foreground mb-4">
                  Users may not use Plagaiscans for:
                </p>
                <ul className="space-y-2 mb-4">
                  {prohibitedUse.map((item, index) => (
                    <li key={index} className="flex items-start gap-3 text-muted-foreground">
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground font-medium">
                  Accounts engaging in prohibited use may be suspended or terminated without refund.
                </p>
              </CardContent>
            </Card>

            {/* How the Service Works */}
            <Card className="mb-12 border-border">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-4">How the Service Works</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">1</div>
                    <p className="text-muted-foreground pt-1">Users submit text through the platform</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">2</div>
                    <p className="text-muted-foreground pt-1">Automated systems process the text to identify similarity indicators</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">3</div>
                    <p className="text-muted-foreground pt-1">A report is generated for user review</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-6">
                  Processing is limited to the purpose of delivering the service.
                </p>
              </CardContent>
            </Card>

            {/* Accuracy Disclaimer */}
            <Card className="mb-12 border-border bg-muted/50">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-4">Accuracy Disclaimer</h2>
                <p className="text-muted-foreground mb-4">
                  Language analysis is probabilistic and dependent on multiple variables including writing style, 
                  available reference material, and context. Results may vary and should be interpreted cautiously.
                </p>
                <Alert className="border-border">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Plagaiscans makes no guarantees regarding detection accuracy, completeness, or outcomes.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Service Features */}
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Report Generation</h3>
                  <p className="text-muted-foreground">
                    Reports show similarity indicators and matched text segments. All outputs are 
                    advisory and require human interpretation.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Secure Processing</h3>
                  <p className="text-muted-foreground">
                    Documents are processed in a secure environment. Users may delete their 
                    documents after processing is complete.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Processing Time</h3>
                  <p className="text-muted-foreground">
                    Documents are typically processed within a reasonable timeframe. Times may vary 
                    based on document length and system load.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Globe className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Remote Digital Service</h3>
                  <p className="text-muted-foreground">
                    Plagaiscans is a remote digital SaaS business focused on responsible content 
                    review assistance.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Company Info */}
            <Card className="mb-12 border-border">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Globe className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Company Information</h2>
                    <p className="text-muted-foreground">UK-registered limited company</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 text-sm mb-6">
                  <div>
                    <p className="text-muted-foreground"><strong>Legal Name:</strong> Plagaiscans Technologies Ltd</p>
                    <p className="text-muted-foreground"><strong>Trading Name:</strong> Plagaiscans</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground"><strong>Country:</strong> United Kingdom</p>
                    <p className="text-muted-foreground"><strong>Company Registration:</strong> 16998013</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  The company does not offer legal, academic, or regulatory advisory services.
                </p>
              </CardContent>
            </Card>

            {/* Contact Section */}
            <Card className="bg-muted/50 border-border">
              <CardContent className="p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">Contact Information</h2>
                <p className="text-muted-foreground mb-6">
                  Customer support is available via email.
                </p>
                <div className="flex flex-col items-center gap-3 mb-6">
                  <div className="flex items-center gap-2 text-lg">
                    <Mail className="h-5 w-5 text-primary" />
                    <a href="mailto:support@plagaiscans.com" className="text-primary hover:underline font-medium">
                      support@plagaiscans.com
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-lg">
                    <Mail className="h-5 w-5 text-primary" />
                    <a href="mailto:billing@plagaiscans.com" className="text-primary hover:underline font-medium">
                      billing@plagaiscans.com
                    </a>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Plagaiscans Technologies Ltd • United Kingdom • Company No. 16998013
                </p>
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}