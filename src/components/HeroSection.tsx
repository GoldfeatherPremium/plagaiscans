import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const HeroSection = () => {
  const { t } = useTranslation('landing');

  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24">
      <div className="container-width section-padding">
        <div className="max-w-3xl">
          {/* Main Heading */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold leading-tight mb-6 text-foreground">
            Text Similarity Review and Content Analysis Service
          </h1>

          {/* Subtitle */}
          <p className="text-base text-muted-foreground max-w-2xl mb-6">
            {t('hero.subtitle')}
          </p>

          {/* Service Description */}
          <p className="text-sm text-muted-foreground max-w-2xl mb-8">
            Plagaiscans is a subscription-based software-as-a-service (SaaS) platform that provides text similarity and originality analysis. The service is designed to assist editors, educators, publishers, and content teams in reviewing written material.
          </p>

          {/* Disclaimer */}
          <p className="text-sm text-muted-foreground mb-8 border-l-2 border-border pl-4">
            Reports are informational only. Results depend on available indexed sources. Users are responsible for reviewing and interpreting all results.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Link to="/auth">
              <Button variant="default" size="lg">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/how-it-works">
              <Button variant="outline" size="lg">
                How It Works
              </Button>
            </Link>
          </div>

          {/* Simple Feature List */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Similarity reports with source references</p>
            <p>• Content analysis indicators</p>
            <p>• Secure document handling</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
