import { Zap, Palette, Code, Rocket } from "lucide-react";

const features = [
  {
    icon: Palette,
    title: "Creative Design",
    description: "Unique visual identities that make your brand unforgettable.",
  },
  {
    icon: Code,
    title: "Clean Code",
    description: "Performant, maintainable code built with modern technologies.",
  },
  {
    icon: Zap,
    title: "Fast Delivery",
    description: "Quick turnaround without compromising on quality.",
  },
  {
    icon: Rocket,
    title: "Growth Focused",
    description: "Strategies designed to scale with your business.",
  },
];

const AboutSection = () => {
  return (
    <section id="about" className="section-padding relative">
      <div className="container-width">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <span className="text-primary font-medium text-sm tracking-wider uppercase mb-4 block">
            About Us
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6">
            We're a team of
            <span className="gradient-text"> passionate creators</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            We blend creativity with technology to craft digital experiences that leave lasting impressions. Every pixel is purposeful, every interaction intentional.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-6 rounded-2xl glass hover:bg-card/70 transition-all duration-500"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-display font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Large Text Marquee Effect */}
        <div className="mt-24 overflow-hidden">
          <div className="flex gap-8 text-6xl md:text-8xl lg:text-9xl font-display font-bold text-muted/20 whitespace-nowrap animate-gradient-shift">
            <span>DESIGN</span>
            <span className="text-primary/20">•</span>
            <span>DEVELOP</span>
            <span className="text-secondary/20">•</span>
            <span>DELIVER</span>
            <span className="text-accent/20">•</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
