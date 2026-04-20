import { ArrowRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const HeroSection = () => {
  return (
    <section className="pt-16 pb-12 md:pt-24 md:pb-16">
      <div className="container-width section-padding">
        <div className="max-w-3xl mx-auto text-center">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold tracking-wide uppercase mb-6">
            Similarity Review • Secure Handling
          </div>

          {/* Main Heading */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-bold leading-[1.1] mb-5 text-foreground">
            <span className="text-muted-foreground/70">Submit Your Document</span>
            <br />
            <span className="text-primary">Get Your Full Analysis Report</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
            Upload your document and receive a detailed similarity report with source matches and content analysis indicators — all in one secure place.
          </p>

          {/* Upload-style centered card */}
          <div className="max-w-2xl mx-auto rounded-2xl border-2 border-dashed border-border bg-card p-8 md:p-12 mb-6">
            <div className="w-16 h-16 rounded-full bg-primary-soft flex items-center justify-center mx-auto mb-5">
              <Upload className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl md:text-2xl font-display font-bold text-foreground mb-2">
              Submit Your Document for Analysis
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Get a similarity report with source matches and content analysis indicators.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/auth" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto rounded-full px-8 font-semibold">
                  Sign In to Submit
                </Button>
              </Link>
              <Link to="/auth" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-full px-8 font-semibold border-primary text-primary hover:bg-primary-soft hover:text-primary">
                  Create Account
                </Button>
              </Link>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Reports are advisory and require human review. Documents are processed securely.
          </p>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
