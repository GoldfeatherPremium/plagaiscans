import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Bot, Clock, Shield, ArrowRight, Sparkles, CheckCircle, Zap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SEO, generateOrganizationSchema, generateServiceSchema, generateSoftwareApplicationSchema } from "@/components/SEO";

const Landing = () => {
  const { user } = useAuth();

  const features = [
    {
      icon: FileText,
      title: "Detailed Similarity Reports",
      description: "View highlighted matches, similarity percentages, and matched sources to understand content overlap with existing materials",
    },
    {
      icon: Bot,
      title: "AI Content Indicators",
      description: "Analyze text for potential AI-generated patterns to support responsible academic use. Indicators are advisory, not definitive.",
    },
    {
      icon: Clock,
      title: "Fast Processing",
      description: "Get your detailed analysis reports back within minutes, not hours",
    },
    {
      icon: Shield,
      title: "Privacy-First Architecture",
      description: "Your documents are processed securely and never stored, reused, or shared",
    },
  ];

  const steps = [
    {
      number: "1",
      title: "Create Account",
      description: "Sign up with your email and password",
    },
    {
      number: "2",
      title: "Purchase Credits",
      description: "Buy credits to check your documents",
    },
    {
      number: "3",
      title: "Upload Document",
      description: "Upload your file (1 credit per document)",
    },
    {
      number: "4",
      title: "Get Reports",
      description: "Download similarity and AI indicator reports",
    },
  ];

  return (
    <>
      <SEO
        canonicalUrl="/"
        structuredData={{
          '@context': 'https://schema.org',
          '@graph': [generateOrganizationSchema(), generateServiceSchema(), generateSoftwareApplicationSchema()],
        }}
      />
      <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 group">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-display font-bold text-foreground">Plagaiscans</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/how-it-works" className="text-muted-foreground hover:text-foreground font-medium hidden md:block transition-colors duration-200 link-underline">
                How It Works
              </Link>
              <Link to="/faq" className="text-muted-foreground hover:text-foreground font-medium hidden md:block transition-colors duration-200 link-underline">
                FAQ
              </Link>
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground font-medium hidden sm:block transition-colors duration-200 link-underline">
                Pricing
              </Link>
              {user ? (
                <Link to="/dashboard">
                  <Button variant="hero" className="rounded-full px-6">
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth" className="text-muted-foreground hover:text-foreground font-medium transition-colors duration-200">
                    Login
                  </Link>
                  <Link to="/auth">
                    <Button variant="hero" className="rounded-full px-6">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section className="py-20 px-4 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-float" />
            <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
          </div>
          
          <div className="max-w-4xl mx-auto text-center page-enter">
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full border border-border mb-8 animate-fade-in hover:border-primary/30 transition-colors duration-300">
              <Sparkles className="w-4 h-4 text-primary animate-pulse-soft" />
              <span className="text-sm text-foreground/70">Trusted by 10,000+ academics & researchers</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground mb-4">
              Plagiarism & Similarity Check
              <br />
              <span className="gradient-text">
                for Academic Integrity
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Plagaiscans helps students, researchers, and educators verify originality, 
              identify overlapping content, and understand similarity results through clear reports.
            </p>

            {/* Features List */}
            <div className="inline-flex flex-wrap justify-center gap-4 mb-8 stagger-children">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border hover:border-secondary/50 transition-all duration-300">
                <CheckCircle className="w-4 h-4 text-secondary" />
                <span>Detailed Similarity Reports</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border hover:border-secondary/50 transition-all duration-300">
                <CheckCircle className="w-4 h-4 text-secondary" />
                <span>AI Content Indicators</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border hover:border-secondary/50 transition-all duration-300">
                <CheckCircle className="w-4 h-4 text-secondary" />
                <span>Privacy-First Scanning</span>
              </div>
            </div>

            {/* CTA Button */}
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/auth">
                <Button variant="hero" size="xl" className="rounded-full group">
                  Check Document
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/how-it-works">
                <Button variant="outline" size="xl" className="rounded-full">
                  How It Works
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
                Comprehensive Document Analysis
              </h2>
              <p className="text-muted-foreground text-lg">
                Professional similarity checking tools for students, researchers, and universities
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="group cursor-pointer hover:-translate-y-2 hover:shadow-xl hover:border-primary/30"
                >
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 px-4 bg-background">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
                How It Works
              </h2>
              <p className="text-muted-foreground text-lg">
                Get your document checked in four simple steps
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 stagger-children">
              {steps.map((step, index) => (
                <div key={index} className="text-center group">
                  <div className="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/30">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA to Pricing Section */}
        <section className="py-20 px-4 bg-background">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <Zap className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Pay per document with no hidden fees. Choose from one-time packages or subscription plans.
            </p>
            <Link to="/pricing">
              <Button variant="hero" size="xl" className="rounded-full group">
                View Pricing Plans
                <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 bg-muted/30">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
              Ready to Check Your Documents?
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Join thousands of users who trust Plagaiscans for accurate originality verification.
            </p>
            <Link to="/auth">
              <Button variant="hero" size="xl" className="rounded-full group">
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />

      <WhatsAppSupportButton />
    </div>
    </>
  );
};

export default Landing;
