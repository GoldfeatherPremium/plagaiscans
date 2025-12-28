import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ArrowLeft, ArrowRight, Search, Shield, Clock, FileCheck, Database, Lock } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateServiceSchema } from '@/components/SEO';
import { Breadcrumb } from '@/components/Breadcrumb';

export default function PlagiarismChecker() {
  const features = [
    {
      icon: Database,
      title: "Comprehensive Source Coverage",
      description: "Compare your documents against billions of academic papers, journals, publications, and web content for thorough similarity analysis."
    },
    {
      icon: FileCheck,
      title: "Detailed Similarity Reports",
      description: "Receive clear, easy-to-read reports highlighting overlapping content with source attribution and similarity percentages."
    },
    {
      icon: Clock,
      title: "Fast Processing",
      description: "Get your similarity analysis results within minutes, allowing you to review and improve your work efficiently."
    },
    {
      icon: Lock,
      title: "Privacy-First Approach",
      description: "Your documents are processed securely and never stored, reused, or added to any database."
    }
  ];

  const serviceSchema = generateServiceSchema();

  return (
    <>
      <SEO
        title="Plagiarism Checker"
        description="Check your academic documents for similarity and originality. Get detailed reports with source attribution to support academic integrity and ethical writing."
        keywords="plagiarism checker, similarity analysis, originality verification, academic writing review, document analysis, academic integrity"
        canonicalUrl="/plagiarism-checker"
        structuredData={serviceSchema}
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
        <main className="container-width px-4 py-16">
          <div className="max-w-5xl mx-auto">
            <Breadcrumb items={[{ label: 'Plagiarism Checker' }]} />
            
            {/* Hero Section */}
            <div className="text-center mb-16">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-6">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
                Academic <span className="gradient-text">Similarity Checker</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Verify the originality of your academic documents with comprehensive similarity analysis. 
                Support academic integrity through transparent and detailed reporting.
              </p>
            </div>

            {/* How It Works */}
            <Card className="mb-12">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6 text-center">How Similarity Analysis Works</h2>
                <div className="grid md:grid-cols-3 gap-8">
                  <div className="text-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <span className="text-xl font-bold text-primary">1</span>
                    </div>
                    <h3 className="font-semibold mb-2">Upload Document</h3>
                    <p className="text-sm text-muted-foreground">
                      Submit your document in PDF, DOC, DOCX, or TXT format for analysis.
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <span className="text-xl font-bold text-primary">2</span>
                    </div>
                    <h3 className="font-semibold mb-2">Analysis Process</h3>
                    <p className="text-sm text-muted-foreground">
                      Our system compares your content against billions of academic and web sources.
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <span className="text-xl font-bold text-primary">3</span>
                    </div>
                    <h3 className="font-semibold mb-2">Receive Report</h3>
                    <p className="text-sm text-muted-foreground">
                      Get a detailed similarity report with highlighted matches and source references.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Features */}
            <div className="mb-16">
              <h2 className="text-3xl font-display font-bold text-center mb-10">
                Key Features
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {features.map((feature, index) => (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0">
                          <feature.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                          <p className="text-muted-foreground text-sm">{feature.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Privacy Note */}
            <Card className="mb-12 bg-muted/30">
              <CardContent className="p-8">
                <div className="flex items-start gap-4">
                  <Shield className="h-8 w-8 text-primary shrink-0" />
                  <div>
                    <h2 className="text-xl font-bold mb-2">Your Privacy Matters</h2>
                    <p className="text-muted-foreground">
                      We prioritize your privacy and data security. Documents submitted for analysis are processed securely 
                      and are never stored permanently, shared with third parties, or added to any database. 
                      Your academic work remains yours alone.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">Ready to Check Your Document?</h2>
                <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                  Verify your document&apos;s originality and support academic integrity with our comprehensive similarity analysis.
                </p>
                <Link to="/auth">
                  <Button variant="hero" size="lg" className="group">
                    Get Started
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