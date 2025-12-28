import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ArrowLeft, ArrowRight, BookOpen, Lightbulb, GraduationCap, PenTool, Bot, Search, Scale, Globe } from 'lucide-react';
import Footer from '@/components/Footer';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Skeleton } from '@/components/ui/skeleton';
import { SEO, generateWebPageSchema } from '@/components/SEO';
import { Breadcrumb } from '@/components/Breadcrumb';

const articleMeta = [
  {
    slug: 'similarity-detection',
    contentKey: 'article_1',
    icon: Search,
    category: 'Educational',
    readTime: '5 min read',
    defaultTitle: 'How Similarity Analysis Supports Academic Integrity',
    defaultExcerpt: 'Learn how academic institutions use similarity analysis to support originality and responsible research practices.'
  },
  {
    slug: 'plagiarism-reports',
    contentKey: 'article_2',
    icon: FileText,
    category: 'Guide',
    readTime: '7 min read',
    defaultTitle: 'Understanding Similarity Reports',
    defaultExcerpt: 'A comprehensive guide to reading and interpreting similarity reports for academic documents.'
  },
  {
    slug: 'academic-integrity',
    contentKey: 'article_3',
    icon: GraduationCap,
    category: 'Academic',
    readTime: '6 min read',
    defaultTitle: 'Principles of Academic Integrity',
    defaultExcerpt: 'Understanding the foundations of honest scholarship and ethical academic writing practices.'
  },
  {
    slug: 'ai-writing-indicators',
    contentKey: 'article_4',
    icon: Bot,
    category: 'Technology',
    readTime: '8 min read',
    defaultTitle: 'Ethical Writing in the Age of AI',
    defaultExcerpt: 'Explore how to navigate AI tools responsibly while maintaining academic authenticity.'
  },
  {
    slug: 'improve-originality',
    contentKey: 'article_5',
    icon: PenTool,
    category: 'Tips',
    readTime: '6 min read',
    defaultTitle: 'Improving Originality in Research Work',
    defaultExcerpt: 'Practical strategies to enhance the originality of your academic writing and research.'
  },
  {
    slug: 'citation-best-practices',
    contentKey: 'article_6',
    icon: BookOpen,
    category: 'Guide',
    readTime: '5 min read',
    defaultTitle: 'Citation Best Practices',
    defaultExcerpt: 'Master the art of proper citation to strengthen your academic work and avoid unintentional plagiarism.'
  },
  {
    slug: 'interpreting-similarity-scores',
    contentKey: 'article_7',
    icon: Scale,
    category: 'Educational',
    readTime: '5 min read',
    defaultTitle: 'Interpreting Similarity Scores Correctly',
    defaultExcerpt: 'Learn what similarity percentages really mean and how to evaluate them in context.'
  },
  {
    slug: 'global-academic-standards',
    contentKey: 'article_8',
    icon: Globe,
    category: 'Academic',
    readTime: '7 min read',
    defaultTitle: 'Understanding Global Academic Standards',
    defaultExcerpt: 'How different institutions approach academic integrity and originality verification.'
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

export default function Resources() {
  const { get, loading } = useSiteContent();

  return (
    <>
      <SEO
        title="Resources & Learning Center"
        description="Educational articles, guides, and tips to help you understand academic integrity, plagiarism detection, and improve your writing skills."
        keywords="academic writing resources, plagiarism prevention tips, citation guides, academic integrity articles"
        canonicalUrl="/resources"
        structuredData={generateWebPageSchema('Resources & Learning Center', 'Educational articles and guides for academic writing', '/resources')}
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
      <main className="container-width px-4 py-8 md:py-16">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <Breadcrumb items={[{ label: 'Resources' }]} />

          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
              {loading ? (
                <Skeleton className="h-12 w-96 mx-auto" />
              ) : (
                <>
                  {get('resources_hero_title', 'Resources &').split('&')[0]}
                  <span className="gradient-text">{get('resources_hero_title', '& Learning Center').includes('&') ? get('resources_hero_title').split('&')[1] : 'Learning Center'}</span>
                </>
              )}
            </h1>
            {loading ? (
              <Skeleton className="h-6 w-full max-w-2xl mx-auto" />
            ) : (
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {get('resources_hero_subtitle', 'Educational articles, guides, and tips to help you understand academic integrity and improve your writing.')}
              </p>
            )}
          </div>

          {/* Articles Grid */}
          <div className="mb-16">
            <h2 className="text-2xl font-display font-bold mb-8">Featured Articles</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articleMeta.map((article) => {
                const title = get(`${article.contentKey}_title`, article.defaultTitle || 'Article');
                const excerpt = get(`${article.contentKey}_excerpt`, article.defaultExcerpt || '');
                const Icon = article.icon;

                return (
                  <Link key={article.slug} to={`/resources/${article.slug}`}>
                    <Card className="group hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <span className="text-xs font-medium text-primary">{article.category}</span>
                            <span className="text-xs text-muted-foreground ml-2">{article.readTime}</span>
                          </div>
                        </div>
                        {loading ? (
                          <>
                            <Skeleton className="h-6 w-full mb-2" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4 mt-1" />
                          </>
                        ) : (
                          <>
                            <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                              {title}
                            </h3>
                            <p className="text-muted-foreground text-sm line-clamp-3">{excerpt}</p>
                          </>
                        )}
                        <div className="flex items-center gap-1 mt-4 text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          Read article <ArrowRight className="h-4 w-4" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Quick Tips */}
          <Card className="mb-16 bg-muted/30">
            <CardContent className="p-8">
              <h2 className="text-2xl font-display font-bold mb-6 text-center">
                {get('resources_tips_title', 'Quick Tips for Academic Writing')}
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
              <h2 className="text-2xl font-bold mb-4">
                {get('resources_similarity_title', 'Understanding Similarity in Academic Documents')}
              </h2>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <div className="text-muted-foreground space-y-4">
                  {get('resources_similarity_content', `Similarity in academic documents isn't inherently problematic. Properly cited quotes, common terminology, standard methodological descriptions, and referenced material will naturally show as matches. The key distinction is between properly attributed content and unattributed copying.

When reviewing similarity reports, consider the context of each match. A high similarity percentage in a literature review section may be appropriate if sources are properly cited, while the same percentage in an analysis section might warrant closer examination.

Modern similarity detection tools are designed to support the writing process, helping authors identify areas that may need additional citation or original development before final submission.`).split('\n\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">
                {get('resources_cta_title', 'Ready to Check Your Document?')}
              </h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                {get('resources_cta_subtitle', "Apply what you've learned and verify your document's originality with Plagaiscans.")}
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
    </>
  );
}
