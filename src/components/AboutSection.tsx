import { Shield, FileSearch, BookOpen, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

const AboutSection = () => {
  const { t } = useTranslation('landing');

  const features = [
    { icon: FileSearch, titleKey: 'about.feature1Title', descKey: 'about.feature1Desc' },
    { icon: BookOpen, titleKey: 'about.feature2Title', descKey: 'about.feature2Desc' },
    { icon: Shield, titleKey: 'about.feature3Title', descKey: 'about.feature3Desc' },
    { icon: Lock, titleKey: 'about.feature4Title', descKey: 'about.feature4Desc' },
  ];

  return (
    <section id="about" className="py-16 md:py-24">
      <div className="container-width section-padding">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
            Why PlagaiScans
          </p>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 text-foreground">
            {t('about.title')} {t('about.titleGradient')}
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            {t('about.paragraph1')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-card border border-border text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-primary-soft flex items-center justify-center mb-4 mx-auto">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-display font-bold mb-2 text-foreground">
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
