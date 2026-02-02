import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, ArrowLeft, GraduationCap, Briefcase, Edit, Building, AlertCircle } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';
import { useTranslation } from 'react-i18next';

export default function UseCases() {
  const { t } = useTranslation('landing');

  const useCases = [
    {
      icon: GraduationCap,
      title: "Students",
      description: "Students can use similarity reports to review their own work before submission. This tool helps identify areas that may need additional citation or rephrasing.",
      disclaimer: "Results are advisory and do not guarantee acceptance by any institution. This service does not verify or approve content for academic submission."
    },
    {
      icon: Briefcase,
      title: "Freelancers & Content Writers",
      description: "Freelance writers can check client deliverables against indexed web content to identify potential overlap before delivery.",
      disclaimer: "This is a reference tool, not a content approval system. Results should be reviewed alongside your own judgment."
    },
    {
      icon: Edit,
      title: "Content Editors",
      description: "Editorial teams can use similarity indicators as one part of their review process when evaluating content.",
      disclaimer: "Human review and judgment remain essential. Indicators are advisory only."
    },
    {
      icon: Building,
      title: "Agencies",
      description: "Marketing and content agencies can use this tool as part of internal quality checks when reviewing content.",
      disclaimer: "Results should be combined with manual review. This service does not certify content quality."
    }
  ];

  return (
    <>
      <SEO
        title="Use Cases"
        description="Learn how different users can benefit from PlagaiScans document analysis service. Use cases for students, freelancers, editors, and agencies."
        keywords="document analysis use cases, similarity checking, content review tool"
        canonicalUrl="/use-cases"
        structuredData={generateWebPageSchema('Use Cases', 'How different users can use our document analysis service', '/use-cases')}
      />
      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container-width flex h-16 items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-lg">PlagaiScans</span>
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
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
                Use Cases
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Our document analysis service can be used as a reference tool by various users. 
                Below are some common use cases and important considerations.
              </p>
            </div>

            {/* Important Disclaimer */}
            <Alert className="mb-12 border-border bg-muted/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Important:</strong> This service does not verify, approve, or certify content for any purpose. 
                Results are informational indicators only. Users are responsible for final decisions regarding their content.
              </AlertDescription>
            </Alert>

            {/* Use Cases Grid */}
            <div className="space-y-8 mb-16">
              {useCases.map((useCase, index) => (
                <Card key={index} className="border-border">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <useCase.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2">{useCase.title}</h3>
                        <p className="text-muted-foreground mb-4">{useCase.description}</p>
                        <p className="text-sm text-muted-foreground italic border-l-2 border-border pl-4">
                          {useCase.disclaimer}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Prohibited Uses */}
            <Card className="mb-12 border-destructive/30 bg-destructive/5">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">Prohibited Uses</h2>
                <p className="text-muted-foreground mb-4">
                  Users may not use this service to:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Facilitate academic misconduct or plagiarism</li>
                  <li>Represent reports as institutional approvals or certifications</li>
                  <li>Circumvent academic integrity requirements</li>
                  <li>Misrepresent report findings to third parties</li>
                </ul>
              </CardContent>
            </Card>

            {/* Bottom Disclaimer */}
            <div className="text-center text-sm text-muted-foreground mb-8">
              <p className="mb-4">
                This service does not verify, approve, or certify content for any purpose. 
                Results are informational indicators only. Users are responsible for final decisions.
              </p>
              <p>
                For questions about appropriate use, please contact our support team.
              </p>
            </div>

            {/* CTA */}
            <div className="text-center">
              <Link to="/auth">
                <Button size="lg" className="rounded-full">
                  Create Account
                </Button>
              </Link>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
