import { ArrowRight, FileText, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const HeroSection = () => {
  const { t } = useTranslation('landing');

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center pt-20 pb-16">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-muted/30" />

      <div className="relative z-10 container-width section-padding text-center">
        {/* Main Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight mb-6">
          {t('hero.titleLine1')}
          <br />
          <span className="text-primary">{t('hero.titleLine2')}</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
          {t('hero.subtitle')}
        </p>

        {/* Disclaimer */}
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto mb-8 italic">
          {t('hero.disclaimer')}
        </p>

        {/* CTA Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link to="/auth">
            <Button variant="default" size="lg">
              {t('hero.ctaPrimary')}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link to="/how-it-works">
            <Button variant="outline" size="lg">
              {t('hero.ctaSecondary')}
            </Button>
          </Link>
        </div>

        {/* Simple Feature List */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border">
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
            <span>Similarity Reports</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border">
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
            <span>Content Analysis</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border">
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
            <span>Secure Processing</span>
          </div>
        </div>

        {/* Service Description */}
        <div className="max-w-2xl mx-auto p-6 bg-card rounded-lg border border-border">
          <div className="flex items-center justify-center gap-2 mb-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">About This Service</span>
          </div>
          <p className="text-sm text-muted-foreground">
            PlagaiScans is a text similarity review and content analysis service. 
            We compare submitted documents against indexed sources and generate informational reports. 
            Reports are for reference only. Users are responsible for reviewing and interpreting results.
          </p>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
