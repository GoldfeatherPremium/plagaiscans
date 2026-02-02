import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ArrowLeft, ArrowRight, Search, Shield, Clock, FileCheck, Database, Lock } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateServiceSchema } from '@/components/SEO';
import { Breadcrumb } from '@/components/Breadcrumb';

export default function PlagiarismChecker() {
  const { t } = useTranslation('pages');

  const features = [
    {
      icon: Database,
      title: t('plagiarismChecker.sourceCoverage'),
      description: t('plagiarismChecker.sourceCoverageDesc')
    },
    {
      icon: FileCheck,
      title: t('plagiarismChecker.detailedReports'),
      description: t('plagiarismChecker.detailedReportsDesc')
    },
    {
      icon: Clock,
      title: t('plagiarismChecker.fastProcessing'),
      description: t('plagiarismChecker.fastProcessingDesc')
    },
    {
      icon: Lock,
      title: t('plagiarismChecker.privacyFirst'),
      description: t('plagiarismChecker.privacyFirstDesc')
    }
  ];

  const serviceSchema = generateServiceSchema();

  return (
    <>
      <SEO
        title="Text Similarity Review"
        description="Upload documents to generate similarity reports. Compare your text against indexed sources for content review purposes. Reports are for informational use only."
        keywords="text similarity, content review, document analysis, similarity report"
        canonicalUrl="/plagiarism-checker"
        ogImage="/og-plagiarism-checker.png"
        structuredData={serviceSchema}
      />
      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container-width flex h-16 items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-lg">Plagaiscans</span>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('plagiarismChecker.backToHome')}
              </Button>
            </Link>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container-width px-4 py-16">
          <div className="max-w-5xl mx-auto">
            <Breadcrumb items={[{ label: t('plagiarismChecker.title') }]} />
            
            {/* Hero Section */}
            <div className="text-center mb-16">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-6">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
                {t('plagiarismChecker.title')}
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                {t('plagiarismChecker.subtitle')}
              </p>
            </div>

            {/* How It Works */}
            <Card className="mb-12">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6 text-center">{t('plagiarismChecker.howItWorksTitle')}</h2>
                <div className="grid md:grid-cols-3 gap-8">
                  <div className="text-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <span className="text-xl font-bold text-primary">1</span>
                    </div>
                    <h3 className="font-semibold mb-2">{t('plagiarismChecker.step1Title')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('plagiarismChecker.step1Desc')}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <span className="text-xl font-bold text-primary">2</span>
                    </div>
                    <h3 className="font-semibold mb-2">{t('plagiarismChecker.step2Title')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('plagiarismChecker.step2Desc')}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <span className="text-xl font-bold text-primary">3</span>
                    </div>
                    <h3 className="font-semibold mb-2">{t('plagiarismChecker.step3Title')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('plagiarismChecker.step3Desc')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Features */}
            <div className="mb-16">
              <h2 className="text-3xl font-display font-bold text-center mb-10">
                {t('plagiarismChecker.featuresTitle')}
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {features.map((feature, index) => (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0">
                          <feature.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                          <p className="text-muted-foreground text-sm">{feature.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Privacy Note */}
            <Card className="mb-12 bg-muted/30">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <Shield className="h-8 w-8 text-primary shrink-0" />
                  <div>
                    <h2 className="text-xl font-bold mb-2">{t('plagiarismChecker.privacyTitle')}</h2>
                    <p className="text-muted-foreground">
                      {t('plagiarismChecker.privacyDesc')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">{t('plagiarismChecker.ctaTitle')}</h2>
                <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                  {t('plagiarismChecker.ctaDesc')}
                </p>
                <Link to="/auth">
                  <Button variant="default" size="lg">
                    {t('plagiarismChecker.ctaButton')}
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
