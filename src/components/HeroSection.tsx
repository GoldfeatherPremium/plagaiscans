import { ArrowRight, Sparkles, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useSiteContent } from "@/hooks/useSiteContent";
import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";

const HeroSection = () => {
  const { get, loading } = useSiteContent();
  const { t } = useTranslation('landing');
  const [scrollY, setScrollY] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (sectionRef.current) {
        const rect = sectionRef.current.getBoundingClientRect();
        // Only apply parallax when hero is visible
        if (rect.bottom > 0) {
          setScrollY(window.scrollY);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section ref={sectionRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Effects with Parallax */}
      <div className="absolute inset-0 will-change-transform">
        <div 
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse-glow"
          style={{ transform: `translateY(${scrollY * 0.3}px)` }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/20 rounded-full blur-[100px] animate-pulse-glow"
          style={{ transform: `translateY(${scrollY * 0.2}px)`, animationDelay: "1s" }}
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[150px]"
          style={{ transform: `translate(-50%, calc(-50% + ${scrollY * 0.15}px))` }}
        />
      </div>

      {/* Noise Overlay */}
      <div className="absolute inset-0 noise pointer-events-none" />

      {/* Grid Pattern with subtle parallax */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                           linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          transform: `translateY(${scrollY * 0.1}px)`,
        }}
      />

      <div className="relative z-10 container-width section-padding text-center">
        {/* Main Heading - H1 with primary keyword - Priority for LCP */}
        <h1 
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-display font-bold leading-[1.1] mb-6 animate-fade-in"
          style={{ contentVisibility: 'auto', containIntrinsicSize: '0 120px' }}
        >
          {t('hero.title1')}
          <br />
          <span className="gradient-text">{t('hero.title2')}</span>
        </h1>

        {/* Subtitle with SEO keywords */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          {t('hero.subtitle')}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <Link to="/auth">
            <Button variant="hero" size="xl" className="group">
              {t('hero.cta')}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>

        {/* Badge - Trusted by */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-10 animate-fade-in hover:border-primary/30 transition-colors duration-300" style={{ animationDelay: "0.25s" }}>
          <Sparkles className="w-4 h-4 text-primary animate-pulse-soft" />
          <span className="text-sm text-muted-foreground">
            {t('hero.badge')}
          </span>
        </div>

        {/* Feature Pills - Horizontal scroll with snap on mobile */}
        <div className="w-full overflow-x-auto pb-2 mb-14 animate-fade-in scrollbar-hide snap-x snap-mandatory md:overflow-visible" style={{ animationDelay: "0.3s" }}>
          <div className="flex md:flex-wrap md:justify-center gap-3 px-4 md:px-0 min-w-max md:min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border hover:border-secondary/50 transition-all duration-300 whitespace-nowrap snap-center">
              <CheckCircle className="w-4 h-4 text-secondary flex-shrink-0" />
              <span>{t('hero.feature1')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border hover:border-secondary/50 transition-all duration-300 whitespace-nowrap snap-center">
              <CheckCircle className="w-4 h-4 text-secondary flex-shrink-0" />
              <span>{t('hero.feature2')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border hover:border-secondary/50 transition-all duration-300 whitespace-nowrap snap-center">
              <CheckCircle className="w-4 h-4 text-secondary flex-shrink-0" />
              <span>{t('hero.feature3')}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-xl mx-auto animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <div className="text-center group">
            <div className="text-2xl md:text-3xl font-display font-bold gradient-text transition-transform duration-300 group-hover:scale-110">
              {t('hero.stat1Value')}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{t('hero.stat1Label')}</div>
          </div>
          <div className="text-center group">
            <div className="text-2xl md:text-3xl font-display font-bold gradient-text transition-transform duration-300 group-hover:scale-110">
              {t('hero.stat2Value')}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{t('hero.stat2Label')}</div>
          </div>
          <div className="text-center group">
            <div className="text-2xl md:text-3xl font-display font-bold gradient-text transition-transform duration-300 group-hover:scale-110">
              {t('hero.stat3Value')}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{t('hero.stat3Label')}</div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float">
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
          <div className="w-1 h-2 bg-primary rounded-full animate-pulse" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
