import { Upload, Search, FileCheck } from "lucide-react";

const HowItWorksStrip = () => {
  const steps = [
    {
      icon: Upload,
      step: "01",
      title: "Upload Document",
      desc: "Sign in and upload your file in a supported format (PDF, DOCX, TXT, and more).",
    },
    {
      icon: Search,
      step: "02",
      title: "Automated Scan",
      desc: "Your text is compared against indexed sources to identify potential overlap and content indicators.",
    },
    {
      icon: FileCheck,
      step: "03",
      title: "Get Your Report",
      desc: "Download a detailed report with similarity percentages, source matches, and analysis indicators.",
    },
  ];

  return (
    <section className="py-16 md:py-24">
      <div className="container-width section-padding">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
            How It Works
          </p>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            Three simple steps
          </h2>
          <p className="text-muted-foreground">
            From upload to report in just a few minutes.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((s, i) => (
            <div
              key={i}
              className="relative rounded-2xl bg-card border border-border p-6 md:p-8"
            >
              <div className="absolute top-6 right-6 text-4xl font-display font-bold text-muted/60">
                {s.step}
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-soft flex items-center justify-center mb-5">
                <s.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-display font-bold text-foreground mb-2">
                {s.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksStrip;
