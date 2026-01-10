import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FileText, ArrowLeft, HelpCircle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Footer from '@/components/Footer';
import { SEO } from '@/components/SEO';
import { Breadcrumb } from '@/components/Breadcrumb';

const faqData = [
  {
    question: "What is Plagaiscans and how does it work?",
    answer: "Plagaiscans is an academic integrity platform that analyzes documents for similarity against billions of academic sources, publications, and web content. Our system identifies overlapping text, provides similarity percentages, and generates clear reports to help users understand and improve document originality."
  },
  {
    question: "What file formats are supported?",
    answer: "Plagaiscans supports common document formats including PDF, DOC, DOCX, TXT, and RTF. We recommend using PDF or DOCX for best results with formatting preservation."
  },
  {
    question: "How long does the analysis take?",
    answer: "Most documents are analyzed within 24-48 hours. Processing time may vary based on document length, complexity, and current queue volume. You'll receive a notification when your report is ready."
  },
  {
    question: "What sources are checked for similarity?",
    answer: "Our system compares documents against billions of academic papers, journals, publications, websites, and other online content. This comprehensive coverage helps ensure thorough similarity detection."
  },
  {
    question: "Can this detect AI-generated writing?",
    answer: "Yes, our system provides AI-content indicators to assist evaluation. These indicators are provided to support academic review and should be used as guidance rather than definitive judgments."
  },
  {
    question: "Is uploaded content stored or shared?",
    answer: "Your documents are stored securely during processing and made available for you to download reports. Documents are not shared with other users or added to any public database. You can delete your documents anytime after processing."
  },
  // Credit and Payment FAQs
  {
    question: "How do credits work?",
    answer: "Each document check uses one credit. Credits can be purchased in one-time packages or through subscription plans. One credit covers one complete document analysis including similarity report and AI content indicators."
  },
  {
    question: "Do credits expire?",
    answer: "It depends on your package type. One-time purchased credits typically have a validity period (e.g., 30, 60, or 90 days from purchase). Subscription credits are renewed monthly as long as your subscription is active. Check your package details for specific expiration dates."
  },
  {
    question: "What happens when my credits expire?",
    answer: "Before expiration, you'll receive email and push notification reminders. Expired credits are automatically removed from your account. We recommend using your credits before the expiration date or renewing your package."
  },
  {
    question: "Can I get a refund for unused credits?",
    answer: "Yes! We offer a 14-day refund window from the date of purchase. If you haven't used any credits within this period, you're eligible for a full refund. Simply submit a refund request and our admin team will review it within 24-48 hours. After the 14-day window, refunds may still be considered for technical errors or duplicate charges."
  },
  // Subscription FAQs
  {
    question: "How do subscription plans work?",
    answer: "Subscription plans provide monthly credits at a discounted rate. Your credits are renewed automatically each billing cycle. You can cancel anytime, and your credits remain valid until the end of your billing period."
  },
  {
    question: "What happens when my subscription expires?",
    answer: "When your subscription ends, any remaining subscription credits will expire. You won't be charged further, but you'll need to purchase credits or resubscribe to continue using the service."
  },
  {
    question: "Can I change my subscription plan?",
    answer: "Yes, you can upgrade or downgrade your subscription at any time. Changes take effect at your next billing cycle. Contact support if you need immediate plan changes."
  },
  // Promo Code FAQs
  {
    question: "How do I use a promo code?",
    answer: "Enter your promo code during checkout before completing your purchase. Valid promo codes may provide bonus credits or percentage discounts on your purchase."
  },
  {
    question: "Can I combine multiple promo codes?",
    answer: "Only one promo code can be applied per transaction. Choose the code that provides the best value for your purchase."
  },
  // General FAQs
  {
    question: "What payment methods are accepted?",
    answer: "We accept credit/debit cards (Visa, Mastercard, American Express), cryptocurrency payments, and bank transfers in select regions. All payments are processed securely."
  },
  {
    question: "How do I interpret similarity percentages?",
    answer: "Similarity percentages indicate how much of your document matches other sources. A higher percentage isn't automatically problematic—properly cited quotes and common terminology will show as matches. The key is ensuring proper attribution for all matched content."
  },
  {
    question: "Is there customer support available?",
    answer: "Yes, our support team is available to help with any questions or issues. You can reach us via email at support@plagaiscans.com or through WhatsApp for prompt assistance."
  },
  {
    question: "Are refunds automatic?",
    answer: "No, all refunds are manually reviewed and processed by our admin team. This ensures fair handling of each request and prevents abuse. Submit a refund request through our support system, and we'll respond within 24-48 hours."
  }
];

export default function FAQ() {
  const { t } = useTranslation('landing');
  
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqData.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <>
      <SEO
        title="FAQ"
        description="Find answers to frequently asked questions about Plagaiscans plagiarism detection, AI content analysis, pricing, credits, subscriptions, and refunds."
        keywords="FAQ, frequently asked questions, plagiarism checker help, AI detection FAQ, academic integrity questions, credit expiration, subscription FAQ"
        canonicalUrl="/faq"
        ogImage="/og-faq.png"
        structuredData={faqSchema}
      />
      <div className="min-h-screen bg-background">
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
                {t('faq.backToHome')}
              </Button>
            </Link>
          </div>
        </nav>

        <main className="container-width px-4 py-16">
          <div className="max-w-3xl mx-auto">
            <Breadcrumb items={[{ label: 'FAQ' }]} />
            
            <div className="text-center mb-12">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-6">
                <HelpCircle className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
                {t('faq.title')} <span className="gradient-text">{t('faq.titleHighlight')}</span>
              </h1>
              <p className="text-lg text-muted-foreground">
                {t('faq.subtitle')}
              </p>
            </div>

            <Accordion type="single" collapsible className="space-y-4">
              {faqData.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="border border-border rounded-lg px-6 data-[state=open]:bg-muted/30"
                >
                  <AccordionTrigger className="text-left font-semibold hover:no-underline py-5">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-5">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="mt-12 text-center p-8 rounded-2xl bg-muted/30 border border-border">
              <h2 className="text-xl font-bold mb-2">{t('faq.stillHaveQuestions')}</h2>
              <p className="text-muted-foreground mb-4">
                {t('faq.supportTeamReady')}
              </p>
              <Link to="/contact">
                <Button variant="hero">{t('faq.contactSupport')}</Button>
              </Link>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
