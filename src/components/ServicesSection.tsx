import { Globe, Smartphone, Paintbrush, TrendingUp, Database, Shield } from "lucide-react";

const services = [
  {
    icon: Globe,
    title: "Web Development",
    description: "Custom websites and web applications built with cutting-edge technologies for optimal performance.",
    price: "From $5,000",
  },
  {
    icon: Smartphone,
    title: "Mobile Apps",
    description: "Native and cross-platform mobile applications that deliver seamless user experiences.",
    price: "From $8,000",
  },
  {
    icon: Paintbrush,
    title: "UI/UX Design",
    description: "User-centered design that balances aesthetics with functionality and accessibility.",
    price: "From $3,000",
  },
  {
    icon: TrendingUp,
    title: "Digital Marketing",
    description: "Data-driven strategies to grow your online presence and reach your target audience.",
    price: "From $2,000/mo",
  },
  {
    icon: Database,
    title: "Backend Solutions",
    description: "Scalable server infrastructure and API development for complex applications.",
    price: "From $6,000",
  },
  {
    icon: Shield,
    title: "Security Audits",
    description: "Comprehensive security assessments to protect your digital assets and user data.",
    price: "From $2,500",
  },
];

const ServicesSection = () => {
  return (
    <section id="services" className="section-padding relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[100px]" />

      <div className="container-width relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-primary font-medium text-sm tracking-wider uppercase mb-4 block">
            Services
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6">
            What We
            <span className="gradient-text"> Offer</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Comprehensive digital solutions tailored to your business needs and goals.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div
              key={index}
              className="group p-8 rounded-2xl glass hover:bg-card/70 transition-all duration-500 border border-transparent hover:border-primary/20"
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-6 group-hover:glow-primary transition-all duration-500">
                <service.icon className="w-7 h-7 text-primary" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-display font-semibold mb-3">{service.title}</h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                {service.description}
              </p>

              {/* Price */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">{service.price}</span>
                <span className="text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn More →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
