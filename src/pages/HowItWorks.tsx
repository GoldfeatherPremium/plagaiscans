import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Upload, Search, Download, ArrowLeft, ArrowRight, CheckCircle, Shield, Clock, Play, Pause } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';
import { Breadcrumb } from '@/components/Breadcrumb';

// Animated Process Demo Component
function ProcessDemo() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  const demoSteps = [
    { label: "Upload Document", icon: Upload, color: "from-blue-500 to-cyan-500" },
    { label: "Analyzing Content", icon: Search, color: "from-purple-500 to-pink-500" },
    { label: "Generating Report", icon: FileText, color: "from-orange-500 to-amber-500" },
    { label: "Complete!", icon: CheckCircle, color: "from-green-500 to-emerald-500" },
  ];

  useEffect(() => {
    if (!isPlaying) return;

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setCurrentStep(step => (step + 1) % demoSteps.length);
          return 0;
        }
        return prev + 2;
      });
    }, 50);

    return () => clearInterval(progressInterval);
  }, [isPlaying, demoSteps.length]);

  const CurrentIcon = demoSteps[currentStep].icon;

  return (
    <Card className="mb-16 overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-gradient-to-br from-muted/50 to-muted p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Document Checking Process</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPlaying(!isPlaying)}
              className="gap-2"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? "Pause" : "Play"}
            </Button>
          </div>

          {/* Animation Container */}
          <div className="relative flex flex-col items-center justify-center py-12">
            {/* Animated Icon */}
            <div 
              className={`h-24 w-24 rounded-2xl bg-gradient-to-br ${demoSteps[currentStep].color} flex items-center justify-center mb-6 transition-all duration-500 animate-pulse-soft`}
            >
              <CurrentIcon className="h-12 w-12 text-white" />
            </div>

            {/* Step Label */}
            <p className="text-xl font-semibold mb-4 transition-all duration-300">
              {demoSteps[currentStep].label}
            </p>

            {/* Progress Bar */}
            <div className="w-full max-w-xs h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${demoSteps[currentStep].color} transition-all duration-100`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Step Indicators */}
          <div className="flex justify-center gap-3">
            {demoSteps.map((step, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentStep(index);
                  setProgress(0);
                }}
                className={`h-3 w-3 rounded-full transition-all duration-300 ${
                  index === currentStep 
                    ? 'bg-primary scale-125' 
                    : index < currentStep 
                      ? 'bg-primary/50' 
                      : 'bg-muted-foreground/30'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HowItWorks() {
  const steps = [
    {
      number: 1,
      icon: Upload,
      title: "Create Account & Upload",
      description: "Sign up with your email and upload your document. We support various file formats including PDF, DOC, DOCX, and TXT.",
      details: ["Create a free account", "Purchase credits as needed", "Upload your document securely"]
    },
    {
      number: 2,
      icon: Search,
      title: "Document Analysis",
      description: "Our system analyzes your document against billions of academic sources, publications, and web content to identify similarities.",
      details: ["Comprehensive source checking", "AI content pattern analysis", "Citation and reference review"]
    },
    {
      number: 3,
      icon: FileText,
      title: "Report Generation",
      description: "We generate a detailed report highlighting overlapping text, similarity percentages, and matched sources in a clear format.",
      details: ["Highlighted similarity matches", "Source attribution details", "Similarity percentage breakdown"]
    },
    {
      number: 4,
      icon: Download,
      title: "Download & Review",
      description: "Download your comprehensive PDF reports and review the findings to improve your document's originality.",
      details: ["Downloadable PDF reports", "Clear visual indicators", "Actionable improvement suggestions"]
    }
  ];

  const benefits = [
    {
      icon: Shield,
      title: "Privacy Protected",
      description: "Your documents are processed securely and never stored permanently or shared."
    },
    {
      icon: Clock,
      title: "Fast Processing",
      description: "Get your detailed analysis reports within minutes, not hours."
    },
    {
      icon: CheckCircle,
      title: "Accurate Results",
      description: "Advanced algorithms ensure thorough and reliable similarity detection."
    }
  ];

  return (
    <>
      <SEO
        title="How It Works"
        description="Learn how Plagaiscans works in 4 simple steps: create account, upload document, get analysis, and download reports. Fast, secure plagiarism detection."
        keywords="how plagiarism checker works, document analysis process, similarity detection steps"
        canonicalUrl="/how-it-works"
        structuredData={generateWebPageSchema('How It Works', 'Simple, transparent process to verify document originality', '/how-it-works')}
      />
      <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container-width flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg">Plagaiscans</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container-width px-4 py-8 md:py-16">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <Breadcrumb items={[{ label: 'How It Works' }]} />

          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
              How <span className="gradient-text">Plagaiscans</span> Works
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A simple, transparent process to verify document originality and maintain academic integrity.
            </p>
          </div>

          {/* Animated Demo */}
          <ProcessDemo />

          {/* Steps */}
          <div className="space-y-8 mb-20">
            {steps.map((step, index) => (
              <Card key={step.number} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    {/* Step Number */}
                    <div className="md:w-24 bg-primary/10 flex items-center justify-center p-6 md:p-0">
                      <span className="text-5xl font-display font-bold text-primary">{step.number}</span>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 p-6 md:p-8">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0">
                          <step.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                          <p className="text-muted-foreground mb-4">{step.description}</p>
                          <ul className="space-y-2">
                            {step.details.map((detail, i) => (
                              <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CheckCircle className="h-4 w-4 text-secondary shrink-0" />
                                {detail}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Benefits */}
          <div className="mb-16">
            <h2 className="text-3xl font-display font-bold text-center mb-10">
              Why Choose Plagaiscans?
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {benefits.map((benefit, index) => (
                <Card key={index} className="text-center">
                  <CardContent className="p-6">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
                      <benefit.icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">{benefit.title}</h3>
                    <p className="text-muted-foreground text-sm">{benefit.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Ready to Check Your Document?</h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Join thousands of students, researchers, and educators who trust Plagaiscans for accurate originality verification.
              </p>
              <Link to="/auth">
                <Button variant="hero" size="lg" className="group">
                  Get Started Now
                  <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
    </>
  );
}