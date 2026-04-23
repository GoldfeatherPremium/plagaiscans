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
  Moon,
  Sun,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhatsAppSupportButton } from "@/components/WhatsAppSupportButton";
import Footer from "@/components/Footer";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import {
  SEO,
  generateOrganizationSchema,
  generateServiceSchema,
  generateSoftwareApplicationSchema,
} from "@/components/SEO";
import { NoScriptFallback } from "@/components/NoScriptFallback";
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

  const aiBulletsRaw = t("report.aiBullets", { returnObjects: true });
  const simBulletsRaw = t("report.simBullets", { returnObjects: true });
  const aiBullets = (Array.isArray(aiBulletsRaw) ? aiBulletsRaw : []) as string[];
  const simBullets = (Array.isArray(simBulletsRaw) ? simBulletsRaw : []) as string[];

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
    { q: t("faq.q7"), a: t("faq.a7") },
  ];

  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggleTheme = () => {
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    root.classList.toggle("dark", next);
    setIsDark(next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };

  return (
    <>
      <SEO
        title="Originality Verification for Editors, Publishers & Institutions"
        description="Plagaiscans is an originality verification and editorial integrity platform for editors, publishers, content agencies, and educational institutions. Similarity reports starting from $3.99 per report."
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
      <NoScriptFallback
        title="Plagaiscans — Plagiarism Checker & AI Content Detection"
        intro="Plagaiscans helps editors, publishers, content agencies, businesses, and educational institutions check submitted documents for similarity and AI-generated content before they publish or accept work. Reports start from $3.99, and documents are processed securely without being stored in any third-party repository."
      >
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>What you get</h2>
        <ul>
          <li>Detailed similarity reports with source matching</li>
          <li>AI content detection indicators</li>
          <li>Pay-as-you-go credit packages — no subscription required</li>
          <li>Fast turnaround and secure handling of your documents</li>
          <li>14-day refund policy</li>
        </ul>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>Get started</h2>
        <p>
          Visit our <a href="/pricing" style={{ color: '#2563eb' }}>pricing page</a> to choose a credit
          pack, or <a href="/contact" style={{ color: '#2563eb' }}>contact support</a> for help.
        </p>
      </NoScriptFallback>
      <div className="min-h-screen bg-background">
        {/* Minimal Top Nav */}
        <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-14">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center">
                  <FileText className="w-4 h-4 text-background" />
                </div>
                <span className="text-base font-display font-bold text-foreground sm:hidden">
                  PlagaiScans
                </span>
              </Link>

              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  to="/pricing"
                  className="hidden md:inline text-sm font-medium text-foreground/80 hover:text-foreground transition-colors mr-2"
                >
                  {t("nav.pricing")}
                </Link>
                <button
                  onClick={toggleTheme}
                  aria-label="Toggle theme"
                  className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-foreground transition-colors"
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                {user ? (
                  <Link to="/dashboard">
                    <Button size="sm" className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-4">
                      {t("nav.dashboard")}
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/auth"
                      className="hidden sm:inline text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
                    >
                      {t("nav.signIn")}
                    </Link>
                    <Link to="/auth">
                      <Button size="sm" className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-4">
                        {t("nav.getStarted")}
                      </Button>
                    </Link>
                  </>
                )}
                <Sheet>
                  <SheetTrigger asChild>
                    <button
                      aria-label="Open menu"
                      className="md:hidden w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center text-foreground"
                    >
                      <Menu className="w-5 h-5" />
                    </button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-64">
                    <div className="flex flex-col gap-5 mt-8 text-base font-medium">
                      <Link to="/how-it-works" className="text-foreground">
                        {t("nav.howItWorks")}
                      </Link>
                      <Link to="/use-cases" className="text-foreground">
                        {t("nav.useCases")}
                      </Link>
                      <Link to="/pricing" className="text-foreground">
                        {t("nav.pricing")}
                      </Link>
                      <Link to="/faq" className="text-foreground">
                        {t("nav.faq")}
                      </Link>
                      <Link to="/contact" className="text-foreground">
                        Contact
                      </Link>
                      {user ? (
                        <Link to="/dashboard">
                          <Button className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                            {t("nav.dashboard")}
                          </Button>
                        </Link>
                      ) : (
                        <>
                          <Link to="/auth" className="text-foreground">
                            {t("nav.signIn")}
                          </Link>
                          <Link to="/auth">
                            <Button className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                              {t("nav.signUp", { defaultValue: "Sign Up" })}
                            </Button>
                          </Link>
                        </>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </nav>

        <main>
          {/* Hero */}
          <section className="pt-12 sm:pt-20 pb-10 sm:pb-16 px-4">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-secondary text-secondary-foreground text-[13px] font-bold tracking-wide uppercase mb-6 font-sans">
                {t("hero.badge")}
              </div>

              <h1 className="font-sans font-bold tracking-tight leading-[1.05] text-[44px] sm:text-[56px] lg:text-[64px] mb-5">
                <span className="block text-gray-500 dark:text-gray-400">{t("hero.titleLine1")}</span>
                <span className="block text-primary">{t("hero.titleLine2")}</span>
              </h1>

              <p className="font-sans text-[17px] sm:text-[18px] leading-[1.6] text-gray-600 dark:text-gray-400 mb-10 max-w-xl mx-auto">
                Upload your document or paste text. Get the{" "}
                <span className="font-bold text-foreground">exact same report</span> your professor sees—AI detection and similarity scores included.
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

          {/* Why Teams Trust */}
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

          {/* Learn More Cross-Links */}
          <section className="py-12 px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-display font-bold mb-8 text-foreground text-center">
                {t("learnMore.title")}
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Link to="/ai-content-detection" className="group">
                  <Card className="border-border hover:border-primary/50 transition-colors h-full">
                    <CardContent className="p-6 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="text-base font-display font-semibold text-foreground">
                            {t("learnMore.aiTitle")}
                          </h3>
                          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {t("learnMore.aiDesc")}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                <Link to="/plagiarism-checker" className="group">
                  <Card className="border-border hover:border-primary/50 transition-colors h-full">
                    <CardContent className="p-6 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="text-base font-display font-semibold text-foreground">
                            {t("learnMore.simTitle")}
                          </h3>
                          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {t("learnMore.simDesc")}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
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
