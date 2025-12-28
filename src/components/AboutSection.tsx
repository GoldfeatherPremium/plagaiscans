import { Shield, FileSearch, BookOpen, Lock } from "lucide-react";
import { useSiteContent } from "@/hooks/useSiteContent";

const AboutSection = () => {
  const { get } = useSiteContent();

  const features = [
    {
      icon: FileSearch,
      titleKey: 'about_feature_1_title',
      descKey: 'about_feature_1_desc',
      titleFallback: 'Similarity Detection',
      descFallback: 'View highlighted matches, similarity percentages, and matched sources to understand content overlap.',
    },
    {
      icon: BookOpen,
      titleKey: 'about_feature_2_title',
      descKey: 'about_feature_2_desc',
      titleFallback: 'Citation & Reference Checks',
      descFallback: 'Support academic compliance by reviewing citation patterns and references.',
    },
    {
      icon: Shield,
      titleKey: 'about_feature_3_title',
      descKey: 'about_feature_3_desc',
      titleFallback: 'AI Content Indicators',
      descFallback: 'Analyze text for potential AI-generated patterns to support responsible academic use.',
    },
    {
      icon: Lock,
      titleKey: 'about_feature_4_title',
      descKey: 'about_feature_4_desc',
      titleFallback: 'Privacy-First Scanning',
      descFallback: 'Uploaded documents remain private and are processed securely.',
    },
  ];

  return (
    <section id="about" className="section-padding relative">
      <div className="container-width">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <span className="text-primary font-medium text-sm tracking-wider uppercase mb-4 block">
            {get('about_label', 'About Plagaiscans')}
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6">
            {get('about_title', 'Academic Integrity Platform for')}
            <span className="gradient-text"> {get('about_title_gradient', 'Originality Verification')}</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {get('about_paragraph_1', 'Plagaiscans is an academic integrity platform designed to support plagiarism detection and similarity analysis for educational and research use. Our system helps users understand content originality by highlighting overlapping text, source references, and similarity percentages in a clear and structured format.')}
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed mt-4">
            {get('about_paragraph_2', 'Plagaiscans prioritizes privacy, transparency, and usability—ensuring users can verify originality with confidence.')}
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
                {get(feature.titleKey, feature.titleFallback)}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {get(feature.descKey, feature.descFallback)}
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
