import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileCheck, ArrowLeft } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';

export default function RefundPolicy() {
  return (
    <>
      <SEO
        title="Refund Policy"
        description="Plagaiscans refund policy. We offer a 14-day refund policy for all purchases."
        keywords="refund policy, 14-day refund, cancellation"
        canonicalUrl="/refund-policy"
        structuredData={generateWebPageSchema('Refund Policy', 'Our 14-day refund policy', '/refund-policy')}
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
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl font-display font-bold mb-4">Refund Policy</h1>
            <p className="text-muted-foreground mb-8">Last updated: February 2026</p>

            <Card className="border-border">
              <CardContent className="p-8 prose prose-neutral dark:prose-invert max-w-none">
                <p className="text-foreground text-lg leading-relaxed">
                  We offer a <strong>14-day refund policy</strong> for all purchases made on Plagaiscans.com.
                </p>

                <p className="text-muted-foreground leading-relaxed mt-4">
                  If you are not satisfied with your purchase, you may request a full refund within 14 days 
                  of the original transaction date.
                </p>

                <p className="text-muted-foreground leading-relaxed mt-4">
                  To request a refund, please contact our support team at{' '}
                  <a href="mailto:support@plagaiscans.com" className="text-primary hover:underline">
                    support@plagaiscans.com
                  </a>{' '}
                  and include your order ID or payment receipt.
                </p>

                <p className="text-muted-foreground leading-relaxed mt-4">
                  Refunds will be processed back to the original payment method used for the purchase.
                </p>

                <p className="text-muted-foreground leading-relaxed mt-4">
                  This refund policy is provided in accordance with Paddle's Buyer Terms and applicable 
                  consumer protection laws.
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
