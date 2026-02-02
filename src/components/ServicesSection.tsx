import { FileText, Search, BookCheck, BarChart2, Shield, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

const ServicesSection = () => {
  const { t } = useTranslation('landing');

  const services = [
    {
      icon: Search,
      title: "Similarity Reports",
      description: "View matched text segments, similarity percentages, and source references to support your content review process.",
    },
    {
      icon: FileText,
      title: "Source References",
      description: "Reports include references to indexed sources where text matches are found, for your manual review.",
    },
    {
      icon: BookCheck,
      title: "Citation Review",
      description: "Review citation patterns in your documents as part of your content analysis process.",
    },
    {
      icon: BarChart2,
      title: "Content Indicators",
      description: "Reports include content analysis indicators for informational purposes. These indicators are advisory only and require human interpretation.",
    },
    {
      icon: Shield,
      title: "Secure Document Handling",
      description: "Documents are processed securely. Users may delete documents after processing. Documents are not shared with other users.",
    },
    {
      icon: Clock,
      title: "Standard Processing",
      description: "Documents are typically processed within a reasonable timeframe. Processing times may vary based on system load.",
    },
  ];

  return (
    <section id="services" className="section-padding">
      <div className="container-width">
        {/* Section Header */}
        <div className="max-w-2xl mb-12">
          <p className="text-sm text-muted-foreground mb-3">
            {t('services.title')}
          </p>
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 text-foreground">
            {t('services.subtitle')}
          </h2>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div
              key={index}
              className="p-6 rounded-lg bg-card border border-border"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center mb-4">
                <service.icon className="w-5 h-5 text-muted-foreground" />
              </div>

              {/* Content */}
              <h3 className="text-base font-display font-semibold mb-2 text-foreground">
                {service.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div className="mt-10">
          <p className="text-sm text-muted-foreground border-l-2 border-border pl-4 max-w-2xl">
            Reports are provided for informational purposes only. Results depend on available indexed sources. 
            Users are responsible for reviewing and interpreting all results.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
