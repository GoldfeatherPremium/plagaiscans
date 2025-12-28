import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ArrowLeft, ArrowRight, Bot, AlertTriangle, Brain, BarChart, Info, Shield } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';
import { Breadcrumb } from '@/components/Breadcrumb';

export default function AIContentDetection() {
  const features = [
    {
      icon: Brain,
      title: "Pattern Analysis",
      description: "Our system analyzes writing patterns, sentence structures, and linguistic features that may indicate AI-assisted content generation."
    },
    {
      icon: BarChart,
      title: "Probability Indicators",
      description: "Receive probability-based indicators that suggest the likelihood of AI involvement in content creation, presented as advisory information."
    },
    {
      icon: Info,
      title: "Contextual Insights",
      description: "Understand which sections of your document may have been identified as potentially AI-generated with clear explanations."
    },
    {
      icon: Shield,
      title: "Privacy Protected",
      description: "Your documents are processed securely and are not stored or used for training purposes."
    }
  ];

  const pageSchema = generateWebPageSchema(
    'AI Content Detection',
    'Learn about AI content detection indicators and how to interpret them for academic documents.',
    '/ai-content-detection'
  );

  return (
    <>
      <SEO
        title="AI Content Detection"
        description="Understand AI content detection indicators for academic documents. Learn how AI writing analysis works and how to interpret probability-based results."
        keywords="AI content detection, AI writing detection, AI text analysis, academic writing analysis, content authenticity, writing verification"
        canonicalUrl="/ai-content-detection"
        ogImage="/og-ai-detection.png"
        structuredData={pageSchema}
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
            <Breadcrumb items={[{ label: 'AI Content Detection' }]} />
            
            {/* Hero Section */}
            <div className="text-center mb-16">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-6">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
                AI Content <span className="gradient-text">Detection Indicators</span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Understand how AI content analysis works and how to interpret probability-based indicators 
                to support academic review and writing authenticity.
              </p>
            </div>


            {/* How It Works */}
            <Card className="mb-12">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6 text-center">How AI Content Analysis Works</h2>
                <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
                  Our system uses pattern recognition to identify characteristics commonly associated with 
                  AI-generated text, providing indicators to assist in academic evaluation.
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-muted/30">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <feature.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Interpreting Results */}
            <Card className="mb-12">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6">Interpreting AI Detection Results</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-2">What the Indicators Show</h3>
                    <p className="text-muted-foreground">
                      AI detection results are presented as probability percentages, indicating the likelihood 
                      that content exhibits patterns associated with AI-generated text. These percentages are 
                      not measures of certainty but rather indicators for further review.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Factors That May Affect Results</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Technical or specialized vocabulary may sometimes be flagged</li>
                      <li>• Formal academic writing styles may show higher indicators</li>
                      <li>• Heavily edited or polished text may affect results</li>
                      <li>• Non-native English writing patterns may influence detection</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Recommended Approach</h3>
                    <p className="text-muted-foreground">
                      Use AI detection indicators as one part of a comprehensive review process. 
                      Consider the context, consult with instructors or advisors, and apply human judgment 
                      when evaluating academic work.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Best Practices */}
            <Card className="mb-12 bg-muted/30">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6">Best Practices for Academic Writing</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3">For Students & Researchers</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Develop your own voice and writing style</li>
                      <li>• Use AI tools responsibly and transparently</li>
                      <li>• Always cite sources and acknowledge assistance</li>
                      <li>• Review your institution&apos;s AI use policies</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-3">For Educators</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Use detection as one tool among many</li>
                      <li>• Communicate clear expectations about AI use</li>
                      <li>• Focus on learning outcomes over detection</li>
                      <li>• Consider context and individual circumstances</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">Analyze Your Document</h2>
                <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                  Get AI content indicators along with similarity analysis to support academic integrity in your writing.
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