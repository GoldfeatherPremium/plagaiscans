import { FileText, Search, BookCheck, Bot, Shield, Zap } from "lucide-react";
import { useSiteContent } from "@/hooks/useSiteContent";

const ServicesSection = () => {
  const { get } = useSiteContent();

  const services = [
    {
      icon: Search,
      title: "Detailed Similarity Reports",
      description: "View highlighted matches, similarity percentages, and matched sources to understand how content overlaps with existing materials.",
      highlight: "Source Insights",
    },
    {
      icon: FileText,
      title: "Identify Overlapping Text",
      description: "Easily locate repeated or similar content and improve originality before submission.",
      highlight: "Improve Originality",
    },
    {
      icon: BookCheck,
      title: "Citation & Reference Checks",
      description: "Support academic compliance by reviewing citation patterns and references in your documents.",
      highlight: "Academic Compliance",
    },
    {
      icon: Bot,
      title: "AI-Content Detection Indicators",
      description: "Analyze text for potential AI-generated patterns to support responsible academic use. Indicators are advisory and should not be considered definitive.",
      highlight: "AI Detection",
    },
    {
      icon: Shield,
      title: "Privacy-First Plagiarism Scanning",
      description: "Uploaded documents remain private and are processed securely. Your data is never shared with third parties.",
      highlight: "Secure & Private",
    },
    {
      icon: Zap,
      title: "Fast & Reliable Processing",
      description: "Get your detailed reports back within minutes, not hours. Quick turnaround without compromising accuracy.",
      highlight: "Fast Results",
    },
  ];

  return (
    <section id="services" className="section-padding relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[100px]" />

      <div className="container-width relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-primary font-medium text-sm tracking-wider uppercase mb-4 block">
            {get('services_label', 'Features')}
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6">
            {get('services_title', 'Comprehensive Document')}
            <span className="gradient-text"> {get('services_title_gradient', 'Analysis')}</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            {get('services_subtitle', 'Professional plagiarism detection and similarity checking tools for students, researchers, and universities.')}
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {services.map((service, index) => (
            <div
              key={index}
              className="group p-8 rounded-2xl glass hover:bg-card/70 transition-all duration-500 border border-transparent hover:border-primary/20 hover:-translate-y-1"
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-all duration-500">
                <service.icon className="w-7 h-7 text-primary" />
              </div>

              {/* Content */}
              <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
                {service.highlight}
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">{service.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
