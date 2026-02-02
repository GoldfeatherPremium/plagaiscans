import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ArrowLeft, ArrowRight, Bot, Brain, BarChart, Info, Shield } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';
import { Breadcrumb } from '@/components/Breadcrumb';
import { AIDisclaimer } from '@/components/AIDisclaimer';

export default function AIContentDetection() {
  const { t } = useTranslation('pages');

  const features = [
    {
      icon: Brain,
      title: t('aiContentDetection.patternAnalysis'),
      description: t('aiContentDetection.patternAnalysisDesc')
    },
    {
      icon: BarChart,
      title: t('aiContentDetection.probabilityIndicators'),
      description: t('aiContentDetection.probabilityIndicatorsDesc')
    },
    {
      icon: Info,
      title: t('aiContentDetection.contextualInsights'),
      description: t('aiContentDetection.contextualInsightsDesc')
    },
    {
      icon: Shield,
      title: t('aiContentDetection.privacyProtected'),
      description: t('aiContentDetection.privacyProtectedDesc')
    }
  ];

  const pageSchema = generateWebPageSchema(
    'AI Content Detection',
    'Learn about AI content detection indicators and how to interpret them for academic documents.',
    '/ai-content-detection'
  );

  return (
    <>
      <SEO
        title="AI Content Detection"
        description="Understand AI content detection indicators for academic documents. Learn how AI writing analysis works and how to interpret probability-based results."
        keywords="AI content detection, AI writing detection, AI text analysis, academic writing analysis, content authenticity, writing verification"
        canonicalUrl="/ai-content-detection"
        ogImage="/og-ai-detection.png"
        structuredData={pageSchema}
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
                {t('aiContentDetection.backToHome')}
              </Button>
            </Link>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container-width px-4 py-16">
          <div className="max-w-5xl mx-auto">
            <Breadcrumb items={[{ label: t('aiContentDetection.title') }]} />
            
            {/* Hero Section */}
            <div className="text-center mb-16">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-6">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
                {t('aiContentDetection.title')}
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-6">
                {t('aiContentDetection.subtitle')}
              </p>
              <AIDisclaimer />
            </div>


            {/* How It Works */}
            <Card className="mb-12">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6 text-center">{t('aiContentDetection.howItWorksTitle')}</h2>
                <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
                  {t('aiContentDetection.howItWorksDesc')}
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-muted/30">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <feature.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Interpreting Results */}
            <Card className="mb-12">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6">{t('aiContentDetection.interpretingTitle')}</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-2">{t('aiContentDetection.whatIndicatorsShow')}</h3>
                    <p className="text-muted-foreground">
                      {t('aiContentDetection.whatIndicatorsShowDesc')}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">{t('aiContentDetection.factorsTitle')}</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• {t('aiContentDetection.factor1')}</li>
                      <li>• {t('aiContentDetection.factor2')}</li>
                      <li>• {t('aiContentDetection.factor3')}</li>
                      <li>• {t('aiContentDetection.factor4')}</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">{t('aiContentDetection.recommendedApproach')}</h3>
                    <p className="text-muted-foreground">
                      {t('aiContentDetection.recommendedApproachDesc')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Best Practices */}
            <Card className="mb-12 bg-muted/30">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6">{t('aiContentDetection.bestPracticesTitle')}</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3">{t('aiContentDetection.forStudents')}</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• {t('aiContentDetection.student1')}</li>
                      <li>• {t('aiContentDetection.student2')}</li>
                      <li>• {t('aiContentDetection.student3')}</li>
                      <li>• {t('aiContentDetection.student4')}</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-3">{t('aiContentDetection.forEducators')}</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• {t('aiContentDetection.educator1')}</li>
                      <li>• {t('aiContentDetection.educator2')}</li>
                      <li>• {t('aiContentDetection.educator3')}</li>
                      <li>• {t('aiContentDetection.educator4')}</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">{t('aiContentDetection.ctaTitle')}</h2>
                <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                  {t('aiContentDetection.ctaDesc')}
                </p>
                <Link to="/auth">
                  <Button variant="default" size="lg">
                    {t('aiContentDetection.ctaButton')}
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
