import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { SEO, generateWebPageSchema } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Copy, Download, FileText, Sparkles, Shield, GraduationCap, Users, Loader2, ChevronDown, ChevronUp, ArrowRight, CheckCircle } from "lucide-react";

/** Simple word-level diff: highlights words in humanized text that differ from original */
function highlightDiff(original: string, humanized: string) {
  const origWords = original.trim().split(/\s+/);
  const humWords = humanized.trim().split(/\s+/);
  
  // Build a set of original words (lowercased) for quick lookup
  const origSet = new Set(origWords.map(w => w.toLowerCase().replace(/[.,!?;:'"()]/g, '')));
  
  return humWords.map((word, i) => {
    const clean = word.toLowerCase().replace(/[.,!?;:'"()]/g, '');
    const isChanged = clean.length > 2 && !origSet.has(clean);
    return (
      <span key={i}>
        {i > 0 ? ' ' : ''}
        {isChanged ? (
          <mark className="bg-primary/15 text-foreground rounded px-0.5">{word}</mark>
        ) : (
          word
        )}
      </span>
    );
  });
}

const MAX_WORDS = 1000;

const AIHumanizer = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [humanScore, setHumanScore] = useState<number | null>(null);
  const [mode, setMode] = useState("standard");
  const [increaseHumanScore, setIncreaseHumanScore] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const charCount = inputText.length;

  const handleHumanize = async () => {
    if (!inputText.trim()) {
      toast.error("Please paste some text to humanize.");
      return;
    }
    if (wordCount > MAX_WORDS) {
      toast.error(`Free usage is limited to ${MAX_WORDS} words. Please shorten your text.`);
      return;
    }

    setIsProcessing(true);
    setOutputText("");
    setHumanScore(null);

    try {
      const { data, error } = await supabase.functions.invoke("humanize-text", {
        body: { text: inputText, mode, increaseHumanScore },
      });

      if (error) {
        const message = typeof error === "object" && "message" in error ? error.message : "Something went wrong.";
        toast.error(message);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setOutputText(data.humanizedText || "");
      setHumanScore(data.estimatedHumanScore || null);
      toast.success("Text humanized successfully!");
    } catch (err) {
      toast.error("Failed to humanize text. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(outputText);
      toast.success("Copied to clipboard!");
    } catch {
      toast.error("Failed to copy.");
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([outputText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "humanized-text.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const faqs = [
    {
      q: "How does the AI Humanizer work?",
      a: "Our tool uses advanced AI to completely restructure your text — rewriting sentence patterns, varying length and rhythm, and adding natural human writing characteristics while keeping the original meaning intact.",
    },
    {
      q: "Is this tool free to use?",
      a: "Yes! Basic usage is 100% free for up to 1,000 words per request. For larger documents, consider upgrading to our premium service.",
    },
    {
      q: "Will my humanized text be detected as AI-generated?",
      a: "Our tool is optimized to significantly reduce AI detection scores. However, no tool can guarantee 100% undetectability. Results vary depending on the content and detection tool used.",
    },
    {
      q: "Which mode should I choose?",
      a: "Standard works for most content. Academic is ideal for essays and papers. Advanced provides stronger humanization. Creative is best for blog posts and storytelling content.",
    },
    {
      q: "Does this change the meaning of my text?",
      a: "No. The tool is designed to maintain the exact original meaning while restructuring how the content is expressed.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Free AI Humanizer Tool – Reduce AI Detection"
        description="Convert AI-generated text into human-like writing instantly. Free AI humanizer tool optimized to reduce AI detection scores."
        keywords="ai humanizer, humanize ai text, ai text converter, reduce ai detection, ai to human text, free ai humanizer"
        canonicalUrl="/ai-humanizer"
        structuredData={generateWebPageSchema(
          "Free AI Humanizer Tool",
          "Convert AI-generated text into human-like writing instantly.",
          "/ai-humanizer"
        )}
      />
      <Navigation />

      {/* Hero */}
      <section className="pt-28 pb-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Free AI Humanizer Tool
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Transform AI Text Into Natural Human Writing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Paste your AI-generated content and instantly get natural, human-like text optimized to reduce AI detection scores.
          </p>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="pb-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-4">
          {[
            { icon: Shield, label: "AI Detection Optimized" },
            { icon: GraduationCap, label: "Academic Submission Ready" },
            { icon: Users, label: "Used by Students & Professionals" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 text-sm text-muted-foreground">
              <Icon className="w-4 h-4 text-primary" />
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* Main Tool */}
      <section className="pb-16 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1">
              <label className="text-sm font-medium text-foreground mb-1.5 block">Humanization Mode</label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (Balanced)</SelectItem>
                  <SelectItem value="advanced">Advanced (Stronger)</SelectItem>
                  <SelectItem value="academic">Academic (Formal)</SelectItem>
                  <SelectItem value="creative">Creative (Engaging)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={increaseHumanScore} onCheckedChange={setIncreaseHumanScore} />
              <label className="text-sm text-muted-foreground">Increase Human Score</label>
            </div>
          </div>

          {/* Input */}
          <Card>
            <CardContent className="p-4">
              <Textarea
                placeholder="Paste your AI-generated content here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="min-h-[200px] border-0 shadow-none focus-visible:ring-0 resize-y text-base"
              />
              <div className="flex justify-between items-center mt-2 text-sm text-muted-foreground">
                <span>{charCount} characters</span>
                <span className={wordCount > MAX_WORDS ? "text-destructive font-medium" : ""}>
                  {wordCount} / {MAX_WORDS} words
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Humanize Button */}
          <div className="text-center">
            <Button
              variant="hero"
              size="xl"
              onClick={handleHumanize}
              disabled={isProcessing || !inputText.trim() || wordCount > MAX_WORDS}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Humanizing your content…
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Humanize Now
                </>
              )}
            </Button>
          </div>

          {/* Output */}
          {outputText && (
            <>
              {/* Human Score */}
              {humanScore !== null && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="flex-shrink-0 text-center">
                        <div className="w-20 h-20 rounded-full border-4 border-primary flex items-center justify-center bg-background">
                          <span className="text-2xl font-bold text-primary">{humanScore}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Estimated Human Score</p>
                      </div>
                      <div className="flex-1 w-full">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-5 h-5 text-primary" />
                          <h3 className="font-semibold text-foreground">Humanization Complete</h3>
                        </div>
                        <Progress value={humanScore} className="h-2 mb-3" />
                        <p className="text-sm text-muted-foreground">
                          This is an estimated score. To know the <strong>actual AI percentage</strong> detected by Turnitin, get your content officially scanned by our AI detection service.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-foreground">Humanized Output</h3>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopy}>
                        <Copy className="w-4 h-4" />
                        Copy
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDownloadTxt}>
                        <Download className="w-4 h-4" />
                        .txt
                      </Button>
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-foreground text-base leading-relaxed">
                    {highlightDiff(inputText, outputText)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <mark className="bg-primary/15 rounded px-1">Highlighted words</mark> indicate humanized changes from your original text.
                  </p>
                </CardContent>
              </Card>

              {/* CTA: Get Official AI Detection */}
              <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10">
                <CardContent className="p-6 text-center">
                  <Shield className="w-10 h-10 text-primary mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-foreground mb-2">
                    Want to Know the Actual AI Percentage?
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-lg mx-auto">
                    Get your content officially checked with Turnitin's AI detection. Know your exact AI score before submitting your work.
                  </p>
                  <Button
                    size="lg"
                    className="gap-2"
                    onClick={() => navigate(user ? '/dashboard/upload' : '/auth')}
                  >
                    Get Official AI Detection Report
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <p className="text-xs text-muted-foreground mt-3">
                    Starting from just 1 credit per scan · Instant results
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Check plagiarism CTA (always visible) */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 text-center">
              <FileText className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">Check Your Content with AI Detection</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Buy AI Scan credits to get your official Turnitin AI detection report and know your exact score.
              </p>
              <Button variant="outline" onClick={() => navigate(user ? '/dashboard/credits' : '/auth')}>
                Buy AI Scan Credits
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <Card key={i} className="cursor-pointer" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-foreground">{faq.q}</h3>
                    {openFaq === i ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  {openFaq === i && (
                    <p className="text-sm text-muted-foreground mt-3">{faq.a}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom marketing */}
      <section className="pb-16 px-4 text-center">
        <p className="text-sm text-muted-foreground">100% free basic usage · No login required · Optimized to reduce AI detection</p>
      </section>

      <Footer />
    </div>
  );
};

export default AIHumanizer;
