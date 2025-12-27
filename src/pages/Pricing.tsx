import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileCheck, ArrowLeft, CheckCircle, Zap, Shield, Clock, Info } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';

export default function Pricing() {
  const pricingPackages = [
    {
      name: "Starter",
      credits: 1,
      price: "$2",
      perCredit: "$2.00",
      features: [
        "1 document check",
        "Non-Repository check",
        "Similarity report",
        "AI detection report",
        "24-hour delivery",
      ],
      popular: false,
    },
    {
      name: "Standard",
      credits: 10,
      price: "$10",
      perCredit: "$1.00",
      features: [
        "10 document checks",
        "Non-Repository check",
        "Similarity reports",
        "AI detection reports",
        "Priority processing",
        "50% savings per credit",
      ],
      popular: true,
    },
  ];

  return (
    <>
      <SEO
        title="Pricing"
        description="Simple, transparent pricing for plagiarism detection. Pay per document with no hidden fees. Credits never expire. Starting at $2 per document check."
        keywords="plagiarism checker pricing, document check cost, academic integrity pricing, AI detection cost"
        canonicalUrl="/pricing"
        structuredData={generateWebPageSchema('Pricing', 'Simple, transparent pricing for plagiarism detection', '/pricing')}
      />
      <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container-width flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
              <FileCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg">PlagaiScans</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container-width px-4 py-16">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Pay only for what you use. No subscriptions required. Credits never expire.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-16 max-w-3xl mx-auto">
            {pricingPackages.map((pkg, index) => (
              <Card 
                key={index} 
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                  pkg.popular ? 'border-primary shadow-lg ring-2 ring-primary/20' : ''
                }`}
              >
                {pkg.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-sm font-semibold rounded-bl-lg">
                    Best Value
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl font-display">{pkg.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-5xl font-bold">{pkg.price}</span>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    {pkg.perCredit} per credit
                  </p>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3 mb-8">
                    {pkg.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth" className="block">
                    <Button className="w-full" variant={pkg.popular ? "default" : "outline"}>
                      Get Started
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Features Section */}
          <div className="mb-16">
            <h2 className="text-2xl font-display font-bold text-center mb-8">
              What's Included
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="text-center p-6">
                <Zap className="h-10 w-10 text-primary mx-auto mb-4" />
                <h3 className="font-bold mb-2">Fast Processing</h3>
                <p className="text-sm text-muted-foreground">
                  Most documents processed within 24 hours
                </p>
              </Card>
              <Card className="text-center p-6">
                <Shield className="h-10 w-10 text-primary mx-auto mb-4" />
                <h3 className="font-bold mb-2">Secure & Private</h3>
                <p className="text-sm text-muted-foreground">
                  Your documents are handled securely and can be deleted anytime
                </p>
              </Card>
              <Card className="text-center p-6">
                <Clock className="h-10 w-10 text-primary mx-auto mb-4" />
                <h3 className="font-bold mb-2">Credits Never Expire</h3>
                <p className="text-sm text-muted-foreground">
                  Use your credits whenever you need them
                </p>
              </Card>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mb-16">
            <h2 className="text-2xl font-display font-bold text-center mb-8">
              Frequently Asked Questions
            </h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <Card className="p-6">
                <h3 className="font-bold mb-2">What is a Non-Repository check?</h3>
                <p className="text-sm text-muted-foreground">
                  Your documents are checked for similarity without being stored in any permanent database. 
                  This means your content remains private and won't appear in future checks.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="font-bold mb-2">What payment methods do you accept?</h3>
                <p className="text-sm text-muted-foreground">
                  We accept all major credit/debit cards, PayPal, and select cryptocurrency options 
                  through our secure payment processor.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="font-bold mb-2">Can I get a refund?</h3>
                <p className="text-sm text-muted-foreground">
                  Yes! We offer a 14-day money-back guarantee on all purchases. 
                  See our <Link to="/refund-policy" className="text-primary hover:underline">Refund Policy</Link> for details.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="font-bold mb-2">How long does processing take?</h3>
                <p className="text-sm text-muted-foreground">
                  Most documents are processed within 24 hours. Priority processing is available 
                  with bulk credit packages.
                </p>
              </Card>
            </div>
          </div>

          {/* Disclaimer */}
          <Card className="bg-muted/50 border-muted">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  <strong>Disclaimer:</strong> This service is provided for informational and research purposes only. 
                  Results are based on algorithmic analysis and should be used as a reference tool. 
                  PlagaiScans does not guarantee any specific outcomes.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
    </>
  );
}