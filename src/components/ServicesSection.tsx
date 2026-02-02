import { FileText, Search, BookCheck, BarChart2, Shield, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

const ServicesSection = () => {
  const { t } = useTranslation('landing');

  const services = [
    {
      icon: Search,
      title: "Similarity Reports",
      description: "View matched text segments, similarity percentages, and source references to support your content review process.",
      highlight: "Text Comparison",
    },
    {
      icon: FileText,
      title: "Source References",
      description: "Reports include references to indexed sources where text matches are found, for your manual review.",
      highlight: "Reference Review",
    },
    {
      icon: BookCheck,
      title: "Citation Review",
      description: "Review citation patterns in your documents as part of your content analysis process.",
      highlight: "Citation Support",
    },
    {
      icon: BarChart2,
      title: "Content Indicators",
      description: "Reports include content analysis indicators for informational purposes. These indicators are advisory only and require human interpretation.",
      highlight: "Advisory Indicators",
    },
    {
      icon: Shield,
      title: "Secure Document Handling",
      description: "Documents are processed securely. Users may delete documents after processing. Documents are not shared with other users.",
      highlight: "Secure Processing",
    },
    {
      icon: Clock,
      title: "Standard Processing",
      description: "Documents are typically processed within a reasonable timeframe. Processing times may vary based on system load.",
      highlight: "Processing",
    },
  ];

  return (
    <section id="services" className="section-padding relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-muted/20" />

      <div className="container-width relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-primary font-medium text-sm tracking-wider uppercase mb-4 block">
            {t('services.title')}
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
            {t('services.subtitle')}
          </h2>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div
              key={index}
              className="p-8 rounded-2xl bg-card border border-border"
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mb-6">
                <service.icon className="w-7 h-7 text-muted-foreground" />
              </div>

              {/* Content */}
              <div className="inline-block px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium mb-3">
                {service.highlight}
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">{service.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground italic max-w-2xl mx-auto">
            Reports are provided for informational purposes only. Results depend on available indexed sources. 
            Users are responsible for reviewing and interpreting all results.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
