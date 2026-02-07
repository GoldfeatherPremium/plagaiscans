import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import ServicesSection from "@/components/ServicesSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";
import { SEO, generateOrganizationSchema, generateServiceSchema, generateSoftwareApplicationSchema } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Globe, Users, GraduationCap, Pen, Building2, FileText } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Index = () => {
  const whoItsFor = [
    { icon: GraduationCap, title: "Students", desc: "Verify originality before submission and identify areas that need proper citation." },
    { icon: Pen, title: "Writers & Freelancers", desc: "Ensure your content is original and free from unintentional similarity." },
    { icon: Users, title: "Educators", desc: "Review student submissions for text similarity and content analysis." },
    { icon: Building2, title: "Businesses", desc: "Protect your brand with original content across marketing and documentation." },
  ];

  const faqs = [
    { q: "How does the similarity check work?", a: "Upload your document, and our system compares it against indexed web sources and academic databases to identify text overlaps and provide a detailed report." },
    { q: "What file formats are supported?", a: "We support common document formats including PDF, DOCX, DOC, and TXT files." },
    { q: "How long does analysis take?", a: "Most documents are processed within minutes. Larger files may take slightly longer depending on size and complexity." },
    { q: "Is my document kept private?", a: "Yes. Your documents are processed securely and are not shared with third parties, added to any public database, or used to train AI models." },
    { q: "What payment methods do you accept?", a: "We accept all major credit and debit cards, Apple Pay, and Google Pay. All payments are securely processed by Paddle." },
    { q: "Can I get a refund?", a: "Yes, refund requests can be submitted within 7 days of purchase for eligible cases such as technical failures or duplicate charges. See our Refund Policy for details." },
  ];

  return (
    <>
      <SEO
        canonicalUrl="/"
        structuredData={{
          '@context': 'https://schema.org',
          '@graph': [generateOrganizationSchema(), generateServiceSchema(), generateSoftwareApplicationSchema()],
        }}
      />
      <div className="min-h-screen bg-background">
        <Navigation />
        <main>
          <HeroSection />
          <ServicesSection />
          <AboutSection />

          {/* Who It's For Section */}
          <section className="section-padding bg-background">
            <div className="container-width">
              <div className="max-w-2xl mb-12">
                <p className="text-sm text-muted-foreground mb-3">Who It's For</p>
                <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 text-foreground">
                  Built for professionals who value originality
                </h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {whoItsFor.map((item, i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-6">
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center mb-4">
                        <item.icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <h3 className="text-base font-display font-semibold mb-2 text-foreground">{item.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* Trust Badges Section */}
          <section className="section-padding bg-muted/30">
            <div className="container-width">
              <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border">
                  <Shield className="w-8 h-8 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Secure Payments</p>
                    <p className="text-xs text-muted-foreground">Processed by Paddle</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border">
                  <Lock className="w-8 h-8 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">GDPR Compliant</p>
                    <p className="text-xs text-muted-foreground">Your data is protected</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border">
                  <Globe className="w-8 h-8 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Advanced Detection</p>
                    <p className="text-xs text-muted-foreground">AI-powered analysis</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="section-padding bg-background">
            <div className="container-width">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl md:text-3xl font-display font-bold mb-8 text-foreground text-center">
                  Frequently Asked Questions
                </h2>
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq, i) => (
                    <AccordionItem key={i} value={`faq-${i}`}>
                      <AccordionTrigger className="text-left text-sm font-medium">{faq.q}</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
          </section>

          <ContactSection />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
