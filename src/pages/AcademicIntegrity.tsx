import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ArrowLeft, ArrowRight, BookOpen, Scale, GraduationCap, Shield, Users, Lightbulb } from 'lucide-react';
import Footer from '@/components/Footer';
import { SEO, generateWebPageSchema } from '@/components/SEO';

export default function AcademicIntegrity() {
  const pageSchema = generateWebPageSchema(
    'Academic Integrity Guide',
    'Learn about academic integrity principles, proper citation practices, and how plagiarism detection tools support ethical scholarship.',
    '/academic-integrity'
  );
  const principles = [
    {
      icon: BookOpen,
      title: "Honest Scholarship",
      description: "Academic integrity means producing original work and properly attributing ideas and content from other sources through accurate citations and references."
    },
    {
      icon: Scale,
      title: "Fair Assessment",
      description: "Maintaining originality in academic work ensures that assessments fairly evaluate each individual's understanding, skills, and contributions."
    },
    {
      icon: GraduationCap,
      title: "Educational Value",
      description: "The learning process is enhanced when students engage genuinely with materials and develop their own understanding rather than copying existing work."
    },
    {
      icon: Shield,
      title: "Professional Standards",
      description: "Academic integrity practices prepare students for professional environments where ethical conduct and original contributions are essential."
    }
  ];

  const howWeHelp = [
    {
      icon: FileText,
      title: "Clear Similarity Reports",
      description: "Our detailed reports highlight overlapping text with source attribution, helping users identify areas that may need additional citations or paraphrasing."
    },
    {
      icon: Users,
      title: "Educational Approach",
      description: "Rather than just flagging issues, we provide insights that help users understand proper attribution practices and improve their writing."
    },
    {
      icon: Lightbulb,
      title: "Improvement Guidance",
      description: "Our reports are designed to be actionable, showing exactly where similarities exist so users can address them effectively."
    }
  ];

  return (
    <>
      <SEO
        title="Academic Integrity"
        description="Learn about academic integrity principles, proper citation practices, and how plagiarism detection tools support ethical scholarship and honest research."
        keywords="academic integrity, plagiarism prevention, citation best practices, scholarly ethics, academic honesty, research integrity"
        canonicalUrl="/academic-integrity"
        structuredData={pageSchema}
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
        <div className="max-w-5xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
              Understanding <span className="gradient-text">Academic Integrity</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Academic integrity is the foundation of honest scholarship. Learn how modern tools help evaluate text similarity and support ethical research writing.
            </p>
          </div>

          {/* What is Academic Integrity */}
          <Card className="mb-12">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">What is Academic Integrity?</h2>
              <p className="text-muted-foreground mb-4">
                Academic integrity refers to the ethical code and moral principles that guide scholarly work. It encompasses honesty in research, proper attribution of sources, and the authentic representation of one's own work and ideas.
              </p>
              <p className="text-muted-foreground mb-4">
                Many academic institutions use automated systems to evaluate text similarity and originality. Modern platforms focus on clarity, transparency, and responsible use—helping students and researchers ensure their work meets academic standards before submission.
              </p>
              <p className="text-muted-foreground">
                Understanding similarity in academic writing doesn't mean avoiding all matches. Properly cited quotes, common phrases, and referenced material are expected in scholarly work. The key is ensuring proper attribution and maintaining the author's original contribution to the discourse.
              </p>
            </CardContent>
          </Card>

          {/* Core Principles */}
          <div className="mb-16">
            <h2 className="text-3xl font-display font-bold text-center mb-10">
              Core Principles of Academic Integrity
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {principles.map((principle, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0">
                        <principle.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold mb-2">{principle.title}</h3>
                        <p className="text-muted-foreground text-sm">{principle.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* How We Support */}
          <div className="mb-16">
            <h2 className="text-3xl font-display font-bold text-center mb-4">
              How Plagaiscans Supports Academic Integrity
            </h2>
            <p className="text-center text-muted-foreground mb-10 max-w-2xl mx-auto">
              Our platform is designed to be a helpful tool for maintaining originality, not a punitive measure.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {howWeHelp.map((item, index) => (
                <Card key={index} className="text-center">
                  <CardContent className="p-6">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
                      <item.icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground text-sm">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Best Practices */}
          <Card className="mb-12 bg-muted/30">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-6">Best Practices for Academic Writing</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Citation & Attribution</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Always cite direct quotes with proper formatting</li>
                    <li>• Paraphrase ideas in your own words while citing sources</li>
                    <li>• Use a consistent citation style (APA, MLA, Chicago, etc.)</li>
                    <li>• Include all sources in your bibliography/references</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Original Content</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Develop your own analysis and arguments</li>
                    <li>• Use source material to support, not replace, your ideas</li>
                    <li>• Review your work for unintentional similarity</li>
                    <li>• Use originality checking tools before submission</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Check Your Document's Originality</h2>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                Use Plagaiscans to verify your document's originality before submission and maintain academic integrity.
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