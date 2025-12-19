import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileCheck,
  Shield,
  Zap,
  Clock,
  FileText,
  Bot,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { WhatsAppSupportButton } from '@/components/WhatsAppSupportButton';

export default function Landing() {
  const { user } = useAuth();

  const features = [
    {
      icon: FileText,
      title: 'Similarity Detection',
      description: 'Documents checked against Turnitin\'s database of billions of academic papers, websites, and publications',
    },
    {
      icon: Bot,
      title: 'AI Content Detection',
      description: 'Identify AI-generated text from ChatGPT, Claude, and other AI tools',
    },
    {
      icon: Clock,
      title: 'Fast Processing',
      description: 'Get your detailed reports back within hours, not days',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your documents are encrypted and never shared with third parties',
    },
  ];


  const steps = [
    { step: 1, title: 'Create Account', description: 'Sign up with your email, phone, and password' },
    { step: 2, title: 'Purchase Credits', description: 'Contact us on WhatsApp to buy credits' },
    { step: 3, title: 'Upload Document', description: 'Upload your file (1 credit per document)' },
    { step: 4, title: 'Get Reports', description: 'Download similarity and AI detection reports' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container-width section-padding py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center">
              <FileCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl">PlagaiScans</span>
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <Button asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Login</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 section-padding">
        <div className="container-width text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
            <Zap className="h-4 w-4" />
            Trusted by 10,000+ academics & researchers
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Detect Plagiarism & AI Content
            <span className="gradient-text block">With Confidence</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Professional document checking service for students, educators, and businesses. 
            Get detailed similarity and AI detection reports in hours.
          </p>
          
          {/* Turnitin Partnership Badge */}
          <div className="flex items-center justify-center gap-3 mb-8 animate-fade-in" style={{ animationDelay: '0.25s' }}>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
              <div className="flex items-center">
                <span className="text-lg font-bold text-[#1f4e79]">turnitin</span>
                <span className="text-[#d9534f] text-xl ml-0.5">®</span>
              </div>
              <span className="text-sm text-muted-foreground">Powered Database</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <Button size="lg" asChild>
              <Link to="/auth">
                Start Checking <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section-padding bg-muted/30">
        <div className="container-width">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Comprehensive Document Analysis
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Our platform provides thorough checking to ensure document authenticity
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-border hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section-padding">
        <div className="container-width">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Get your document checked in four simple steps
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((item) => (
              <div key={item.step} className="text-center">
                <div className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* CTA Section */}
      <section className="section-padding">
        <div className="container-width">
          <Card className="gradient-primary text-primary-foreground overflow-hidden">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
                Ready to Check Your Documents?
              </h2>
              <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
                Join thousands of users who trust PlagaiScans for accurate plagiarism and AI detection.
              </p>
              <Button size="lg" variant="secondary" asChild>
                <Link to="/auth">
                  Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border section-padding py-12">
        <div className="container-width">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <FileCheck className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold">PlagaiScans</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} PlagaiScans. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <WhatsAppSupportButton />
    </div>
  );
}