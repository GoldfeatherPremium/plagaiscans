import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ArrowLeft, ArrowRight, BookOpen, Scale, GraduationCap, Shield, Users, Lightbulb } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';

export default function AcademicIntegrity() {
  const { t } = useTranslation('pages');

  const pageSchema = generateWebPageSchema(
    'Academic Integrity Guide',
    'Learn about academic integrity principles, proper citation practices, and how plagiarism detection tools support ethical scholarship.',
    '/academic-integrity'
  );

  const principles = [
    {
      icon: BookOpen,
      title: t('academicIntegrity.honestScholarship'),
      description: t('academicIntegrity.honestScholarshipDesc')
    },
    {
      icon: Scale,
      title: t('academicIntegrity.fairAssessment'),
      description: t('academicIntegrity.fairAssessmentDesc')
    },
    {
      icon: GraduationCap,
      title: t('academicIntegrity.educationalValue'),
      description: t('academicIntegrity.educationalValueDesc')
    },
    {
      icon: Shield,
      title: t('academicIntegrity.professionalStandards'),
      description: t('academicIntegrity.professionalStandardsDesc')
    }
  ];

  const howWeHelp = [
    {
      icon: FileText,
      title: t('academicIntegrity.clearReports'),
      description: t('academicIntegrity.clearReportsDesc')
    },
    {
      icon: Users,
      title: t('academicIntegrity.educationalApproach'),
      description: t('academicIntegrity.educationalApproachDesc')
    },
    {
      icon: Lightbulb,
      title: t('academicIntegrity.improvementGuidance'),
      description: t('academicIntegrity.improvementGuidanceDesc')
    }
  ];

  return (
    <>
      <SEO
        title="Academic Integrity"
        description="Learn about academic integrity principles, proper citation practices, and how plagiarism detection tools support ethical scholarship and honest research."
        keywords="academic integrity, plagiarism prevention, citation best practices, scholarly ethics, academic honesty, research integrity"
        canonicalUrl="/academic-integrity"
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
              {t('academicIntegrity.backToHome')}
            </Button>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container-width px-4 py-16">
        <div className="max-w-5xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
              {t('academicIntegrity.title')}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              {t('academicIntegrity.subtitle')}
            </p>
          </div>

          {/* What is Academic Integrity */}
          <Card className="mb-12">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">{t('academicIntegrity.whatIsTitle')}</h2>
              <p className="text-muted-foreground mb-4">
                {t('academicIntegrity.whatIsDesc1')}
              </p>
              <p className="text-muted-foreground mb-4">
                {t('academicIntegrity.whatIsDesc2')}
              </p>
              <p className="text-muted-foreground">
                {t('academicIntegrity.whatIsDesc3')}
              </p>
            </CardContent>
          </Card>

          {/* Core Principles */}
          <div className="mb-16">
            <h2 className="text-3xl font-display font-bold text-center mb-10">
              {t('academicIntegrity.corePrinciplesTitle')}
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {principles.map((principle, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0">
                        <principle.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold mb-2">{principle.title}</h3>
                        <p className="text-muted-foreground text-sm">{principle.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* How We Support */}
          <div className="mb-16">
            <h2 className="text-3xl font-display font-bold text-center mb-4">
              {t('academicIntegrity.howWeHelpTitle')}
            </h2>
            <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
              {t('academicIntegrity.howWeHelpDesc')}
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {howWeHelp.map((item, index) => (
                <Card key={index} className="text-center">
                  <CardContent className="p-6">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
                      <item.icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground text-sm">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Best Practices */}
          <Card className="mb-12 bg-muted/30">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-6">{t('academicIntegrity.bestPracticesTitle')}</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">{t('academicIntegrity.citationAttribution')}</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• {t('academicIntegrity.citation1')}</li>
                    <li>• {t('academicIntegrity.citation2')}</li>
                    <li>• {t('academicIntegrity.citation3')}</li>
                    <li>• {t('academicIntegrity.citation4')}</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">{t('academicIntegrity.originalContent')}</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• {t('academicIntegrity.original1')}</li>
                    <li>• {t('academicIntegrity.original2')}</li>
                    <li>• {t('academicIntegrity.original3')}</li>
                    <li>• {t('academicIntegrity.original4')}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">{t('academicIntegrity.ctaTitle')}</h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                {t('academicIntegrity.ctaDesc')}
              </p>
              <Link to="/auth">
                <Button variant="hero" size="lg" className="group">
                  {t('academicIntegrity.ctaButton')}
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
