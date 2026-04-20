import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import Footer from "@/components/Footer";
import { SEO, generateOrganizationSchema, generateServiceSchema, generateSoftwareApplicationSchema } from "@/components/SEO";
import { useTranslation } from 'react-i18next';
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ServicesSection from "@/components/ServicesSection";
import HowItWorksStrip from "@/components/landing/HowItWorksStrip";
import SampleReportSection from "@/components/landing/SampleReportSection";
import TrustSection from "@/components/landing/TrustSection";
import FAQStrip from "@/components/landing/FAQStrip";

const Landing = () => {
  const { user } = useAuth();
  const { t } = useTranslation('landing');

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
              <Link to="/" className="flex items-center gap-2">
                <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-display font-bold text-foreground">PlagaiScans</span>
              </Link>
              <div className="flex items-center gap-5 md:gap-6">
                <Link to="/how-it-works" className="text-muted-foreground hover:text-foreground font-medium hidden md:block transition-colors">
                  {t('nav.howItWorks')}
                </Link>
                <Link to="/use-cases" className="text-muted-foreground hover:text-foreground font-medium hidden md:block transition-colors">
                  {t('nav.useCases')}
                </Link>
                <Link to="/faq" className="text-muted-foreground hover:text-foreground font-medium hidden md:block transition-colors">
                  {t('nav.faq')}
                </Link>
                <Link to="/pricing" className="text-muted-foreground hover:text-foreground font-medium hidden sm:block transition-colors">
                  {t('nav.pricing')}
                </Link>
                {user ? (
                  <Link to="/dashboard">
                    <Button className="rounded-full px-5">{t('nav.dashboard')}</Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/auth" className="text-muted-foreground hover:text-foreground font-medium transition-colors hidden sm:block">
                      {t('nav.login')}
                    </Link>
                    <Link to="/auth">
                      <Button className="rounded-full px-5">{t('nav.signUp')}</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>

        <main>
          <HeroSection />
          <TrustSection />
          <HowItWorksStrip />
          <ServicesSection />
          <SampleReportSection />
          <AboutSection />
          <FAQStrip />

          {/* Final CTA */}
          <section className="py-16 md:py-24 bg-primary text-primary-foreground">
            <div className="container-width section-padding text-center">
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
                {t('cta.title')}
              </h2>
              <p className="text-base md:text-lg opacity-90 mb-8 max-w-2xl mx-auto">
                {t('cta.subtitle')}
              </p>
              <Link to="/auth">
                <Button size="lg" variant="secondary" className="rounded-full px-8 font-semibold">
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
