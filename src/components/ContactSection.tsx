import { useState } from "react";
import { Send, Mail, MessageCircle, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

const ContactSection = () => {
  const { toast } = useToast();
  const { t } = useTranslation('landing');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast({
        title: "Please fill all fields",
        description: "All fields are required.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000',
          subject: `Contact Form: ${formData.name}`,
          message: `From: ${formData.name}\nEmail: ${formData.email}\n\n${formData.message}`,
          priority: 'normal',
          status: 'open',
          ticket_type: 'contact'
        });

      if (error) throw error;

      toast({
        title: t('contact.successMessage'),
        description: "We'll get back to you as soon as possible.",
      });
      setFormData({ name: "", email: "", message: "" });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: t('contact.errorMessage'),
        description: "Please try again or contact us directly via email.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactInfo = [
    {
      icon: Mail,
      label: "Email",
      value: "support@plagaiscans.com",
    },
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: "Contact us for support",
    },
    {
      icon: Shield,
      label: "Privacy",
      value: "Your documents are secure",
    },
  ];

  return (
    <section id="contact" className="section-padding bg-muted/30">
      <div className="container-width">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Left Column */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              {t('contact.title')}
            </p>
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 text-foreground">
              {t('contact.subtitle')}
            </h2>

            {/* Contact Info */}
            <div className="space-y-4 mt-8">
              {contactInfo.map((item, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground block">{item.label}</span>
                    <span className="text-sm font-medium text-foreground">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <div className="mt-8">
              <Link to="/auth">
                <Button variant="default" size="lg">
                  Get Started
                  <Send className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Column - Form */}
          <div className="bg-card p-6 md:p-8 rounded-lg border border-border">
            <h3 className="text-lg font-display font-semibold mb-6 text-foreground">
              {t('contact.sendButton')}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="text-sm font-medium mb-2 block text-foreground">
                  {t('contact.nameLabel')}
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-background border-border h-10"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="text-sm font-medium mb-2 block text-foreground">
                  {t('contact.emailLabel')}
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-background border-border h-10"
                  required
                />
              </div>

              <div>
                <label htmlFor="message" className="text-sm font-medium mb-2 block text-foreground">
                  {t('contact.messageLabel')}
                </label>
                <Textarea
                  id="message"
                  placeholder="How can we help you?"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="bg-background border-border min-h-[120px] resize-none"
                  required
                />
              </div>

              <Button type="submit" variant="default" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('contact.sending')}
                  </>
                ) : (
                  <>
                    {t('contact.sendButton')}
                    <Send className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
