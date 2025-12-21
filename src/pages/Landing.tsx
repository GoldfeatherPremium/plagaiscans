import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileCheck,
  Shield,
  Zap,
  Clock,
  FileText,
  Bot,
  CheckCircle,
  ArrowRight,
  Star,
  Users,
  Award,
  Lock,
  Globe,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { WhatsAppSupportButton } from '@/components/WhatsAppSupportButton';

export default function Landing() {
  const { user } = useAuth();

  const features = [
    {
      icon: FileText,
      title: 'Turnitin Database Check',
      description: 'Documents checked against Turnitin\'s comprehensive database of billions of academic papers, journals, and web sources',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Bot,
      title: 'AI Content Detection',
      description: 'Advanced detection for AI-generated text from ChatGPT, Claude, Gemini, and other AI writing tools',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: Clock,
      title: 'Fast Processing',
      description: 'Get your detailed similarity and AI detection reports back within hours, not days',
      gradient: 'from-orange-500 to-amber-500',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your documents are encrypted, processed securely, and never shared with third parties',
      gradient: 'from-emerald-500 to-teal-500',
    },
  ];

  const steps = [
    { step: 1, title: 'Create Account', description: 'Sign up with your email and get started in seconds', icon: Users },
    { step: 2, title: 'Purchase Credits', description: 'Buy credits via crypto, Binance Pay, or manual transfer', icon: Zap },
    { step: 3, title: 'Upload Document', description: 'Upload your file - each document costs just 1 credit', icon: FileText },
    { step: 4, title: 'Get Reports', description: 'Download detailed similarity and AI detection reports', icon: FileCheck },
  ];

  const stats = [
    { value: '10K+', label: 'Documents Processed', icon: FileText },
    { value: '99.9%', label: 'Accuracy Rate', icon: CheckCircle },
    { value: '<2hrs', label: 'Average Turnaround', icon: Clock },
    { value: '24/7', label: 'Support Available', icon: Users },
  ];

  const testimonials = [
    {
      name: 'Dr. Sarah K.',
      role: 'University Professor',
      content: 'PlagaiScans has become an essential tool for checking student submissions. The Turnitin integration is seamless.',
      rating: 5,
    },
    {
      name: 'Ahmed M.',
      role: 'PhD Researcher',
      content: 'Fast, accurate, and affordable. I use it before every thesis submission to ensure originality.',
      rating: 5,
    },
    {
      name: 'Lisa T.',
      role: 'Content Writer',
      content: 'The AI detection feature helped me ensure my articles were flagged as human-written. Great service!',
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container-width section-padding py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-shadow">
              <FileCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl">PlagaiScans</span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Button asChild size="lg" className="rounded-full px-6">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild className="hidden sm:inline-flex">
                  <Link to="/auth">Login</Link>
                </Button>
                <Button asChild size="lg" className="rounded-full px-6 shadow-lg shadow-primary/25">
                  <Link to="/auth">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 section-padding overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[150px]" />
        </div>

        <div className="container-width">
          <div className="text-center max-w-4xl mx-auto">
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-card border border-border/50 shadow-lg mb-8 animate-fade-in">
              <div className="flex items-center gap-1">
                <Award className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Trusted by 10,000+ academics & researchers</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-[#1f4e79]">turnitin</span>
                <span className="text-[#d9534f] text-lg">®</span>
              </div>
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold mb-6 leading-tight animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Detect Plagiarism & AI
              <span className="block mt-2">
                <span className="gradient-text">With Confidence</span>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Professional document checking service powered by Turnitin's database. 
              Get accurate plagiarism and AI content detection reports in hours.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <Button size="lg" asChild className="rounded-full px-8 py-6 text-lg shadow-xl shadow-primary/25 hover:shadow-primary/40 transition-all">
                <Link to="/auth">
                  Start Checking Now <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="rounded-full px-8 py-6 text-lg">
                <a href="#how-it-works">
                  Learn More
                </a>
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              {stats.map((stat, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-card/50 backdrop-blur border border-border/50">
                  <stat.icon className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold font-display">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section-padding bg-muted/30 relative">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        
        <div className="container-width">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-1.5">
              <Sparkles className="h-3.5 w-3.5 mr-2" />
              Powerful Features
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4">
              Everything You Need
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Comprehensive document analysis powered by industry-leading technology
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="group border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 overflow-hidden">
                <CardHeader className="pb-4">
                  <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="section-padding">
        <div className="container-width">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-1.5">
              <Zap className="h-3.5 w-3.5 mr-2" />
              Simple Process
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Get your document checked in four simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((item, index) => (
              <div key={item.step} className="relative text-center group">
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary/30 to-transparent" />
                )}
                
                <div className="relative z-10">
                  <div className="h-24 w-24 rounded-3xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/25 group-hover:shadow-primary/40 transition-all group-hover:scale-105">
                    <item.icon className="h-10 w-10 text-primary-foreground" />
                  </div>
                  <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-secondary-foreground shadow-lg">
                    {item.step}
                  </div>
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section-padding bg-muted/30">
        <div className="container-width">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-1.5">
              <Star className="h-3.5 w-3.5 mr-2 fill-current" />
              Testimonials
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4">
              Loved by Academics
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              See what our users have to say about PlagaiScans
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-border/50">
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-foreground mb-6">"{testimonial.content}"</p>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-semibold text-primary">{testimonial.name[0]}</span>
                    </div>
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="section-padding">
        <div className="container-width">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-4 px-4 py-1.5">
                <Lock className="h-3.5 w-3.5 mr-2" />
                Security First
              </Badge>
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
                Your Documents Are Safe With Us
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                We take security seriously. Your documents are encrypted during upload and processing, 
                and are never stored or shared with anyone.
              </p>
              
              <div className="space-y-4">
                {[
                  { icon: Lock, text: 'End-to-end encryption' },
                  { icon: Shield, text: 'Non-repository processing' },
                  { icon: FileCheck, text: 'Documents deleted after processing' },
                  { icon: Globe, text: 'GDPR compliant' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-secondary" />
                    </div>
                    <span className="font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-3xl blur-3xl" />
              <div className="relative bg-card border border-border/50 rounded-3xl p-8 shadow-2xl">
                <div className="text-center">
                  <div className="h-20 w-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Shield className="h-10 w-10 text-primary-foreground" />
                  </div>
                  <h3 className="text-2xl font-display font-bold mb-2">100% Secure</h3>
                  <p className="text-muted-foreground mb-6">Your privacy is our priority</p>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                    <span>Trusted by universities worldwide</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding">
        <div className="container-width">
          <div className="relative overflow-hidden rounded-3xl">
            <div className="absolute inset-0 gradient-primary" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
            
            <div className="relative p-12 md:p-16 text-center text-primary-foreground">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4">
                Ready to Check Your Documents?
              </h2>
              <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
                Join thousands of academics and researchers who trust PlagaiScans 
                for accurate plagiarism and AI detection.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" variant="secondary" asChild className="rounded-full px-8 py-6 text-lg shadow-xl">
                  <Link to="/auth">
                    Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 section-padding py-12 bg-muted/20">
        <div className="container-width">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg">
                <FileCheck className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <span className="font-display font-bold text-lg">PlagaiScans</span>
                <p className="text-xs text-muted-foreground">Turnitin Powered Detection</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>© {new Date().getFullYear()} PlagaiScans</span>
              <span>•</span>
              <span>All rights reserved</span>
            </div>
          </div>
        </div>
      </footer>

      <WhatsAppSupportButton />
    </div>
  );
}