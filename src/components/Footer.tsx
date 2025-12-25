import { Link } from "react-router-dom";
import { Mail } from "lucide-react";

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
    <footer className="border-t border-border bg-card">
      <div className="container-width section-padding pb-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="text-2xl font-display font-bold gradient-text inline-block mb-4">
              PlagaiScans
            </Link>
            <p className="text-muted-foreground max-w-sm mb-4">
              Professional document similarity and AI content detection services for academic integrity.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              This service is provided for informational and research purposes only.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <a href="mailto:support@plagaiscans.com" className="hover:text-primary transition-colors">
                support@plagaiscans.com
              </a>
            </div>
          </div>

          {/* Links */}
          {footerLinks.map((column, index) => (
            <div key={index}>
              <h4 className="font-display font-semibold mb-4">{column.title}</h4>
              <ul className="space-y-3">
                {column.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <Link
                      to={link.to}
                      className="text-muted-foreground hover:text-primary transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="text-sm text-muted-foreground">
              © {currentYear} PlagaiScans. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Trading Name: PlagaiScans | Legal Entity: Goldfeather Prem Ltd (United Kingdom)
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            <Link to="/pricing" className="hover:text-primary transition-colors">Pricing</Link>
            <span>•</span>
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy</Link>
            <span>•</span>
            <Link to="/terms-and-conditions" className="hover:text-primary transition-colors">Terms</Link>
            <span>•</span>
            <Link to="/refund-policy" className="hover:text-primary transition-colors">Refunds</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;