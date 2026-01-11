import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Bot, Clock, Shield, ArrowRight, Sparkles, CheckCircle, Zap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SEO, generateOrganizationSchema, generateServiceSchema, generateSoftwareApplicationSchema } from "@/components/SEO";
import { useTranslation } from 'react-i18next';

const Landing = () => {
  const { user } = useAuth();
  const { t } = useTranslation('landing');

  const features = [
    {
      icon: FileText,
      title: t('features.detailedReports'),
      description: t('features.detailedReportsDesc'),
    },
    {
      icon: Bot,
      title: t('features.aiIndicators'),
      description: t('features.aiIndicatorsDesc'),
    },
    {
      icon: Clock,
      title: t('features.fastProcessing'),
      description: t('features.fastProcessingDesc'),
    },
    {
      icon: Shield,
      title: t('features.privacyFirst'),
      description: t('features.privacyFirstDesc'),
    },
  ];

  const steps = [
    {
      number: "1",
      title: t('steps.step1Title'),
      description: t('steps.step1Desc'),
    },
    {
      number: "2",
      title: t('steps.step2Title'),
      description: t('steps.step2Desc'),
    },
    {
      number: "3",
      title: t('steps.step3Title'),
      description: t('steps.step3Desc'),
    },
    {
      number: "4",
      title: t('steps.step4Title'),
      description: t('steps.step4Desc'),
    },
  ];

  return (
    <>
      <SEO
        canonicalUrl="/"
        structuredData={{
          '@context': 'https://schema.org',
          '@graph': [generateOrganizationSchema(), generateServiceSchema(), generateSoftwareApplicationSchema()],
        }}
      />
      <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 group">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-display font-bold text-foreground">Plagaiscans</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/how-it-works" className="text-muted-foreground hover:text-foreground font-medium hidden md:block transition-colors duration-200 link-underline">
                {t('nav.howItWorks')}
              </Link>
              <Link to="/faq" className="text-muted-foreground hover:text-foreground font-medium hidden md:block transition-colors duration-200 link-underline">
                {t('nav.faq')}
              </Link>
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground font-medium hidden sm:block transition-colors duration-200 link-underline">
                {t('nav.pricing')}
              </Link>
              {user ? (
                <Link to="/dashboard">
                  <Button variant="hero" className="rounded-full px-6">
                    {t('nav.dashboard')}
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth" className="text-muted-foreground hover:text-foreground font-medium transition-colors duration-200">
                    {t('nav.login')}
                  </Link>
                  <Link to="/auth">
                    <Button variant="hero" className="rounded-full px-6">
                      {t('nav.getStarted')}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section className="py-20 px-4 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-float" />
            <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
          </div>
          
          <div className="max-w-4xl mx-auto text-center page-enter">
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full border border-border mb-8 animate-fade-in hover:border-primary/30 transition-colors duration-300">
              <Sparkles className="w-4 h-4 text-primary animate-pulse-soft" />
              <span className="text-sm text-foreground/70">{t('hero.badge')}</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground mb-4">
              {t('hero.titleLine1')}
              <br />
              <span className="gradient-text">
                {t('hero.titleLine2')}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t('hero.subtitle')}
            </p>

            {/* Features List */}
            <div className="inline-flex flex-wrap justify-center gap-4 mb-8 stagger-children">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border hover:border-secondary/50 transition-all duration-300">
                <CheckCircle className="w-4 h-4 text-secondary" />
                <span>{t('hero.feature1')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border hover:border-secondary/50 transition-all duration-300">
                <CheckCircle className="w-4 h-4 text-secondary" />
                <span>{t('hero.feature2')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border hover:border-secondary/50 transition-all duration-300">
                <CheckCircle className="w-4 h-4 text-secondary" />
                <span>{t('hero.feature3')}</span>
              </div>
            </div>

            {/* CTA Button */}
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/auth">
                <Button variant="hero" size="xl" className="rounded-full group">
                  {t('hero.ctaPrimary')}
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/how-it-works">
                <Button variant="outline" size="xl" className="rounded-full">
                  {t('hero.ctaSecondary')}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
                {t('features.title')}
              </h2>
              <p className="text-muted-foreground text-lg">
                {t('features.subtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="group cursor-pointer hover:-translate-y-2 hover:shadow-xl hover:border-primary/30"
                >
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 px-4 bg-background">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
                {t('steps.title')}
              </h2>
              <p className="text-muted-foreground text-lg">
                {t('steps.subtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 stagger-children">
              {steps.map((step, index) => (
                <div key={index} className="text-center group">
                  <div className="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/30">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA to Pricing Section */}
        <section className="py-20 px-4 bg-background">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <Zap className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
              {t('pricingCta.title')}
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              {t('pricingCta.subtitle')}
            </p>
            <Link to="/pricing">
              <Button variant="hero" size="xl" className="rounded-full group">
                {t('pricingCta.button')}
                <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 bg-muted/30">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
              {t('cta.title')}
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              {t('cta.subtitle')}
            </p>
            <Link to="/auth">
              <Button variant="hero" size="xl" className="rounded-full group">
                {t('cta.button')}
                <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />

      <WhatsAppSupportButton />
    </div>
    </>
  );
};

export default Landing;
