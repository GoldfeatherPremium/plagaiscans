import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ArrowLeft, ArrowRight, BarChart3, FileSearch, Highlighter, Link2, Percent, BookOpen } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';
import { Breadcrumb } from '@/components/Breadcrumb';

export default function SimilarityReport() {
  const { t } = useTranslation('pages');

  const reportFeatures = [
    {
      icon: Percent,
      title: t('similarityReport.overallScore'),
      description: t('similarityReport.overallScoreDesc')
    },
    {
      icon: Highlighter,
      title: t('similarityReport.highlightedMatches'),
      description: t('similarityReport.highlightedMatchesDesc')
    },
    {
      icon: Link2,
      title: t('similarityReport.sourceAttribution'),
      description: t('similarityReport.sourceAttributionDesc')
    },
    {
      icon: FileSearch,
      title: t('similarityReport.detailedBreakdown'),
      description: t('similarityReport.detailedBreakdownDesc')
    }
  ];

  const interpretationGuide = [
    {
      range: t('similarityReport.lowSimilarityRange'),
      label: t('similarityReport.lowSimilarity'),
      description: t('similarityReport.lowSimilarityDesc')
    },
    {
      range: t('similarityReport.moderateSimilarityRange'),
      label: t('similarityReport.moderateSimilarity'),
      description: t('similarityReport.moderateSimilarityDesc')
    },
    {
      range: t('similarityReport.higherSimilarityRange'),
      label: t('similarityReport.higherSimilarity'),
      description: t('similarityReport.higherSimilarityDesc')
    }
  ];

  const pageSchema = generateWebPageSchema(
    'Understanding Similarity Reports',
    'Learn how to read and interpret similarity reports for academic documents.',
    '/similarity-report'
  );

  return (
    <>
      <SEO
        title="Similarity Report"
        description="Understand how to read and interpret similarity reports. Learn about similarity scores, highlighted matches, and source attribution for academic documents."
        keywords="similarity report, plagiarism report, originality report, academic similarity, source matching, citation review"
        canonicalUrl="/similarity-report"
        ogImage="/og-similarity-report.png"
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
                {t('similarityReport.backToHome')}
              </Button>
            </Link>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container-width px-4 py-16">
          <div className="max-w-5xl mx-auto">
            <Breadcrumb items={[{ label: t('similarityReport.title') }]} />
            
            {/* Hero Section */}
            <div className="text-center mb-16">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
                {t('similarityReport.title')}
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                {t('similarityReport.subtitle')}
              </p>
            </div>

            {/* What's in a Report */}
            <div className="mb-16">
              <h2 className="text-3xl font-display font-bold text-center mb-10">
                {t('similarityReport.whatsIncluded')}
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {reportFeatures.map((feature, index) => (
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

            {/* Interpretation Guide */}
            <Card className="mb-12">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6 text-center">{t('similarityReport.interpretingScores')}</h2>
                <p className="text-center text-muted-foreground mb-8">
                  {t('similarityReport.interpretingDesc')}
                </p>
                <div className="space-y-4">
                  {interpretationGuide.map((item, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-muted/30">
                      <div className="h-12 w-20 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="font-bold text-primary">{item.range}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{item.label}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Important Note */}
            <Card className="mb-12 bg-muted/30">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <BookOpen className="h-8 w-8 text-primary shrink-0" />
                  <div>
                    <h2 className="text-xl font-bold mb-2">{t('similarityReport.understandingTitle')}</h2>
                    <p className="text-muted-foreground mb-4">
                      {t('similarityReport.understandingDesc')}
                    </p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• {t('similarityReport.understanding1')}</li>
                      <li>• {t('similarityReport.understanding2')}</li>
                      <li>• {t('similarityReport.understanding3')}</li>
                      <li>• {t('similarityReport.understanding4')}</li>
                    </ul>
                    <p className="text-muted-foreground mt-4">
                      {t('similarityReport.understandingNote')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">{t('similarityReport.ctaTitle')}</h2>
                <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                  {t('similarityReport.ctaDesc')}
                </p>
                <Link to="/auth">
                  <Button variant="hero" size="lg" className="group">
                    {t('similarityReport.ctaButton')}
                    <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
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
