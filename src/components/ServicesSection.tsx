import { FileText, Search, BookCheck, BarChart2, Shield, Clock } from "lucide-react";

const ServicesSection = () => {
  const services = [
    {
      icon: Search,
      title: "Similarity Reports",
      description: "View matched text segments, similarity percentages, and source references for your review.",
    },
    {
      icon: FileText,
      title: "Source References",
      description: "Reports include references to indexed sources where text matches are found.",
    },
    {
      icon: BookCheck,
      title: "Citation Review",
      description: "Review citation patterns in your documents as part of your content analysis process.",
    },
    {
      icon: BarChart2,
      title: "Content Indicators",
      description: "Advisory content analysis indicators for informational purposes — human interpretation required.",
    },
    {
      icon: Shield,
      title: "Secure Document Handling",
      description: "Documents are processed securely and can be deleted by users at any time.",
    },
    {
      icon: Clock,
      title: "Standard Processing",
      description: "Documents are typically processed within a few minutes of submission.",
    },
  ];

  return (
    <section id="services" className="py-16 md:py-24 bg-muted/40">
      <div className="container-width section-padding">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
            What You Get
          </p>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 text-foreground">
            Everything in your report
          </h2>
          <p className="text-muted-foreground">
            Tools to support your content review process — clear, secure, and straightforward.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((service, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-card border border-border hover:border-primary/40 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-primary-soft flex items-center justify-center mb-4">
                <service.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-display font-bold mb-2 text-foreground">
                {service.title}
              </h3>
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
