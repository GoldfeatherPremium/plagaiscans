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
    question: "What is PlagaiScans and what does it do?",
    answer: "PlagaiScans is a text similarity review and content analysis service. We compare submitted documents against indexed sources and generate informational reports showing similarity indicators. These reports are provided for reference purposes only. Users are responsible for reviewing and interpreting results."
  },
  {
    question: "What file formats are supported?",
    answer: "We support common document formats including PDF, DOC, DOCX, TXT, and RTF. We recommend using PDF or DOCX for best results with formatting preservation."
  },
  {
    question: "How long does analysis take?",
    answer: "Most documents are processed within 24-48 hours. Processing time may vary based on document length, complexity, and current system load. You will receive a notification when your report is ready."
  },
  {
    question: "What sources are documents compared against?",
    answer: "Documents are compared against indexed academic papers, journals, publications, websites, and other online content. Coverage depends on available indexed sources and may not be exhaustive."
  },
  {
    question: "Are content analysis indicators provided?",
    answer: "Yes, reports include content analysis indicators to support your review process. These indicators are provided for informational purposes only and should not be considered definitive. Users are responsible for final interpretation."
  },
  {
    question: "Is uploaded content stored or shared?",
    answer: "Documents are stored securely during processing and made available for you to download reports. Documents are not shared with other users or added to any public database. You can delete your documents at any time after processing."
  },
  {
    question: "How do credits work?",
    answer: "Each document analysis uses one credit. Credits can be purchased in packages with defined validity periods. One credit covers one complete document analysis including similarity report and content indicators."
  },
  {
    question: "Do credits expire?",
    answer: "Yes, credits have validity periods as stated in each package (e.g., 30, 60, or 90 days from purchase). Check your package details for specific expiration dates. Expired credits are removed from your account."
  },
  {
    question: "What happens when credits expire?",
    answer: "Before expiration, you will receive email reminders. Expired credits are automatically removed from your account. We recommend using credits before the expiration date."
  },
  {
    question: "Can I get a refund for unused credits?",
    answer: "We offer a 14-day refund window from the date of purchase for unused credits. Submit a refund request and our team will review it within 24-48 hours. After 14 days, refunds may be considered for technical errors or duplicate charges."
  },
  {
    question: "What payment methods are accepted?",
    answer: "We accept credit/debit cards (Visa, Mastercard, American Express) and other payment methods through our payment processors. All payments are processed securely."
  },
  {
    question: "How should I interpret similarity percentages?",
    answer: "Similarity percentages indicate how much text matches indexed sources. A higher percentage does not automatically indicate a problem. Properly cited quotes and common terminology will show as matches. The key is ensuring proper attribution for matched content. Interpretation is your responsibility."
  },
  {
    question: "Is customer support available?",
    answer: "Yes, our support team is available to help with questions or issues. You can reach us via email at support@plagaiscans.com for assistance."
  },
  {
    question: "Are refunds automatic?",
    answer: "No, all refunds are reviewed and processed manually by our team. Submit a refund request through our support system, and we will respond within 24-48 hours."
  },
  {
    question: "What is this service NOT for?",
    answer: "This service is not designed to verify, approve, or certify content for academic or professional purposes. Reports do not guarantee acceptance by any institution. Users must not use this service to misrepresent work or facilitate academic misconduct."
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
        description="Find answers to frequently asked questions about PlagaiScans text similarity review service, credit packages, refunds, and document processing."
        keywords="FAQ, frequently asked questions, text similarity, content analysis, credit packages, refunds"
        canonicalUrl="/faq"
        ogImage="/og-faq.png"
        structuredData={faqSchema}
      />
      <div className="min-h-screen bg-background">
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
                {t('faq.backToHome')}
              </Button>
            </Link>
          </div>
        </nav>

        <main className="container-width px-4 py-16">
          <div className="max-w-3xl mx-auto">
            <Breadcrumb items={[{ label: 'FAQ' }]} />
            
            <div className="text-center mb-12">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
                <HelpCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
                {t('faq.title')} <span className="text-primary">{t('faq.titleHighlight')}</span>
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
                <Button variant="default">{t('faq.contactSupport')}</Button>
              </Link>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
