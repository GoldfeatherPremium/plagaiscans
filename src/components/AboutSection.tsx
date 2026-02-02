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
    <section id="about" className="section-padding bg-muted/30">
      <div className="container-width">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <p className="text-sm text-muted-foreground mb-3">
            About the Service
          </p>
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 text-foreground">
            {t('about.title')} {t('about.titleGradient')}
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            {t('about.paragraph1')}
          </p>
          <p className="text-base text-muted-foreground leading-relaxed mt-3">
            {t('about.paragraph2')}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-lg bg-card border border-border"
            >
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="text-base font-display font-semibold mb-2 text-foreground">
                {t(feature.titleKey)}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t(feature.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
