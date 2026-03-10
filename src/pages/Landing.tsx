import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Shield, Clock, Users, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { SEO, generateOrganizationSchema, generateServiceSchema, generateSoftwareApplicationSchema } from "@/components/SEO";
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from "@/components/ui/alert";

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
      icon: Shield,
      title: t('features.contentIndicators'),
      description: t('features.contentIndicatorsDesc'),
    },
    {
      icon: Clock,
      title: t('features.standardProcessing'),
      description: t('features.standardProcessingDesc'),
    },
    {
      icon: Users,
      title: t('features.secureHandling'),
      description: t('features.secureHandlingDesc'),
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
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-display font-bold text-foreground">PlagaiScans</span>
              </div>
              <div className="flex items-center gap-6">
                <Link to="/how-it-works" className="text-muted-foreground hover:text-foreground font-medium hidden md:block transition-colors duration-200">
                  {t('nav.howItWorks')}
                </Link>
                <Link to="/use-cases" className="text-muted-foreground hover:text-foreground font-medium hidden md:block transition-colors duration-200">
                  {t('nav.useCases')}
                </Link>
                <Link to="/faq" className="text-muted-foreground hover:text-foreground font-medium hidden md:block transition-colors duration-200">
                  {t('nav.faq')}
                </Link>
                <Link to="/pricing" className="text-muted-foreground hover:text-foreground font-medium hidden sm:block transition-colors duration-200">
                  {t('nav.pricing')}
                </Link>
                {user ? (
                  <Link to="/dashboard">
                    <Button className="rounded-full px-6">
                      {t('nav.dashboard')}
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/auth" className="text-muted-foreground hover:text-foreground font-medium transition-colors duration-200">
                      {t('nav.login')}
                    </Link>
                    <Link to="/auth">
                      <Button className="rounded-full px-6">
                        {t('nav.signUp')}
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
          <section className="py-20 px-4">
            <div className="max-w-4xl mx-auto text-center">
              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground mb-4">
                {t('hero.titleLine1')}
                <br />
                <span className="text-primary">
                  {t('hero.titleLine2')}
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                {t('hero.subtitle')}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                <Link to="/auth">
                  <Button size="lg" className="rounded-full">
                    {t('hero.ctaPrimary')}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link to="/how-it-works">
                  <Button variant="outline" size="lg" className="rounded-full">
                    {t('hero.ctaSecondary')}
                  </Button>
                </Link>
              </div>

              {/* Service Disclaimer */}
              <Alert className="max-w-2xl mx-auto border-border bg-muted/50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm text-muted-foreground">
                  {t('hero.disclaimer')}
                </AlertDescription>
              </Alert>
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

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map((feature, index) => (
                  <Card key={index} className="border-border">
                    <CardContent className="p-6">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
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

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {steps.map((step, index) => (
                  <div key={index} className="text-center">
                    <div className="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
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
          <section className="py-20 px-4 bg-muted/30">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
                {t('pricingCta.title')}
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                {t('pricingCta.subtitle')}
              </p>
              <Link to="/pricing">
                <Button size="lg" className="rounded-full">
                  {t('pricingCta.button')}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </section>

          {/* Final CTA Section */}
          <section className="py-20 px-4 bg-background">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
                {t('cta.title')}
              </h2>
              <p className="text-muted-foreground text-lg mb-6">
                {t('cta.subtitle')}
              </p>
              <p className="text-sm text-muted-foreground mb-8">
                {t('cta.disclaimer')}
              </p>
              <Link to="/auth">
                <Button size="lg" className="rounded-full">
                  {t('cta.button')}
                  <ArrowRight className="w-5 h-5 ml-2" />
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
