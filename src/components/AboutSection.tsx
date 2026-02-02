import { Shield, FileSearch, BookOpen, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

const AboutSection = () => {
  const { t } = useTranslation('landing');

  const features = [
    {
      icon: FileSearch,
      titleKey: 'about.feature1Title',
      descKey: 'about.feature1Desc',
    },
    {
      icon: BookOpen,
      titleKey: 'about.feature2Title',
      descKey: 'about.feature2Desc',
    },
    {
      icon: Shield,
      titleKey: 'about.feature3Title',
      descKey: 'about.feature3Desc',
    },
    {
      icon: Lock,
      titleKey: 'about.feature4Title',
      descKey: 'about.feature4Desc',
    },
  ];

  return (
    <section id="about" className="section-padding relative">
      <div className="container-width">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <span className="text-primary font-medium text-sm tracking-wider uppercase mb-4 block">
            {t('about.label')}
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6">
            {t('about.title')}
            <span className="text-primary"> {t('about.titleGradient')}</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {t('about.paragraph1')}
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-4">
            {t('about.paragraph2')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 rounded-2xl glass hover:bg-card/70 transition-all duration-500 hover:-translate-y-1"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-display font-semibold mb-2">
                {t(feature.titleKey)}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t(feature.descKey)}
              </p>
            </div>
          ))}
        </div>

        {/* Large Text Marquee Effect */}
        <div className="mt-24 overflow-hidden">
          <div className="flex gap-8 text-6xl md:text-8xl lg:text-9xl font-display font-bold text-muted/20 whitespace-nowrap animate-gradient-shift">
            <span>SCAN</span>
            <span className="text-primary/20">•</span>
            <span>DETECT</span>
            <span className="text-secondary/20">•</span>
            <span>VERIFY</span>
            <span className="text-accent/20">•</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
