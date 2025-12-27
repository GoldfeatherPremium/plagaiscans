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
      {/* Subtle background */}
      <div className="fixed inset-0 gradient-mesh pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-display text-foreground">PlagaiScans</span>
            </Link>
            <div className="flex items-center gap-6">
              <a href="#pricing" className="text-muted-foreground hover:text-foreground font-medium transition-colors hidden sm:block">
                Pricing
              </a>
              <a href="#features" className="text-muted-foreground hover:text-foreground font-medium transition-colors hidden md:block">
                Features
              </a>
              {user ? (
                <Link to="/dashboard">
                  <Button variant="default" size="default">
                    Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth" className="text-muted-foreground hover:text-foreground font-medium transition-colors hidden sm:block">
                    Sign in
                  </Link>
                  <Link to="/auth">
                    <Button variant="default" size="default">
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
      <main className="relative">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center pt-16">
          <div className="max-w-6xl mx-auto px-4 py-24 lg:py-32">
            <div className="max-w-3xl">
              {/* Trust Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 border border-secondary/20 rounded-full mb-8 animate-fade-in">
                <Sparkles className="w-4 h-4 text-secondary" />
                <span className="text-sm font-medium text-secondary">Trusted by 10,000+ academics</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-display leading-[1.15] mb-6 animate-fade-in stagger-1">
                Detect Plagiarism
                <br />
                & AI Content
                <br />
                <span className="text-primary">With Confidence</span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-10 animate-fade-in stagger-2 leading-relaxed">
                Professional document analysis for students, educators, and businesses. 
                Get detailed similarity and AI detection reports in minutes.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-start gap-4 animate-fade-in stagger-3">
                <Link to="/auth">
                  <Button size="lg" className="group min-w-[180px]">
                    Start Checking
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button variant="outline" size="lg" className="min-w-[180px]">
                    Learn More
                  </Button>
                </a>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl mt-20 animate-fade-in stagger-4">
              {stats.map((stat, index) => (
                <div key={index} className="text-left">
                  <div className="text-3xl font-display text-foreground mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 animate-fade-in">
              <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
                Features
              </span>
              <h2 className="text-3xl sm:text-4xl font-display mb-4">Comprehensive Document Analysis</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Our platform provides thorough checking to ensure document authenticity</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="group bg-card rounded-xl border border-border p-6 hover:shadow-lg hover:border-primary/20 transition-all duration-300 animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                    <feature.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-semibold mb-4">
                Process
              </span>
              <h2 className="text-3xl sm:text-4xl font-display mb-4">How It Works</h2>
              <p className="text-muted-foreground text-lg">Get your document checked in four simple steps</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {steps.map((step, index) => (
                <div 
                  key={index} 
                  className="relative text-center animate-fade-in-up"
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-6 left-[60%] w-full h-px bg-border" />
                  )}
                  <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-display text-lg mb-5">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 px-4 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
                Pricing
              </span>
              <h2 className="text-3xl sm:text-4xl font-display mb-4">Simple, Transparent Pricing</h2>
              <p className="text-muted-foreground text-lg">Pay per document with no hidden fees. 1 credit = 1 document check</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Starter Package */}
              <Card className="relative group hover:shadow-lg transition-all duration-300 animate-fade-in-up">
                <CardHeader className="text-center pb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-display">Starter</CardTitle>
                  <p className="text-muted-foreground text-sm">Perfect for single documents</p>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-6">
                    <span className="text-4xl font-display">$2</span>
                    <span className="text-muted-foreground"> / 1 credit</span>
                  </div>
                  <ul className="space-y-3 text-sm mb-6 text-left">
                    {["1 document check", "Non-Repository check", "Similarity report", "AI detection report", "PDF downloadable reports"].map((item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-secondary flex-shrink-0" />
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
              <Card className="relative border-2 border-primary shadow-lg animate-fade-in-up stagger-1">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    BEST VALUE
                  </span>
                </div>
                <CardHeader className="text-center pb-4">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Crown className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-xl font-display">Value Pack</CardTitle>
                  <p className="text-muted-foreground text-sm">Best for multiple documents</p>
                </CardHeader>
                <CardContent className="text-center">
                  <div className="mb-6">
                    <span className="text-4xl font-display text-primary">$10</span>
                    <span className="text-muted-foreground"> / 10 credits</span>
                    <div className="text-secondary text-sm font-medium mt-1">Save $10!</div>
                  </div>
                  <ul className="space-y-3 text-sm mb-6 text-left">
                    {["10 document checks", "Non-Repository check", "Similarity reports", "AI detection reports", "PDF downloadable reports", "Priority processing"].map((item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle className="w-4 h-4 text-secondary flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth" className="block">
                    <Button className="w-full">
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2" />
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
        <section className="py-24 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-display mb-6">
              Ready to Check Your Documents?
            </h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
              Join thousands of users who trust PlagaiScans for accurate plagiarism and AI detection.
            </p>
            <Link to="/auth">
              <Button size="lg" className="group">
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
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