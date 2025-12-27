import { Link } from "react-router-dom";
import { Mail, FileText, ArrowUpRight } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    {
      title: "Company",
      links: [
        { label: "About Us", to: "/about-us" },
        { label: "Pricing", to: "/pricing" },
        { label: "Contact", to: "/contact" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", to: "/privacy-policy" },
        { label: "Terms of Service", to: "/terms-and-conditions" },
        { label: "Refund Policy", to: "/refund-policy" },
      ],
    },
  ];

  return (
    <footer className="relative border-t border-border bg-card/50 backdrop-blur-xl overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 gradient-mesh opacity-50 pointer-events-none" />
      
      <div className="relative container-width section-padding pb-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="inline-flex items-center gap-3 group mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 group-hover:shadow-xl group-hover:shadow-primary/40 transition-all duration-300 group-hover:scale-105">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold gradient-text">PlagaiScans</span>
            </Link>
            <p className="text-muted-foreground max-w-sm mb-4 leading-relaxed">
              Professional document similarity and AI content detection services for academic integrity.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              This service is provided for informational and research purposes only.
            </p>
            <div className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <a 
                href="mailto:support@plagaiscans.com" 
                className="text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                support@plagaiscans.com
              </a>
            </div>
          </div>

          {/* Links */}
          {footerLinks.map((column, index) => (
            <div key={index}>
              <h4 className="font-bold mb-6 text-lg">{column.title}</h4>
              <ul className="space-y-4">
                {column.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <Link
                      to={link.to}
                      className="group inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                      <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="text-sm text-muted-foreground">
              © {currentYear} PlagaiScans. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Trading Name: PlagaiScans | Legal Entity: Goldfeather Prem Ltd (United Kingdom)
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link to="/pricing" className="text-muted-foreground hover:text-primary transition-colors">
              Pricing
            </Link>
            <Link to="/privacy-policy" className="text-muted-foreground hover:text-primary transition-colors">
              Privacy
            </Link>
            <Link to="/terms-and-conditions" className="text-muted-foreground hover:text-primary transition-colors">
              Terms
            </Link>
            <Link to="/refund-policy" className="text-muted-foreground hover:text-primary transition-colors">
              Refunds
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;