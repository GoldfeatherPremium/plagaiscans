import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "react-router-dom";

const FAQStrip = () => {
  const faqs = [
    {
      q: "What kind of report do I get?",
      a: "You receive a similarity report with matched text segments, source references, and content analysis indicators. Reports are advisory and intended to support manual review.",
    },
    {
      q: "How long does processing take?",
      a: "Most documents are processed within a few minutes. Times may vary depending on document length and current system load.",
    },
    {
      q: "Are my documents kept private?",
      a: "Yes. Documents are processed in a secure environment, never shared with other users, and can be deleted from your account at any time.",
    },
    {
      q: "What file formats are supported?",
      a: "We support common document formats including PDF, DOCX, TXT, RTF, HTML, and more. Each upload uses one credit per document.",
    },
    {
      q: "Do credits expire?",
      a: "Yes — each credit pack has a defined validity period that's clearly shown before purchase on the pricing page.",
    },
  ];

  return (
    <section className="py-16 md:py-24">
      <div className="container-width section-padding">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
              FAQ
            </p>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
              Frequently asked questions
            </h2>
            <p className="text-muted-foreground">
              Everything you need to know before getting started.
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((f, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border border-border rounded-xl bg-card px-5"
              >
                <AccordionTrigger className="text-left font-semibold text-foreground hover:no-underline py-4">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-4">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="text-center mt-8">
            <Link to="/faq" className="text-sm text-primary font-semibold hover:underline">
              View all questions →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQStrip;
