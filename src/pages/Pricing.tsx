import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileCheck, ArrowLeft, CheckCircle, Zap, Shield, Clock, Info, Send, Loader2, RefreshCw, Crown } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';
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
        title="Pricing"
        description="Credit packages for text similarity review and content analysis. Simple usage-based pricing with defined validity periods."
        keywords="document analysis pricing, credit packages, content review pricing"
        canonicalUrl="/pricing"
        structuredData={generateWebPageSchema('Pricing', 'Credit packages for text similarity review', '/pricing')}
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
              {t('pricing.title')}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('pricing.subtitle')}
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
                {packages.map((pkg, index) => {
                  const isPopular = index === packages.length - 1;
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
                })}
              </div>
            </>
          )}


          {/* Features Section */}
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

          {/* Disclaimer */}
          <Card className="bg-muted/50 border-muted">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  <strong>{t('pricing.disclaimer.label')}</strong> {t('pricing.disclaimer.text')}
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