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

  const whatWeDo = [
    "Compare text against available indexed sources",
    "Generate similarity percentage indicators",
    "Provide reports showing matched text segments",
    "Process documents in a secure environment"
  ];

  const whatWeDoNotGuarantee = [
    "Accuracy or completeness of similarity detection",
    "Acceptance by any academic institution or employer",
    "Detection of all potential overlaps",
    "Verification of content originality or authorship"
  ];

  return (
    <>
      <SEO
        title="About Our Service"
        description="Learn about PlagaiScans, a text similarity checking platform operated by Plagaiscans Technologies Ltd, United Kingdom."
        keywords="about PlagaiScans, text similarity checking, Plagaiscans Technologies Ltd"
        canonicalUrl="/about-us"
        ogImage="/og-about.png"
        structuredData={{
          '@context': 'https://schema.org',
          '@graph': [
            generateOrganizationSchema(),
            generateWebPageSchema('About Our Service', 'About PlagaiScans', '/about-us'),
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
              <span className="font-display font-bold text-lg">PlagaiScans</span>
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
                About Our Service
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                A text similarity checking platform for document analysis and content review.
              </p>
            </div>

            {/* Main About Content */}
            <Card className="mb-12 border-border">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-4">Service Description</h2>
                <p className="text-muted-foreground mb-4">
                  PlagaiScans is a text similarity checking platform operated by <strong>Plagaiscans Technologies Ltd</strong>, 
                  a company registered in the United Kingdom (Company No. 16998013).
                </p>
                <p className="text-muted-foreground mb-4">
                  Our service compares submitted documents against indexed web and academic sources to generate 
                  similarity indicators. These reports are provided for informational purposes only and should 
                  be used as a reference tool alongside human review.
                </p>
                <Alert className="border-border bg-muted/50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Our reports are advisory tools. Final responsibility for content review, interpretation, 
                    and any resulting decisions lies entirely with the user.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* What We Do / Don't Guarantee */}
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <Card className="border-border">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    What We Do
                  </h3>
                  <ul className="space-y-3">
                    {whatWeDo.map((item, index) => (
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
                    What We Do Not Guarantee
                  </h3>
                  <ul className="space-y-3">
                    {whatWeDoNotGuarantee.map((item, index) => (
                      <li key={index} className="flex items-start gap-3 text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-2 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Service Features */}
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Similarity Reports</h3>
                  <p className="text-muted-foreground">
                    Reports show potential text matches and source references. Results should be reviewed 
                    by the user and are not a definitive assessment.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Document Security</h3>
                  <p className="text-muted-foreground">
                    Documents are processed securely. Users may delete their documents and reports 
                    after processing is complete.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Processing</h3>
                  <p className="text-muted-foreground">
                    Documents are typically processed within a reasonable timeframe. Processing times 
                    may vary based on document length and system load.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Globe className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Source Coverage</h3>
                  <p className="text-muted-foreground">
                    Documents are compared against available indexed sources. Coverage may vary 
                    and does not include all possible sources.
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
                    <p className="text-muted-foreground">Operated by Plagaiscans Technologies Ltd</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground"><strong>Legal Name:</strong> Plagaiscans Technologies Ltd</p>
                    <p className="text-muted-foreground"><strong>Trading Name:</strong> PlagaiScans</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground"><strong>Country:</strong> United Kingdom</p>
                    <p className="text-muted-foreground"><strong>Company Registration:</strong> 16998013</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Section */}
            <Card className="bg-muted/50 border-border">
              <CardContent className="p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
                <p className="text-muted-foreground mb-6">
                  For questions about our service, please contact our support team.
                </p>
                <div className="flex items-center justify-center gap-2 text-lg mb-4">
                  <Mail className="h-5 w-5 text-primary" />
                  <a href="mailto:support@plagaiscans.com" className="text-primary hover:underline font-medium">
                    support@plagaiscans.com
                  </a>
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
