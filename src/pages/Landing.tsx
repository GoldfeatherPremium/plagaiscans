import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Bot, Clock, Shield, ArrowRight, Sparkles, CheckCircle, Zap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Landing = () => {
  const { user } = useAuth();

  const features = [
    {
      icon: FileText,
      title: "Similarity Detection",
      description: "Documents checked against billions of academic papers, websites, and publications worldwide",
    },
    {
      icon: Bot,
      title: "AI Content Detection",
      description: "Identify AI-generated text from ChatGPT, Claude, and other AI tools",
    },
    {
      icon: Clock,
      title: "Fast Processing",
      description: "Get your detailed reports back within minutes, not hours",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your documents are encrypted and never shared with third parties",
    },
  ];

  const steps = [
    {
      number: "1",
      title: "Create Account",
      description: "Sign up with your email, phone, and password",
    },
    {
      number: "2",
      title: "Purchase Credits",
      description: "Contact us on WhatsApp to buy credits",
    },
    {
      number: "3",
      title: "Upload Document",
      description: "Upload your file (1 credit per document)",
    },
    {
      number: "4",
      title: "Get Reports",
      description: "Download similarity and AI detection reports",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 group">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-display font-bold text-foreground">PlagaiScans</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#pricing" className="text-muted-foreground hover:text-foreground font-medium hidden sm:block transition-colors duration-200 link-underline">
                Pricing
              </a>
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
              <span className="text-sm text-muted-foreground">Trusted by 10,000+ academics & researchers</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground mb-4">
              Detect Plagiarism & AI Content
              <br />
              <span className="gradient-text">
                With Confidence
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Professional document analysis service for students, educators, and businesses. 
              Get detailed similarity and AI detection reports in minutes.
            </p>

            {/* Features List */}
            <div className="inline-flex flex-wrap justify-center gap-4 mb-8 stagger-children">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border hover:border-secondary/50 transition-all duration-300">
                <CheckCircle className="w-4 h-4 text-secondary" />
                <span>Advanced Similarity Detection</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border hover:border-secondary/50 transition-all duration-300">
                <CheckCircle className="w-4 h-4 text-secondary" />
                <span>AI Content Analysis</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card px-4 py-2 rounded-full border border-border hover:border-secondary/50 transition-all duration-300">
                <CheckCircle className="w-4 h-4 text-secondary" />
                <span>Detailed PDF Reports</span>
              </div>
            </div>

            {/* CTA Button */}
            <div>
              <Link to="/auth">
                <Button variant="hero" size="xl" className="rounded-full group">
                  Start Checking
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
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
                Our platform provides thorough checking to ensure document authenticity
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

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-4 bg-background">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-muted-foreground text-lg">
                Pay per document with no hidden fees. 1 credit = 1 document check
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              {/* Starter Package */}
              <Card className="relative hover:-translate-y-2 hover:shadow-xl transition-all duration-300">
                <CardHeader className="text-center pb-2">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground">Starter</CardTitle>
                  <p className="text-muted-foreground text-sm">Perfect for single documents</p>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-foreground">$2</span>
                    <span className="text-muted-foreground"> / 1 credit</span>
                  </div>
                  <ul className="space-y-3 text-sm text-muted-foreground mb-6">
                    <li className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary" />
                      <span>1 document check</span>
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary" />
                      <span>Non-Repository check</span>
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary" />
                      <span>Similarity report</span>
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary" />
                      <span>AI detection report</span>
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary" />
                      <span>PDF downloadable reports</span>
                    </li>
                  </ul>
                  <Link to="/auth">
                    <Button variant="outline" className="w-full rounded-full">
                      Get Started
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Value Package */}
              <Card className="relative border-2 border-primary shadow-lg hover:-translate-y-2 hover:shadow-xl transition-all duration-300">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full shadow-lg">
                    BEST VALUE
                  </span>
                </div>
                <CardHeader className="text-center pb-2">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Crown className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground">Value Pack</CardTitle>
                  <p className="text-muted-foreground text-sm">Best for multiple documents</p>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-foreground">$10</span>
                    <span className="text-muted-foreground"> / 10 credits</span>
                    <div className="text-secondary text-sm font-medium mt-1">Save $10!</div>
                  </div>
                  <ul className="space-y-3 text-sm text-muted-foreground mb-6">
                    <li className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary" />
                      <span>10 document checks</span>
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary" />
                      <span>Non-Repository check</span>
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary" />
                      <span>Similarity reports</span>
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary" />
                      <span>AI detection reports</span>
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary" />
                      <span>PDF downloadable reports</span>
                    </li>
                    <li className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-secondary" />
                      <span>Priority processing</span>
                    </li>
                  </ul>
                  <Link to="/auth">
                    <Button variant="hero" className="w-full rounded-full">
                      Get Started
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            <p className="text-center text-muted-foreground text-sm mt-8">
              Need more credits? Contact us on WhatsApp for custom packages.
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 bg-muted/30">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">
              Ready to Check Your Documents?
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Join thousands of users who trust PlagaiScans for accurate plagiarism and AI detection.
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
  );
};

export default Landing;
