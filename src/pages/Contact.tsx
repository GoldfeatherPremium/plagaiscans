import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileCheck, ArrowLeft, Mail, Clock, MessageSquare, Send, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import Footer from '@/components/Footer';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { SEO, generateWebPageSchema } from '@/components/SEO';
import { useTranslation } from 'react-i18next';

export default function Contact() {
  const { t } = useTranslation('common');
  const { openWhatsAppSupport } = useWhatsApp();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success('Message sent successfully! We will get back to you soon.');
    setFormData({ name: '', email: '', subject: '', message: '' });
    setSubmitting(false);
  };

  return (
    <>
      <SEO
        title="Contact Support"
        description="Get in touch with Plagaiscans support team. We're here to help with account issues, document processing, refunds, and technical support."
        keywords="contact support, customer service, technical support"
        canonicalUrl="/contact"
        structuredData={generateWebPageSchema('Contact Support', 'Get in touch with our support team', '/contact')}
      />
      <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container-width flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <FileCheck className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg">Plagaiscans</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('contact.backToHome')}
            </Button>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container-width px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">
              Contact Support
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Have questions or need assistance? Our support team is available via email.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Contact Info */}
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Email Support</h3>
                      <p className="text-muted-foreground text-sm mb-2">
                        For all inquiries and support requests
                      </p>
                      <a href="mailto:support@plagaiscans.com" className="text-primary hover:underline font-medium">
                        support@plagaiscans.com
                      </a>
                    </div>
                  </div>
              </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Billing Inquiries</h3>
                      <p className="text-muted-foreground text-sm mb-2">
                        For payment and billing questions
                      </p>
                      <a href="mailto:billing@plagaiscans.com" className="text-primary hover:underline font-medium">
                        billing@plagaiscans.com
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">WhatsApp Support</h3>
                      <p className="text-muted-foreground text-sm mb-2">
                        Chat with us directly
                      </p>
                      <p className="font-medium mb-3">+44 7360 536649</p>
                      <Button 
                        onClick={() => openWhatsAppSupport()}
                        variant="outline"
                        size="sm"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Chat on WhatsApp
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Response Time</h3>
                      <p className="text-muted-foreground text-sm mb-2">
                        We typically respond within
                      </p>
                      <p className="font-medium">24-48 hours (business days)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">Common Topics</h3>
                      <ul className="text-muted-foreground text-sm space-y-1">
                        <li>• Account and billing questions</li>
                        <li>• Document processing issues</li>
                        <li>• Technical support</li>
                        <li>• Refund requests</li>
                        <li>• Service inquiries</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/50">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">
                    <strong>Before contacting support:</strong> Please check if your question is 
                    answered in our Terms of Service or Privacy Policy pages. This can help 
                    you get answers faster.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <Card>
              <CardHeader>
                <CardTitle>Send us a Message</CardTitle>
                <CardDescription>
                  Fill out the form below and we'll get back to you as soon as possible.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Your Name</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      placeholder="How can we help?"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Describe your issue or question in detail..."
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <>Sending...</>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Company Info */}
          <Card className="mt-12 bg-muted/50 border-border">
            <CardContent className="p-8">
              <h2 className="text-xl font-bold mb-4 text-center">Business Information</h2>
              <div className="grid sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <p><strong>Business Name:</strong> Plagaiscans Technologies Ltd</p>
                  <p className="mt-1"><strong>Company No:</strong> 16998013</p>
                  <p className="mt-1"><strong>Country:</strong> United Kingdom</p>
                </div>
                <div>
                  <p><strong>Registered Address:</strong> Office 7513ci, 182-184 High Street North, Area 1/1, East Ham, London, E6 2JA</p>
                  <p className="mt-1"><strong>Support Email:</strong> support@plagaiscans.com</p>
                  <p className="mt-1"><strong>Billing Email:</strong> billing@plagaiscans.com</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-4">
                Payments are securely processed by Paddle. Paddle is the Merchant of Record for all transactions.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
    </>
  );
}