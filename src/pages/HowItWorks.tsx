import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, Upload, Search, Download, ArrowLeft, ArrowRight, Shield, Clock, AlertCircle } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';
import { Breadcrumb } from '@/components/Breadcrumb';

export default function HowItWorks() {
  const { t } = useTranslation('landing');
  
  const steps = [
    {
      number: 1,
      icon: Upload,
      title: "Create Account & Upload",
      description: "Sign up and upload your document in a supported format (PDF, DOC, DOCX, TXT).",
      details: ["Create an account with email", "Purchase credits as needed", "Upload your document securely"]
    },
    {
      number: 2,
      icon: Search,
      title: "Content Comparison",
      description: "Your text is compared against available indexed sources to identify potential overlaps.",
      details: ["Document text is extracted", "Compared against indexed sources", "Potential matches identified"]
    },
    {
      number: 3,
      icon: FileText,
      title: "Report Generation",
      description: "A report is generated showing similarity indicators and matched text segments.",
      details: ["Similarity percentage calculated", "Matched segments highlighted", "Source references included"]
    },
    {
      number: 4,
      icon: Download,
      title: "Review & Download",
      description: "Download and manually review the findings. Interpretation is your responsibility.",
      details: ["Download PDF reports", "Review matched segments", "Make your own assessment"]
    }
  ];

  const features = [
    {
      icon: Shield,
      title: "Secure Processing",
      description: "Documents are processed in a secure environment. Users may delete their documents after processing."
    },
    {
      icon: Clock,
      title: "Processing Times",
      description: "Documents are typically processed within a reasonable timeframe. Times may vary based on document length."
    },
    {
      icon: FileText,
      title: "Report Format",
      description: "Reports are provided in PDF format for download and review."
    }
  ];

  return (
    <>
      <SEO
        title="How It Works"
        description="Learn how PlagaiScans document analysis works. Upload your document, receive a similarity report, and review the findings."
        keywords="document analysis process, similarity checking steps, how to use PlagaiScans"
        canonicalUrl="/how-it-works"
        ogImage="/og-how-it-works.png"
        structuredData={generateWebPageSchema('How It Works', 'Simple process for document analysis', '/how-it-works')}
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
                {t('howItWorks.backToHome')}
              </Button>
            </Link>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container-width px-4 py-8 md:py-16">
          <div className="max-w-5xl mx-auto">
            {/* Breadcrumb */}
            <Breadcrumb items={[{ label: 'How It Works' }]} />

            {/* Hero Section */}
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
                {t('howItWorks.title')} <span className="text-primary">PlagaiScans</span> {t('howItWorks.titleSuffix')}
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {t('howItWorks.subtitle')}
              </p>
            </div>

            {/* Important Disclaimer */}
            <Alert className="mb-12 border-border bg-muted/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Reports are provided for informational purposes only. Results depend on available indexed sources and may not be exhaustive. 
                Final responsibility for content review and interpretation lies with the user.
              </AlertDescription>
            </Alert>

            {/* Steps */}
            <div className="space-y-8 mb-20">
              {steps.map((step) => (
                <Card key={step.number} className="border-border">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      {/* Step Number */}
                      <div className="md:w-24 bg-primary/10 flex items-center justify-center p-6 md:p-0">
                        <span className="text-5xl font-display font-bold text-primary">{step.number}</span>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 p-6 md:p-8">
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <step.icon className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                            <p className="text-muted-foreground mb-4">{step.description}</p>
                            <ul className="space-y-2">
                              {step.details.map((detail, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                  {detail}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Features */}
            <div className="mb-16">
              <h2 className="text-3xl font-display font-bold text-center mb-10">
                {t('howItWorks.whyChoose')}
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                {features.map((feature, index) => (
                  <Card key={index} className="text-center border-border">
                    <CardContent className="p-6">
                      <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <feature.icon className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground text-sm">{feature.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* CTA */}
            <Card className="bg-muted/50 border-border">
              <CardContent className="p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">{t('howItWorks.readyToCheck')}</h2>
                <p className="text-muted-foreground mb-4 max-w-xl mx-auto">
                  {t('howItWorks.ctaDescription')}
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  This service is provided for informational purposes only.
                </p>
                <Link to="/auth">
                  <Button size="lg" className="rounded-full">
                    {t('howItWorks.getStarted')}
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
