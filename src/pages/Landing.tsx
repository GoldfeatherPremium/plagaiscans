import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Bot, Clock, Shield, ArrowRight, Sparkles, CheckCircle, Zap, Crown, Users, Globe, Star } from "lucide-react";
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
      gradient: "from-primary to-primary-glow",
    },
    {
      icon: Bot,
      title: "AI Content Detection",
      description: "Identify AI-generated text from ChatGPT, Claude, and other AI tools",
      gradient: "from-secondary to-secondary-glow",
    },
    {
      icon: Clock,
      title: "Fast Processing",
      description: "Get your detailed reports back within minutes, not hours",
      gradient: "from-accent to-accent-glow",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your documents are encrypted and never shared with third parties",
      gradient: "from-primary to-secondary",
    },
  ];

  const steps = [
    {
      number: "01",
      title: "Create Account",
      description: "Sign up with your email, phone, and password",
    },
    {
      number: "02",
      title: "Purchase Credits",
      description: "Contact us on WhatsApp to buy credits",
    },
    {
      number: "03",
      title: "Upload Document",
      description: "Upload your file (1 credit per document)",
    },
    {
      number: "04",
      title: "Get Reports",
      description: "Download similarity and AI detection reports",
    },
  ];

  const stats = [
    { value: "50K+", label: "Documents Checked", icon: FileText },
    { value: "10K+", label: "Happy Users", icon: Users },
    { value: "99.9%", label: "Accuracy Rate", icon: Star },
    { value: "24/7", label: "Support", icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 gradient-mesh pointer-events-none" />
      <div className="fixed inset-0 noise pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-18">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 group-hover:shadow-xl group-hover:shadow-primary/40 transition-all duration-300 group-hover:scale-105">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold gradient-text hidden sm:block">PlagaiScans</span>
            </Link>
            <div className="flex items-center gap-4">
              <a href="#pricing" className="text-muted-foreground hover:text-foreground font-medium transition-colors hidden sm:block">
                Pricing
              </a>
              <a href="#features" className="text-muted-foreground hover:text-foreground font-medium transition-colors hidden md:block">
                Features
              </a>
              {user ? (
                <Link to="/dashboard">
                  <Button variant="hero" size="default">
                    Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth" className="text-muted-foreground hover:text-foreground font-medium transition-colors hidden sm:block">
                    Login
                  </Link>
                  <Link to="/auth">
                    <Button variant="hero" size="default">
                      Get Started
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative">
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center pt-16">
          {/* Animated orbs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse-glow" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/20 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: "1s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[150px] animate-morph" />

          <div className="relative z-10 max-w-5xl mx-auto px-4 text-center py-20">
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 glass rounded-full mb-8 animate-fade-in">
              <Sparkles className="w-4 h-4 text-primary animate-pulse-soft" />
              <span className="text-sm font-medium text-muted-foreground">Trusted by 10,000+ academics & researchers</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6 animate-fade-in stagger-1">
              Detect Plagiarism & AI
              <br />
              <span className="gradient-text-animated">With Confidence</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in stagger-2 leading-relaxed">
              Professional document analysis service for students, educators, and businesses. 
              Get detailed similarity and AI detection reports in minutes.
            </p>

            {/* Features List */}
            <div className="flex flex-wrap justify-center gap-4 mb-10 animate-fade-in stagger-3">
              {["Advanced Similarity Detection", "AI Content Analysis", "Detailed PDF Reports"].map((feature, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20">
                  <CheckCircle className="w-4 h-4 text-secondary" />
                  <span className="text-sm font-medium">{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in stagger-4">
              <Link to="/auth">
                <Button variant="hero" size="xl" className="group min-w-[200px]">
                  Start Checking
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a href="#features">
                <Button variant="glass" size="xl" className="min-w-[200px]">
                  Learn More
                </Button>
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mt-20 animate-fade-in stagger-5">
              {stats.map((stat, index) => (
                <div key={index} className="text-center group">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-3 group-hover:bg-primary/20 transition-colors">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-2xl md:text-3xl font-bold gradient-text mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float">
            <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
              <div className="w-1 h-2 bg-primary rounded-full animate-bounce-soft" />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-4 relative">
          <div className="max-w-6xl mx-auto">
            <div className="section-header animate-fade-in">
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
                Features
              </span>
              <h2 className="gradient-text">Comprehensive Document Analysis</h2>
              <p>Our platform provides thorough checking to ensure document authenticity</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="feature-card group animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className={`icon-container-primary mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold mb-3 group-hover:text-primary transition-colors">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-24 px-4 relative bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="section-header">
              <span className="inline-block px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-semibold mb-4">
                Process
              </span>
              <h2>How It Works</h2>
              <p>Get your document checked in four simple steps</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {steps.map((step, index) => (
                <div 
                  key={index} 
                  className="relative text-center group animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-8 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
                  )}
                  <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary text-white font-bold text-lg mb-6 shadow-lg shadow-primary/30 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-primary/40 transition-all duration-300">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 px-4 relative">
          <div className="max-w-6xl mx-auto">
            <div className="section-header">
              <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
                Pricing
              </span>
              <h2>Simple, Transparent Pricing</h2>
              <p>Pay per document with no hidden fees. 1 credit = 1 document check</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              {/* Starter Package */}
              <Card className="relative overflow-hidden group hover:-translate-y-2 transition-all duration-500 animate-fade-in-up">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="text-center pb-2 relative">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                    <Zap className="w-7 h-7 text-primary group-hover:text-white transition-colors" />
                  </div>
                  <CardTitle className="text-xl font-bold">Starter</CardTitle>
                  <p className="text-muted-foreground text-sm">Perfect for single documents</p>
                </CardHeader>
                <CardContent className="text-center relative">
                  <div className="mb-6">
                    <span className="text-5xl font-bold">$2</span>
                    <span className="text-muted-foreground"> / 1 credit</span>
                  </div>
                  <ul className="space-y-3 text-sm mb-6">
                    {["1 document check", "Non-Repository check", "Similarity report", "AI detection report", "PDF downloadable reports"].map((item, i) => (
                      <li key={i} className="flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4 text-secondary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth" className="block">
                    <Button variant="outline" className="w-full">
                      Get Started
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Value Package */}
              <Card className="relative overflow-hidden border-2 border-primary shadow-xl shadow-primary/10 group hover:-translate-y-2 transition-all duration-500 animate-fade-in-up stagger-1">
                <div className="absolute -top-px left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary" />
                <div className="absolute top-4 right-4">
                  <span className="bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                    BEST VALUE
                  </span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-50" />
                <CardHeader className="text-center pb-2 relative">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30 group-hover:scale-110 transition-all duration-300">
                    <Crown className="w-7 h-7 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold">Value Pack</CardTitle>
                  <p className="text-muted-foreground text-sm">Best for multiple documents</p>
                </CardHeader>
                <CardContent className="text-center relative">
                  <div className="mb-6">
                    <span className="text-5xl font-bold gradient-text">$10</span>
                    <span className="text-muted-foreground"> / 10 credits</span>
                    <div className="text-secondary text-sm font-semibold mt-1">Save $10!</div>
                  </div>
                  <ul className="space-y-3 text-sm mb-6">
                    {["10 document checks", "Non-Repository check", "Similarity reports", "AI detection reports", "PDF downloadable reports", "Priority processing"].map((item, i) => (
                      <li key={i} className="flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4 text-secondary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth" className="block">
                    <Button variant="hero" className="w-full">
                      Get Started
                      <ArrowRight className="w-4 h-4" />
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
        <section className="py-24 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-secondary/20 rounded-full blur-[120px]" />
          
          <div className="relative max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
              Ready to Check Your Documents?
            </h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              Join thousands of users who trust PlagaiScans for accurate plagiarism and AI detection.
            </p>
            <Link to="/auth">
              <Button variant="hero" size="xl" className="group">
                Get Started Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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