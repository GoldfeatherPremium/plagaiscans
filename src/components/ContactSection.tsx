import { useState } from "react";
import { Send, Mail, MessageCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { useSiteContent } from "@/hooks/useSiteContent";

const ContactSection = () => {
  const { toast } = useToast();
  const { get } = useSiteContent();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Message Sent!",
      description: "We'll get back to you as soon as possible.",
    });
    setFormData({ name: "", email: "", message: "" });
  };

  const contactInfo = [
    {
      icon: Mail,
      label: "Email",
      value: get('contact_email', 'support@plagaiscans.com'),
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
    <section id="contact" className="section-padding relative">
      {/* Background Glow */}
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[150px]" />

      <div className="container-width relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Left Column */}
          <div>
            <span className="text-primary font-medium text-sm tracking-wider uppercase mb-4 block">
              {get('contact_label', 'Get in Touch')}
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6">
              {get('contact_title', 'Ready to Check Your')}
              <span className="gradient-text"> {get('contact_title_gradient', 'Documents?')}</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              {get('contact_subtitle', 'Join thousands of students, researchers, and educators who trust Plagaiscans for accurate plagiarism detection and AI content analysis. Check originality and protect academic integrity.')}
            </p>
            
            {/* Tagline */}
            <div className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-10">
              {get('contact_tagline', 'Clear similarity reports you can trust.')}
            </div>

            {/* Contact Info */}
            <div className="space-y-6">
              {contactInfo.map((item, index) => (
                <div key={index} className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-xl glass flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground block">{item.label}</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <div className="mt-10">
              <Link to="/auth">
                <Button variant="hero" size="lg" className="group">
                  Start Checking Now
                  <Send className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Column - Form */}
          <div className="glass p-8 md:p-10 rounded-2xl">
            <h3 className="text-xl font-display font-semibold mb-6">Send us a message</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="text-sm font-medium mb-2 block">
                  Your Name
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-muted/50 border-border/50 focus:border-primary h-12"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="text-sm font-medium mb-2 block">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-muted/50 border-border/50 focus:border-primary h-12"
                  required
                />
              </div>

              <div>
                <label htmlFor="message" className="text-sm font-medium mb-2 block">
                  Your Message
                </label>
                <Textarea
                  id="message"
                  placeholder="How can we help you with plagiarism checking?"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="bg-muted/50 border-border/50 focus:border-primary min-h-[150px] resize-none"
                  required
                />
              </div>

              <Button type="submit" variant="hero" size="lg" className="w-full group">
                Send Message
                <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
