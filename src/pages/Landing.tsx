import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  FileText,
  Shield,
  Clock,
  Users,
  ArrowRight,
  Upload,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import {
  SEO,
  generateOrganizationSchema,
  generateServiceSchema,
  generateSoftwareApplicationSchema,
} from "@/components/SEO";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Landing = () => {
  const { user } = useAuth();
  const { t } = useTranslation("landing");

  const proFeatures = [
    {
      icon: Zap,
      title: t("pro.aiTitle"),
      desc: t("pro.aiDesc"),
      color: "bg-blue-100 text-blue-600",
    },
    {
      icon: FileText,
      title: t("pro.simTitle"),
      desc: t("pro.simDesc"),
      color: "bg-purple-100 text-purple-600",
    },
    {
      icon: Clock,
      title: t("pro.fastTitle"),
      desc: t("pro.fastDesc"),
      color: "bg-green-100 text-primary",
    },
  ];

  const aiBullets = t("report.aiBullets", { returnObjects: true }) as string[];
  const simBullets = t("report.simBullets", { returnObjects: true }) as string[];

  const trust = [
    { icon: Shield, title: t("trust.privacyTitle"), desc: t("trust.privacyDesc") },
    { icon: Zap, title: t("trust.accurateTitle"), desc: t("trust.accurateDesc") },
    { icon: Clock, title: t("trust.fastTitle"), desc: t("trust.fastDesc") },
    { icon: Users, title: t("trust.priceTitle"), desc: t("trust.priceDesc") },
  ];

  const faqs = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
    { q: t("faq.q5"), a: t("faq.a5") },
  ];

  return (
    <>
      <SEO
        canonicalUrl="/"
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            generateOrganizationSchema(),
            generateServiceSchema(),
            generateSoftwareApplicationSchema(),
          ],
        }}
      />
      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-display font-bold text-foreground">
                  PlagaiScans
                </span>
              </div>
              <div className="flex items-center gap-6">
                <Link
                  to="/how-it-works"
                  className="text-muted-foreground hover:text-foreground font-medium hidden md:block transition-colors duration-200"
                >
                  {t("nav.howItWorks")}
                </Link>
                <Link
                  to="/pricing"
                  className="text-muted-foreground hover:text-foreground font-medium hidden sm:block transition-colors duration-200"
                >
                  {t("nav.pricing")}
                </Link>
                {user ? (
                  <Link to="/dashboard">
                    <Button className="rounded-full px-6">{t("nav.dashboard")}</Button>
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/auth"
                      className="text-muted-foreground hover:text-foreground font-medium transition-colors duration-200"
                    >
                      {t("nav.login")}
                    </Link>
                    <Link to="/auth">
                      <Button className="rounded-full px-6">{t("nav.signUp")}</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>

        <main>
          {/* Hero */}
          <section className="pt-16 pb-12 px-4">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-xs font-semibold tracking-wide mb-8">
                {t("hero.badge")}
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold mb-6 leading-tight">
                <span className="text-muted-foreground">{t("hero.titleLine1")}</span>
                <br />
                <span className="text-primary">{t("hero.titleLine2")}</span>
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
                {t("hero.subtitle")}
              </p>

              {/* Upload card */}
              <Card className="border-2 border-dashed border-primary/40 bg-card max-w-2xl mx-auto">
                <CardContent className="p-8 sm:p-10 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                    <Upload className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-display font-semibold mb-2 text-foreground">
                    {t("hero.uploadTitle")}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                    {t("hero.uploadDesc")}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to="/auth" className="w-full sm:w-auto">
                      <Button size="lg" className="rounded-full w-full sm:w-auto">
                        {t("hero.signIn")}
                      </Button>
                    </Link>
                    <Link to="/auth" className="w-full sm:w-auto">
                      <Button
                        size="lg"
                        variant="outline"
                        className="rounded-full w-full sm:w-auto border-primary text-primary hover:bg-primary/5"
                      >
                        {t("hero.create")}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Know What Your Professor Will See */}
          <section className="py-16 px-4 bg-muted/40">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12 max-w-2xl mx-auto">
                <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4 text-foreground">
                  {t("pro.title")}
                </h2>
                <p className="text-muted-foreground">{t("pro.subtitle")}</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {proFeatures.map((f, i) => (
                  <Card key={i} className="border-border text-center">
                    <CardContent className="p-6">
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${f.color}`}
                      >
                        <f.icon className="w-7 h-7" />
                      </div>
                      <h3 className="text-lg font-display font-semibold mb-2 text-foreground">
                        {f.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {f.desc}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* What's in Your Full Report */}
          <section className="py-16 px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12 max-w-2xl mx-auto">
                <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4 text-foreground">
                  {t("report.title")}
                </h2>
                <p className="text-muted-foreground">{t("report.subtitle")}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Zap className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-display font-semibold text-foreground">
                        {t("report.aiTitle")}
                      </h3>
                    </div>
                    <ul className="space-y-3">
                      {aiBullets.map((b, i) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground">
                          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-display font-semibold text-foreground">
                        {t("report.simTitle")}
                      </h3>
                    </div>
                    <ul className="space-y-3">
                      {simBullets.map((b, i) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground">
                          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* Why Students Trust */}
          <section className="py-16 px-4 bg-muted/40">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
                  {t("trust.title")}
                </h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                {trust.map((tr, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <tr.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-display font-semibold mb-1 text-foreground">
                        {tr.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {tr.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Ready CTA */}
          <section className="py-16 px-4">
            <div className="max-w-3xl mx-auto">
              <Card className="border-2 border-primary/30 bg-primary/5">
                <CardContent className="p-8 sm:p-12 text-center">
                  <h2 className="text-2xl sm:text-3xl font-display font-bold mb-4 text-foreground">
                    {t("ready.title")}
                  </h2>
                  <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                    {t("ready.subtitle")}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to="/pricing" className="w-full sm:w-auto">
                      <Button size="lg" className="rounded-full w-full sm:w-auto">
                        {t("ready.pricing")}
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                    <Link to="/auth" className="w-full sm:w-auto">
                      <Button
                        size="lg"
                        variant="outline"
                        className="rounded-full w-full sm:w-auto border-primary text-primary hover:bg-primary/5"
                      >
                        {t("ready.create")}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* FAQ */}
          <section className="py-16 px-4 bg-muted/40">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-display font-bold mb-8 text-foreground text-center">
                {t("faq.title")}
              </h2>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((f, i) => (
                  <AccordionItem key={i} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left text-sm font-medium">
                      {f.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>
        </main>

        <Footer />
        <WhatsAppSupportButton />
      </div>
    </>
  );
};

export default Landing;
