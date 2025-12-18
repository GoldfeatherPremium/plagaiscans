import { Github, Twitter, Linkedin, Instagram } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const socialLinks = [
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Github, href: "#", label: "GitHub" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Instagram, href: "#", label: "Instagram" },
  ];

  const footerLinks = [
    {
      title: "Company",
      links: ["About", "Careers", "Blog", "Press"],
    },
    {
      title: "Services",
      links: ["Web Development", "Mobile Apps", "UI/UX Design", "Consulting"],
    },
    {
      title: "Legal",
      links: ["Privacy Policy", "Terms of Service", "Cookie Policy"],
    },
  ];

  return (
    <footer className="border-t border-border">
      <div className="container-width section-padding pb-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand */}
          <div className="lg:col-span-2">
            <a href="#" className="text-2xl font-display font-bold gradient-text inline-block mb-4">
              STUDIO
            </a>
            <p className="text-muted-foreground max-w-sm mb-6">
              Crafting exceptional digital experiences that inspire, engage, and drive results.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-all duration-300"
                >
                  <social.icon className="w-4 h-4 text-muted-foreground hover:text-primary" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {footerLinks.map((column, index) => (
            <div key={index}>
              <h4 className="font-display font-semibold mb-4">{column.title}</h4>
              <ul className="space-y-3">
                {column.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a
                      href="#"
                      className="text-muted-foreground hover:text-primary transition-colors text-sm"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {currentYear} Studio. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Designed with <span className="text-primary">♥</span> for creators everywhere
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
