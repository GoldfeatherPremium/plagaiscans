import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ArrowLeft, ArrowRight, BookOpen, Lightbulb, GraduationCap, PenTool, Bot, Search, Clock, Tag } from 'lucide-react';
import Footer from '@/components/Footer';
import { useSiteContent } from '@/hooks/useSiteContent';
import { Skeleton } from '@/components/ui/skeleton';
import { SEO } from '@/components/SEO';
import { Breadcrumb } from '@/components/Breadcrumb';

const articleMeta = [
  {
    slug: 'similarity-detection',
    contentKey: 'article_1',
    icon: Search,
    category: 'Educational',
    readTime: '5 min read',
    color: 'from-blue-500/20 to-cyan-500/20'
  },
  {
    slug: 'plagiarism-reports',
    contentKey: 'article_2',
    icon: FileText,
    category: 'Guide',
    readTime: '7 min read',
    color: 'from-green-500/20 to-emerald-500/20'
  },
  {
    slug: 'academic-integrity',
    contentKey: 'article_3',
    icon: GraduationCap,
    category: 'Academic',
    readTime: '6 min read',
    color: 'from-purple-500/20 to-violet-500/20'
  },
  {
    slug: 'ai-writing-indicators',
    contentKey: 'article_4',
    icon: Bot,
    category: 'Technology',
    readTime: '8 min read',
    color: 'from-orange-500/20 to-amber-500/20'
  },
  {
    slug: 'improve-originality',
    contentKey: 'article_5',
    icon: PenTool,
    category: 'Tips',
    readTime: '6 min read',
    color: 'from-pink-500/20 to-rose-500/20'
  },
  {
    slug: 'citation-best-practices',
    contentKey: 'article_6',
    icon: BookOpen,
    category: 'Guide',
    readTime: '5 min read',
    color: 'from-indigo-500/20 to-blue-500/20'
  }
];

export default function Article() {
  const { slug } = useParams<{ slug: string }>();
  const { get, loading } = useSiteContent();

  const article = articleMeta.find(a => a.slug === slug);

  if (!article) {
    return <Navigate to="/resources" replace />;
  }

  const title = get(`${article.contentKey}_title`, 'Loading...');
  const content = get(`${article.contentKey}_content`, '');
  const Icon = article.icon;

  // Get related articles (exclude current)
  const relatedArticles = articleMeta
    .filter(a => a.slug !== slug)
    .slice(0, 3);

  // Generate article schema
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "articleSection": article.category,
    "publisher": {
      "@type": "Organization",
      "name": "PlagaiScans",
      "url": "https://plagaiscans.com"
    }
  };

  return (
    <>
      <SEO
        title={loading ? 'Loading...' : title}
        description={`Learn about ${title.toLowerCase()}. ${article.category} article from PlagaiScans resources.`}
        keywords={`${article.slug.replace(/-/g, ' ')}, content review, document analysis, ${article.category.toLowerCase()}`}
        canonicalUrl={`/resources/${slug}`}
        ogType="article"
        structuredData={articleSchema}
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
          <Link to="/resources">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Resources
            </Button>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container-width px-4 py-8 md:py-16">
        <article className="max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <Breadcrumb items={[
            { label: 'Resources', href: '/resources' },
            { label: loading ? 'Loading...' : title }
          ]} />

          {/* Article Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${article.color} flex items-center justify-center`}>
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-medium text-primary">{article.category}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{article.readTime}</span>
                </div>
              </div>
            </div>
            
            {loading ? (
              <Skeleton className="h-12 w-3/4" />
            ) : (
              <h1 className="text-3xl md:text-4xl font-display font-bold leading-tight">
                {title}
              </h1>
            )}
          </div>

          {/* Article Content */}
          <Card className="mb-12">
            <CardContent className="p-6 md:p-8">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              ) : (
                <div className="prose prose-lg dark:prose-invert max-w-none">
                  {content.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="text-foreground/90 leading-relaxed mb-6 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Articles */}
          <div className="mb-12">
            <h2 className="text-xl font-display font-bold mb-6">Related Articles</h2>
            <div className="grid gap-4">
              {relatedArticles.map((related) => {
                const RelatedIcon = related.icon;
                const relatedTitle = get(`${related.contentKey}_title`, 'Loading...');
                const relatedExcerpt = get(`${related.contentKey}_excerpt`, '');
                
                return (
                  <Link key={related.slug} to={`/resources/${related.slug}`}>
                    <Card className="group hover:-translate-y-0.5 transition-all duration-300">
                      <CardContent className="p-4 flex items-start gap-4">
                        <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${related.color} flex items-center justify-center shrink-0`}>
                          <RelatedIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-1">
                            {relatedTitle}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">{relatedExcerpt}</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6 md:p-8 text-center">
              <h2 className="text-xl font-bold mb-3">Ready to Check Your Document?</h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Upload your document to generate a similarity report for your review.
              </p>
              <Link to="/auth">
                <Button variant="default" size="lg">
                  Get Started
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </article>
      </main>

        <Footer />
      </div>
    </>
  );
}
