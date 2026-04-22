import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileCheck, ArrowLeft, CheckCircle, Zap, Shield, Clock, Info, Send, Loader2, RefreshCw, Crown, Sparkles, Lock, CheckCircle2 } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';
import { NoScriptFallback } from '@/components/NoScriptFallback';
import { toast } from 'sonner';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

const quoteSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  phone: z.string().trim().min(1, "Phone number is required").max(20),
  credits: z.number().min(20, "Minimum 20 credits for custom plan").max(10000),
});

interface PricingPackage {
  id: string;
  credits: number;
  price: number;
  package_type: string;
  billing_interval: string | null;
  validity_days: number | null;
  name: string | null;
  description: string | null;
  features: string[];
  is_most_popular?: boolean;
}

export default function Pricing() {
  const { t } = useTranslation('landing');
  const [quoteForm, setQuoteForm] = useState({
    name: '',
    email: '',
    phone: '',
    credits: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    const fetchPackages = async () => {
      const { data } = await supabase
        .from('pricing_packages')
        .select('*')
        .eq('is_active', true)
        .eq('is_special', false)
        .order('price', { ascending: true });
      
      if (data) {
        setPackages(data as PricingPackage[]);
      }
      setLoading(false);
    };
    fetchPackages();
  }, []);

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = quoteSchema.safeParse({
      ...quoteForm,
      credits: parseInt(quoteForm.credits) || 0,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    
    // Create WhatsApp message with quote details
    const message = `Hi! I'd like to request a custom quote.\n\nName: ${quoteForm.name}\nEmail: ${quoteForm.email}\nPhone: ${quoteForm.phone}\nCredits Needed: ${quoteForm.credits}`;
    const whatsappUrl = `https://wa.me/923224615aborar?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp
    window.open(whatsappUrl, '_blank');
    
    toast.success('Redirecting to WhatsApp for your custom quote request');
    setQuoteForm({ name: '', email: '', phone: '', credits: '' });
    setSubmitting(false);
  };

  return (
    <>
      <SEO
        title="Pricing Plans"
        description="Explore PlagaiScans credit packages starting from just $2.20. Choose a plan that fits your needs — ideal for editors, publishers, content agencies, businesses, and educational institutions."
        keywords="plagiarism checker pricing, plagaiscans pricing, credit packages, document analysis pricing, affordable plagiarism checker"
        canonicalUrl="/pricing"
        structuredData={generateWebPageSchema('Pricing', 'Credit packages for text similarity and AI content analysis', '/pricing')}
      />
      <NoScriptFallback
        title="Plagaiscans Pricing"
        intro="Pay-as-you-go credit packages for plagiarism and AI content detection. Each credit covers one document scan. Reports start from $3.99 with no subscription required."
      >
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>Plans</h2>
        <ul>
          <li><strong>Single report</strong> — $3.99 per document, one-time purchase.</li>
          <li><strong>Starter pack</strong> — small credit packs for occasional use.</li>
          <li><strong>Pro &amp; Business packs</strong> — larger credit packs at a lower per-report cost.</li>
          <li><strong>Custom plans</strong> — for institutions and high-volume teams (20+ credits). Request a quote on this page.</li>
        </ul>
        <p>
          All packs include AI content detection and similarity reports. Documents are not stored in any
          third-party repository. See our <a href="/refund-policy" style={{ color: '#2563eb' }}>refund policy</a>
          for the full 14-day refund terms.
        </p>
      </NoScriptFallback>
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
          {/* Check Before You Submit — hero */}
          <section className="relative mb-16 rounded-3xl overflow-hidden bg-gradient-to-br from-secondary/5 via-background to-primary/5 px-6 py-12 md:py-16">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-secondary/10 border border-secondary/20 mb-8">
                <Sparkles className="h-4 w-4 text-secondary" />
                <span className="text-[13px] font-bold tracking-wide uppercase text-secondary">
                  Official Turnitin Reports
                </span>
              </div>
              <h1 className="font-display font-bold tracking-tight leading-[1.05] text-[40px] sm:text-[56px] lg:text-[64px] text-foreground mb-6">
                Check Before You Submit
              </h1>
              <p className="text-[17px] sm:text-lg leading-relaxed text-muted-foreground max-w-2xl mx-auto mb-10">
                Get the <span className="font-semibold text-foreground">exact same report</span> your professor uses. AI detection + similarity analysis for just <span className="font-bold text-primary">$3.99</span>
              </p>

              {/* No Repository highlight card */}
              <div className="max-w-xl mx-auto rounded-2xl bg-secondary/5 border border-secondary/20 p-6 sm:p-8 mb-10">
                <div className="mx-auto h-14 w-14 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <Lock className="h-7 w-7 text-secondary-foreground" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-secondary mb-2">
                  No Repository = Zero Trace
                </h2>
                <p className="text-sm sm:text-base text-secondary/80">
                  Your paper is NOT stored. Submit to your university later with complete confidence.
                </p>
              </div>

              {/* Trust badges */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-w-md mx-auto text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span>Real Turnitin</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="h-5 w-5 text-primary shrink-0" />
                  <span>No Repository</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-5 w-5 text-primary shrink-0" />
                  <span>2-5 Min Results</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="h-5 w-5 text-primary shrink-0" />
                  <span>Zero Self-Plagiarism Risk</span>
                </div>
              </div>
            </div>
          </section>

          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              {t('pricing.title')}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('pricing.subtitle')}
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              {t('pricing.creditMeaning')}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Pricing Cards */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16 max-w-5xl mx-auto">
                {(() => {
                  const hasAdminPopular = packages.some(p => p.is_most_popular);
                  return packages.map((pkg, index) => {
                    const isPopular = hasAdminPopular
                      ? !!pkg.is_most_popular
                      : index === packages.length - 1;
                    const isSubscription = pkg.package_type === 'subscription';
                  
                  return (
                    <Card 
                      key={pkg.id} 
                      className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                        isPopular ? 'border-primary shadow-lg ring-2 ring-primary/20' : ''
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-sm font-semibold rounded-bl-lg">
                          {t('pricing.bestValue')}
                        </div>
                      )}
                      {isSubscription && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-green-500" />
                      )}
                      <CardHeader className="text-center pb-4">
                        <div className={`mx-auto h-12 w-12 rounded-xl flex items-center justify-center mb-2 ${
                          isSubscription ? 'bg-green-500/10' : 'bg-primary/10'
                        }`}>
                          {isSubscription ? (
                            <Crown className="h-5 w-5 text-green-600" />
                          ) : (
                            <Zap className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <CardTitle className="text-2xl font-display">
                          {pkg.name || `${pkg.credits} Credits`}
                        </CardTitle>
                        <div className="mt-4">
                          <span className={`text-5xl font-bold ${isSubscription ? 'text-green-600' : ''}`}>
                            ${pkg.price}
                          </span>
                          {isSubscription && (
                            <span className="text-muted-foreground text-sm">/{pkg.billing_interval || 'month'}</span>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-2">
                          {isSubscription 
                            ? `${pkg.credits} credits per ${pkg.billing_interval || 'month'}`
                            : `$${(pkg.price / pkg.credits).toFixed(2)} per credit`
                          }
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{t('pricing.creditMeaning')}</p>
                        {pkg.validity_days && (
                        <Badge variant="outline" className="mt-2 bg-amber-500/10 text-amber-600 border-amber-500/20">
                            <Clock className="h-3 w-3 mr-1" />
                            {t('pricing.validFor', { days: pkg.validity_days })}
                          </Badge>
                        )}
                      </CardHeader>
                      <CardContent className="pt-4">
                        <ul className="space-y-3 mb-8">
                          {pkg.features && pkg.features.length > 0 ? (
                            pkg.features.map((feature, featureIndex) => (
                              <li key={featureIndex} className="flex items-center gap-3">
                                <CheckCircle className={`w-5 h-5 flex-shrink-0 ${isSubscription ? 'text-green-500' : 'text-green-500'}`} />
                                <span className="text-muted-foreground">{feature}</span>
                              </li>
                            ))
                          ) : (
                            <>
                              <li className="flex items-center gap-3">
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <span className="text-muted-foreground">{pkg.credits} document checks</span>
                              </li>
                              <li className="flex items-center gap-3">
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <span className="text-muted-foreground">Non-Repository check</span>
                              </li>
                              <li className="flex items-center gap-3">
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <span className="text-muted-foreground">Similarity & AI reports</span>
                              </li>
                            </>
                          )}
                        </ul>
                        <Link to="/auth" className="block">
                          <Button className="w-full" variant={isPopular ? "default" : "outline"}>
                            {t('pricing.getStarted')}
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                  });
                })()}
              </div>
            </>
          )}

          {/* No Repository = Safe to Submit Later */}
          <section className="mb-16 max-w-3xl mx-auto">
            <Card className="border-secondary/20 bg-gradient-to-br from-secondary/5 to-primary/5 p-6 sm:p-10">
              <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center mb-6">
                <Lock className="h-7 w-7 text-secondary-foreground" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold mb-5 text-foreground leading-tight">
                No Repository = Safe to Submit Later
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-6">
                <span className="font-bold text-foreground">This is the key difference.</span> Your paper is NOT added to any database. Check your work here first, then submit to your university with complete confidence.
              </p>
              <ul className="space-y-3">
                {[
                  'Professor will never know you pre-checked',
                  'Zero self-plagiarism risk',
                  "Paper won't match against itself",
                  'Complete privacy guaranteed',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>


          <div className="mb-16">
            <h2 className="text-2xl font-display font-bold text-center mb-8">
              {t('pricing.features.title')}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="text-center p-6">
                <Zap className="h-10 w-10 text-primary mx-auto mb-4" />
                <h3 className="font-bold mb-2">{t('pricing.features.fast.title')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('pricing.features.fast.description')}
                </p>
              </Card>
              <Card className="text-center p-6">
                <Shield className="h-10 w-10 text-primary mx-auto mb-4" />
                <h3 className="font-bold mb-2">{t('pricing.features.secure.title')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('pricing.features.secure.description')}
                </p>
              </Card>
              <Card className="text-center p-6">
                <Clock className="h-10 w-10 text-primary mx-auto mb-4" />
                <h3 className="font-bold mb-2">{t('pricing.features.validity.title')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('pricing.features.validity.description')}
                </p>
              </Card>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mb-16">
            <h2 className="text-2xl font-display font-bold text-center mb-8">
              {t('pricing.faq.title')}
            </h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <Card className="p-6">
                <h3 className="font-bold mb-2">{t('pricing.faq.nonRepo.question')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('pricing.faq.nonRepo.answer')}
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="font-bold mb-2">{t('pricing.faq.payment.question')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('pricing.faq.payment.answer')}
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="font-bold mb-2">{t('pricing.faq.refund.question')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('pricing.faq.refund.answer')} <Link to="/refund-policy" className="text-primary hover:underline">{t('pricing.faq.refund.link')}</Link>
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="font-bold mb-2">{t('pricing.faq.processing.question')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('pricing.faq.processing.answer')}
                </p>
              </Card>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
    </>
  );
}