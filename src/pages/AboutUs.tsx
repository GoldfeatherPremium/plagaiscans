import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Shield, Zap, Globe, Mail, ArrowLeft, Lock, Users, CheckCircle } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema, generateOrganizationSchema } from '@/components/SEO';

export default function AboutUs() {
  const features = [
    {
      icon: FileText,
      title: "Detailed Similarity Reports",
      description: "View highlighted matches, similarity percentages, and matched sources to understand how content overlaps with existing materials."
    },
    {
      icon: Shield,
      title: "AI Content Indicators",
      description: "Analyze text for potential AI-generated patterns to support responsible academic use. Advisory indicators, not definitive detection."
    },
    {
      icon: Zap,
      title: "Fast Processing",
      description: "Get detailed analysis reports in minutes, not hours. Our efficient system ensures quick turnaround times for all submissions."
    },
    {
      icon: Lock,
      title: "Privacy-First Architecture",
      description: "Your documents are processed securely and never stored permanently, reused, or shared with third parties."
    }
  ];

  const values = [
    {
      title: "Transparency",
      description: "Clear, understandable reports with honest representation of similarity findings."
    },
    {
      title: "Privacy",
      description: "Your documents remain confidential and are never indexed or shared."
    },
    {
      title: "Accuracy",
      description: "Reliable analysis backed by comprehensive source checking."
    },
    {
      title: "Usability",
      description: "Intuitive interface designed for students, researchers, and educators."
    }
  ];

  return (
    <>
      <SEO
        title="About Us"
        description="Learn about Plagaiscans, an academic integrity platform for plagiarism detection and similarity analysis. Operated by Goldfeather Prem Ltd, United Kingdom."
        keywords="about Plagaiscans, plagiarism detection company, academic integrity platform, Goldfeather Prem Ltd"
        canonicalUrl="/about-us"
        ogImage="/og-about.png"
        structuredData={{
          '@context': 'https://schema.org',
          '@graph': [
            generateOrganizationSchema(),
            generateWebPageSchema('About Us', 'Learn about Plagaiscans', '/about-us'),
          ],
        }}
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
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
              About <span className="gradient-text">Plagaiscans</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              An academic integrity platform designed to support plagiarism detection and similarity analysis for educational and research use.
            </p>
          </div>

          {/* Main About Content */}
          <Card className="mb-12">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
              <p className="text-muted-foreground mb-4">
                Plagaiscans is an academic integrity platform designed to support plagiarism detection and similarity analysis for educational and research use. Our system helps users understand content originality by highlighting overlapping text, source references, and similarity percentages in a clear and structured format.
              </p>
              <p className="text-muted-foreground">
                Plagaiscans prioritizes privacy, transparency, and usability—ensuring users can verify originality with confidence.
              </p>
            </CardContent>
          </Card>

          {/* Core Values */}
          <div className="mb-12">
            <h2 className="text-2xl font-display font-bold text-center mb-8">Our Core Values</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {values.map((value, index) => (
                <Card key={index}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-1">{value.title}</h3>
                        <p className="text-muted-foreground text-sm">{value.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {features.map((feature, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Company Info */}
          <Card className="mb-12">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Globe className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Company Information</h2>
                  <p className="text-muted-foreground">Operated by Goldfeather Prem Ltd</p>
                </div>
              </div>
              <p className="text-muted-foreground">
                Plagaiscans is a service operated by <strong>Goldfeather Prem Ltd</strong>, a company registered in the <strong>United Kingdom</strong>. We are committed to providing accurate, reliable, and confidential document analysis services while maintaining the highest standards of data security and privacy.
              </p>
            </CardContent>
          </Card>

          {/* Contact Section */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
              <p className="text-muted-foreground mb-6">
                Have questions about our services? We're here to help.
              </p>
              <div className="flex items-center justify-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                <a href="mailto:support@plagaiscans.com" className="text-primary hover:underline font-medium">
                  support@plagaiscans.com
                </a>
              </div>
              <p className="text-sm text-muted-foreground mt-6">
                Goldfeather Prem Ltd • United Kingdom
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
    </>
  );
}
