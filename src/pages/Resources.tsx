import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ArrowLeft, ArrowRight, BookOpen, Lightbulb, GraduationCap, PenTool, Bot, Search } from 'lucide-react';
import Footer from '@/components/Footer';

export default function Resources() {
  const articles = [
    {
      icon: Search,
      title: "How Similarity Detection Works in Academic Writing",
      excerpt: "Learn how modern academic platforms analyze documents for similarity by comparing text against comprehensive databases of sources.",
      category: "Educational",
      readTime: "5 min read"
    },
    {
      icon: FileText,
      title: "Understanding Plagiarism Reports",
      excerpt: "A guide to interpreting similarity percentages, understanding matched sources, and using report insights to improve your writing.",
      category: "Guide",
      readTime: "7 min read"
    },
    {
      icon: GraduationCap,
      title: "Academic Integrity in Modern Education",
      excerpt: "Explore the importance of academic integrity, ethical scholarship, and how originality checking supports educational standards.",
      category: "Academic",
      readTime: "6 min read"
    },
    {
      icon: Bot,
      title: "AI Writing Indicators Explained",
      excerpt: "Understanding how AI content detection works, what indicators mean, and the importance of human judgment in reviewing results.",
      category: "Technology",
      readTime: "8 min read"
    },
    {
      icon: PenTool,
      title: "How to Improve Originality in Research",
      excerpt: "Practical tips for developing original ideas, proper paraphrasing techniques, and effective citation practices.",
      category: "Tips",
      readTime: "6 min read"
    },
    {
      icon: BookOpen,
      title: "Citation Best Practices for Academic Papers",
      excerpt: "Master the art of proper citation with guidelines for different citation styles and common mistakes to avoid.",
      category: "Guide",
      readTime: "5 min read"
    }
  ];

  const tips = [
    {
      title: "Start Early",
      description: "Give yourself time to properly research, write, and revise your work."
    },
    {
      title: "Take Clear Notes",
      description: "When researching, clearly distinguish between your ideas and sourced information."
    },
    {
      title: "Cite as You Write",
      description: "Add citations while writing rather than trying to add them all at the end."
    },
    {
      title: "Check Before Submitting",
      description: "Use originality checking tools to identify potential issues before final submission."
    }
  ];

  return (
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
        <div className="max-w-5xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
              Resources & <span className="gradient-text">Learning Center</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Educational articles, guides, and tips to help you understand academic integrity and improve your writing.
            </p>
          </div>

          {/* Articles Grid */}
          <div className="mb-16">
            <h2 className="text-2xl font-display font-bold mb-8">Featured Articles</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article, index) => (
                <Card key={index} className="group hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <article.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-medium text-primary">{article.category}</span>
                        <span className="text-xs text-muted-foreground ml-2">{article.readTime}</span>
                      </div>
                    </div>
                    <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-muted-foreground text-sm">{article.excerpt}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Quick Tips */}
          <Card className="mb-16 bg-muted/30">
            <CardContent className="p-8">
              <h2 className="text-2xl font-display font-bold mb-6 text-center">
                Quick Tips for Academic Writing
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {tips.map((tip, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Lightbulb className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{tip.title}</h3>
                      <p className="text-sm text-muted-foreground">{tip.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Understanding Similarity Section */}
          <Card className="mb-12">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Understanding Similarity in Academic Documents</h2>
              <p className="text-muted-foreground mb-4">
                Similarity in academic documents isn't inherently problematic. Properly cited quotes, common terminology, standard methodological descriptions, and referenced material will naturally show as matches. The key distinction is between properly attributed content and unattributed copying.
              </p>
              <p className="text-muted-foreground mb-4">
                When reviewing similarity reports, consider the context of each match. A high similarity percentage in a literature review section may be appropriate if sources are properly cited, while the same percentage in an analysis section might warrant closer examination.
              </p>
              <p className="text-muted-foreground">
                Modern similarity detection tools are designed to support the writing process, helping authors identify areas that may need additional citation or original development before final submission.
              </p>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Ready to Check Your Document?</h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Apply what you've learned and verify your document's originality with Plagaiscans.
              </p>
              <Link to="/auth">
                <Button variant="hero" size="lg" className="group">
                  Get Started
                  <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}