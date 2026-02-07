import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileCheck, ArrowLeft } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';

export default function TermsAndConditions() {
  return (
    <>
      <SEO
        title="Terms of Service"
        description="Terms of Service for Plagaiscans text similarity and content analysis platform."
        keywords="terms of service, service agreement, user agreement"
        canonicalUrl="/terms-and-conditions"
        structuredData={generateWebPageSchema('Terms of Service', 'Service agreement and user responsibilities', '/terms-and-conditions')}
      />
      <div className="min-h-screen bg-background">
        <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container-width flex h-16 items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <FileCheck className="h-5 w-5 text-primary-foreground" />
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

        <main className="container-width px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-display font-bold mb-4">Terms of Service</h1>
            <p className="text-muted-foreground mb-8">Last updated: February 2026</p>

            <Card>
              <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
                <section className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">Terms of Service</h2>
                  <p className="text-muted-foreground">
                    By accessing and using Plagaiscans.com, you agree to comply with and be bound by these Terms of Service.
                  </p>
                </section>

                <section className="mb-8">
                  <p className="text-muted-foreground">
                    Plagaiscans.com provides an AI-powered plagiarism detection and content analysis service.
                  </p>
                </section>

                <section className="mb-8">
                  <p className="text-muted-foreground">
                    Users are responsible for any content they upload and must ensure they have the rights to use such content.
                  </p>
                </section>

                <section className="mb-8">
                  <p className="text-muted-foreground">
                    You agree not to misuse the service, attempt to reverse engineer, or use the platform for illegal activities.
                  </p>
                </section>

                <section className="mb-8">
                  <p className="text-muted-foreground">
                    All payments are processed securely through Paddle, our authorized payment partner.
                  </p>
                </section>

                <section className="mb-8">
                  <p className="text-muted-foreground">
                    For refund-related matters, please refer to our{' '}
                    <Link to="/refund-policy" className="text-primary hover:underline">Refund Policy</Link>.
                  </p>
                </section>

                <section className="mb-8">
                  <p className="text-muted-foreground">
                    We reserve the right to update these terms at any time.
                  </p>
                </section>

                <section>
                  <p className="text-muted-foreground">
                    If you have questions, contact us at{' '}
                    <a href="mailto:support@plagaiscans.com" className="text-primary hover:underline">
                      support@plagaiscans.com
                    </a>.
                  </p>
                </section>
              </CardContent>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
