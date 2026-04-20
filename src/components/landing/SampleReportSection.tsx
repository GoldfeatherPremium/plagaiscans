import { FileText, AlertCircle, CheckCircle2 } from "lucide-react";

const SampleReportSection = () => {
  return (
    <section className="py-16 md:py-24 bg-muted/40">
      <div className="container-width section-padding">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div>
            <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
              Sample Report
            </p>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Know what's in every report
            </h2>
            <p className="text-muted-foreground mb-6">
              Each report gives you a clear similarity percentage, content analysis indicators, and references to matched sources — everything you need for an informed review.
            </p>
            <ul className="space-y-3">
              {[
                "Overall similarity percentage with breakdown",
                "Source URLs for matched content",
                "Sentence-level highlighting of overlap",
                "Content analysis indicators (advisory)",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: mock report card */}
          <div className="rounded-2xl bg-card border border-border shadow-lg p-6 md:p-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">research_paper.pdf</div>
                  <div className="text-xs text-muted-foreground">Analysed just now</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-primary-soft text-primary text-xs font-semibold">
                Complete
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl bg-muted/50 p-4">
                <div className="text-xs text-muted-foreground mb-1">Similarity</div>
                <div className="text-3xl font-display font-bold text-foreground">12%</div>
                <div className="h-1.5 rounded-full bg-border mt-2 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "12%" }} />
                </div>
              </div>
              <div className="rounded-xl bg-muted/50 p-4">
                <div className="text-xs text-muted-foreground mb-1">Content Indicator</div>
                <div className="text-3xl font-display font-bold text-foreground">8%</div>
                <div className="h-1.5 rounded-full bg-border mt-2 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "8%" }} />
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Top matched sources
              </div>
              {[
                { src: "journal.example.org/article-2143", pct: "4%" },
                { src: "academic-database.org/paper-9931", pct: "3%" },
                { src: "research-repo.net/study-557", pct: "2%" },
              ].map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                  <span className="text-foreground truncate mr-2">{m.src}</span>
                  <span className="text-primary font-semibold shrink-0">{m.pct}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Sample preview — actual reports vary by document and indexed sources.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SampleReportSection;
