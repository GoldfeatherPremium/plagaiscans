import React from 'react';
import { Link } from 'react-router-dom';
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
    question: "Is this similar to traditional academic plagiarism tools?",
    answer: "Plagaiscans provides similarity analysis and originality insights designed to support academic integrity in a transparent and privacy-focused way. Our platform focuses on delivering clear, understandable reports with source attribution and actionable insights."
  },
  {
    question: "Does Plagaiscans detect AI-written content?",
    answer: "Our system provides AI-content indicators that help assess potential AI involvement in document writing. These are probability-based indicators that may suggest patterns consistent with AI-generated text."
  },
  {
    question: "Is my data stored or shared?",
    answer: "No. Your documents are processed securely and are not permanently stored, reused, or indexed. We prioritize privacy and data security. Files are analyzed and then removed from our systems after report generation."
  },
  {
    question: "What file formats are supported?",
    answer: "Plagaiscans supports common document formats including PDF, DOC, DOCX, TXT, and RTF. We recommend using PDF or DOCX for best results with formatting preservation."
  },
  {
    question: "How long does the analysis take?",
    answer: "Most documents are analyzed within minutes. Processing time may vary based on document length and complexity, but we prioritize fast turnaround without compromising accuracy."
  },
  {
    question: "What sources are checked for similarity?",
    answer: "Our system compares documents against billions of academic papers, journals, publications, websites, and other online content. This comprehensive coverage helps ensure thorough similarity detection."
  },
  {
    question: "Can I use this for thesis or dissertation checking?",
    answer: "Yes, Plagaiscans is well-suited for checking academic documents including theses, dissertations, research papers, essays, and other academic writing. Our detailed reports help identify areas that may need additional citation or paraphrasing."
  },
  {
    question: "How are credits used?",
    answer: "Each document check uses one credit. Credits can be purchased in packages, and they do not expire. One credit covers one complete document analysis including similarity report and AI content indicators."
  },
  {
    question: "What payment methods are accepted?",
    answer: "We accept various payment methods including credit/debit cards and cryptocurrency. Contact our support team for specific payment options available in your region."
  },
  {
    question: "Can I get a refund?",
    answer: "Please refer to our Refund Policy for detailed information about our refund terms and conditions. We aim to ensure customer satisfaction while maintaining fair usage policies."
  },
  {
    question: "Is there customer support available?",
    answer: "Yes, our support team is available to help with any questions or issues. You can reach us via email or WhatsApp for prompt assistance."
  }
];

export default function FAQ() {
  // Generate FAQ Schema
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
        description="Find answers to frequently asked questions about Plagaiscans plagiarism detection, AI content analysis, pricing, refunds, and document processing."
        keywords="FAQ, frequently asked questions, plagiarism checker help, AI detection FAQ, academic integrity questions"
        canonicalUrl="/faq"
        ogImage="/og-faq.png"
        structuredData={faqSchema}
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
        <div className="max-w-3xl mx-auto">
          <Breadcrumb items={[{ label: 'FAQ' }]} />
          
          {/* Header */}
          <div className="text-center mb-12">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-6">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
              Frequently Asked <span className="gradient-text">Questions</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Find answers to common questions about Plagaiscans and our academic integrity services.
            </p>
          </div>

          {/* FAQ Accordion */}
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

          {/* Contact CTA */}
          <div className="mt-12 text-center p-8 rounded-2xl bg-muted/30 border border-border">
            <h2 className="text-xl font-bold mb-2">Still have questions?</h2>
            <p className="text-muted-foreground mb-4">
              Our support team is ready to help you with any additional inquiries.
            </p>
            <Link to="/contact">
              <Button variant="hero">Contact Support</Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
    </>
  );
}