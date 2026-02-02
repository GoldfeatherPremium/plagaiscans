import { Link } from "react-router-dom";
import { Mail, FileText, CreditCard } from "lucide-react";
import { useSiteContent } from "@/hooks/useSiteContent";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { get } = useSiteContent();
  const { t } = useTranslation('common');

  const footerLinks = [
    {
      title: t('footer.platform'),
      links: [
        { label: t('footer.howItWorks'), to: "/how-it-works" },
        { label: "Use Cases", to: "/use-cases" },
        { label: t('footer.pricing'), to: "/pricing" },
        { label: t('footer.faq'), to: "/faq" },
      ],
    },
    {
      title: t('footer.resources'),
      links: [
        { label: t('footer.academicIntegrity'), to: "/academic-integrity" },
        { label: t('footer.similarityReport'), to: "/similarity-report" },
        { label: t('footer.aiContentDetection'), to: "/ai-content-detection" },
        { label: t('footer.learningCenter'), to: "/resources" },
      ],
    },
    {
      title: t('footer.company'),
      links: [
        { label: t('footer.aboutUs'), to: "/about-us" },
        { label: t('footer.contact'), to: "/contact" },
      ],
    },
    {
      title: t('footer.legal'),
      links: [
        { label: t('footer.privacyPolicy'), to: "/privacy-policy" },
        { label: t('footer.termsOfService'), to: "/terms-and-conditions" },
        { label: t('footer.refundPolicy'), to: "/refund-policy" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-card">
      <div className="container-width section-padding pb-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-2xl font-display font-bold text-foreground">
                {get('nav_brand', 'Plagaiscans')}
              </span>
            </Link>
            <p className="text-muted-foreground max-w-sm mb-4">
              {get('footer_description', 'Professional document similarity and AI content detection services for academic integrity.')}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {get('footer_disclaimer', 'This service is provided for informational and research purposes only.')}
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${get('contact_email', 'support@plagaiscans.com')}`} className="hover:text-primary transition-colors">
                {get('contact_email', 'support@plagaiscans.com')}
              </a>
            </div>
          </div>

          {/* Links */}
          {footerLinks.map((column, index) => (
            <div key={index}>
              <h3 className="font-display font-semibold mb-4 text-base">{column.title}</h3>
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

        {/* Payment Methods */}
        <div className="pt-8 border-t border-border mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              <span>{t('footer.weAccept')}</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Visa */}
              <div className="bg-background border border-border rounded px-3 py-1.5 flex items-center justify-center min-w-[50px]">
                <svg viewBox="0 0 48 32" className="h-6 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="48" height="32" rx="4" fill="white"/>
                  <path d="M19.5 21H17L18.75 11H21.25L19.5 21Z" fill="#00579F"/>
                  <path d="M28.5 11.25C28 11.05 27.25 10.85 26.25 10.85C23.75 10.85 22 12.15 22 14C22 15.35 23.25 16.1 24.15 16.55C25.1 17 25.4 17.3 25.4 17.7C25.4 18.3 24.65 18.6 24 18.6C23.05 18.6 22.55 18.45 21.75 18.1L21.4 17.95L21.05 20.2C21.65 20.45 22.75 20.65 23.9 20.65C26.55 20.65 28.25 19.35 28.25 17.4C28.25 16.35 27.6 15.55 26.25 14.9C25.45 14.5 24.95 14.2 24.95 13.75C24.95 13.35 25.4 12.9 26.35 12.9C27.15 12.9 27.75 13.05 28.2 13.25L28.45 13.35L28.5 11.25Z" fill="#00579F"/>
                  <path d="M32.5 11H30.5C29.9 11 29.45 11.15 29.15 11.75L25.5 21H28.15L28.65 19.55H31.85L32.15 21H34.5L32.5 11ZM29.35 17.55C29.55 17 30.35 14.9 30.35 14.9C30.35 14.9 30.55 14.35 30.7 14L30.85 14.85C30.85 14.85 31.35 17.1 31.45 17.55H29.35Z" fill="#00579F"/>
                  <path d="M16 11L13.5 17.75L13.25 16.5C12.75 14.9 11.25 13.15 9.5 12.25L11.75 21H14.45L18.7 11H16Z" fill="#00579F"/>
                  <path d="M12 11H8.05L8 11.2C11.15 12 13.25 14 14.05 16.5L13.2 11.8C13.05 11.2 12.6 11 12 11Z" fill="#FAA61A"/>
                </svg>
              </div>
              {/* Mastercard */}
              <div className="bg-background border border-border rounded px-3 py-1.5 flex items-center justify-center min-w-[50px]">
                <svg viewBox="0 0 48 32" className="h-6 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="48" height="32" rx="4" fill="white"/>
                  <circle cx="19" cy="16" r="8" fill="#EB001B"/>
                  <circle cx="29" cy="16" r="8" fill="#F79E1B"/>
                  <path d="M24 10.3C25.8 11.7 27 13.7 27 16C27 18.3 25.8 20.3 24 21.7C22.2 20.3 21 18.3 21 16C21 13.7 22.2 11.7 24 10.3Z" fill="#FF5F00"/>
                </svg>
              </div>
              {/* Apple Pay */}
              <div className="bg-background border border-border rounded px-3 py-1.5 flex items-center justify-center min-w-[50px]">
                <svg viewBox="0 0 48 32" className="h-6 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="48" height="32" rx="4" fill="white"/>
                  <path d="M15.5 10.5C15.1 11 14.5 11.4 13.9 11.35C13.8 10.75 14.1 10.1 14.45 9.65C14.85 9.15 15.5 8.75 16.05 8.7C16.1 9.35 15.85 9.95 15.5 10.5ZM16.05 11.5C15.2 11.45 14.5 12 14.1 12C13.7 12 13.1 11.55 12.4 11.55C11.5 11.55 10.7 12.05 10.25 12.85C9.3 14.45 10.05 16.85 10.95 18.15C11.4 18.8 11.95 19.5 12.65 19.45C13.3 19.4 13.55 19 14.4 19C15.25 19 15.45 19.45 16.15 19.45C16.85 19.45 17.35 18.8 17.8 18.15C18.35 17.4 18.55 16.7 18.55 16.65C18.55 16.65 17.15 16.1 17.15 14.5C17.15 13.1 18.25 12.45 18.3 12.4C17.65 11.45 16.65 11.5 16.05 11.5Z" fill="black"/>
                  <path d="M22.5 19.35V9.35H26.05C28.05 9.35 29.45 10.75 29.45 12.8C29.45 14.85 28 16.25 25.95 16.25H24.25V19.35H22.5ZM24.25 10.85V14.75H25.65C27 14.75 27.7 14 27.7 12.8C27.7 11.6 27 10.85 25.65 10.85H24.25ZM30.1 17.45C30.1 15.95 31.25 15.05 33.15 14.95L35.35 14.8V14.15C35.35 13.3 34.75 12.8 33.8 12.8C32.9 12.8 32.3 13.25 32.2 13.95H30.6C30.65 12.45 31.95 11.4 33.85 11.4C35.75 11.4 37 12.4 37 13.95V19.35H35.4V18.1H35.35C34.95 18.95 34 19.5 32.95 19.5C31.35 19.5 30.1 18.55 30.1 17.45ZM35.35 16.7V16.05L33.4 16.2C32.4 16.25 31.85 16.7 31.85 17.35C31.85 18.05 32.45 18.5 33.35 18.5C34.5 18.5 35.35 17.75 35.35 16.7ZM38.45 22.15V20.7C38.55 20.75 38.85 20.75 39 20.75C39.75 20.75 40.15 20.4 40.4 19.55L40.55 19.05L37.7 11.55H39.55L41.45 17.65H41.5L43.4 11.55H45.2L42.2 19.7C41.55 21.5 40.75 22.15 39.15 22.15C39 22.15 38.55 22.15 38.45 22.15Z" fill="black"/>
                </svg>
              </div>
              {/* Google Pay */}
              <div className="bg-background border border-border rounded px-3 py-1.5 flex items-center justify-center min-w-[50px]">
                <svg viewBox="0 0 48 32" className="h-6 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="48" height="32" rx="4" fill="white"/>
                  <path d="M22.5 16.35V20H21.1V10H24.55C25.4 10 26.1 10.3 26.7 10.85C27.3 11.4 27.6 12.1 27.6 12.95C27.6 13.8 27.3 14.5 26.7 15.05C26.1 15.6 25.4 15.9 24.55 15.9H22.5V16.35ZM22.5 11.35V14.55H24.6C25.1 14.55 25.5 14.4 25.8 14.05C26.1 13.7 26.25 13.35 26.25 12.95C26.25 12.55 26.1 12.2 25.8 11.85C25.5 11.5 25.1 11.35 24.6 11.35H22.5Z" fill="#5F6368"/>
                  <path d="M31.15 13.5C32.15 13.5 32.95 13.8 33.5 14.35C34.1 14.9 34.4 15.65 34.4 16.6V20H33.05V18.95H33C32.5 19.75 31.8 20.15 30.9 20.15C30.15 20.15 29.5 19.9 29 19.45C28.5 19 28.25 18.4 28.25 17.7C28.25 16.95 28.5 16.35 29.05 15.9C29.6 15.45 30.3 15.2 31.2 15.2C31.95 15.2 32.55 15.35 33 15.65V15.4C33 14.9 32.8 14.5 32.45 14.15C32.1 13.8 31.65 13.65 31.15 13.65C30.4 13.65 29.8 13.95 29.45 14.55L28.2 13.8C28.75 13 29.75 13.5 31.15 13.5ZM29.65 17.75C29.65 18.1 29.8 18.4 30.1 18.65C30.4 18.9 30.75 19 31.1 19C31.65 19 32.15 18.8 32.55 18.35C32.95 17.9 33.15 17.45 33.15 16.9C32.75 16.55 32.15 16.4 31.4 16.4C30.85 16.4 30.4 16.55 30.05 16.8C29.75 17.1 29.65 17.4 29.65 17.75Z" fill="#5F6368"/>
                  <path d="M40.6 13.65L36.7 22.75H35.25L36.65 19.7L34.1 13.65H35.65L37.45 18.2H37.5L39.25 13.65H40.6Z" fill="#5F6368"/>
                  <path d="M17.25 15.9C17.25 15.55 17.2 15.2 17.15 14.85H12V16.8H15C14.9 17.45 14.55 18 14 18.4V19.7H15.7C16.7 18.8 17.25 17.45 17.25 15.9Z" fill="#4285F4"/>
                  <path d="M12 21C13.4 21 14.55 20.55 15.7 19.7L14 18.4C13.5 18.75 12.85 18.95 12 18.95C10.65 18.95 9.5 18.05 9.1 16.8H7.35V18.15C8.25 19.9 10 21 12 21Z" fill="#34A853"/>
                  <path d="M9.1 16.8C8.95 16.35 8.85 15.9 8.85 15.4C8.85 14.9 8.95 14.45 9.1 14V12.65H7.35C6.8 13.75 6.5 14.95 6.5 16.25C6.5 17.55 6.8 18.75 7.35 19.85L9.1 18.5V16.8Z" fill="#FBBC05"/>
                  <path d="M12 11.85C12.9 11.85 13.7 12.15 14.35 12.75L15.75 11.35C14.55 10.25 13.4 9.8 12 9.8C10 9.8 8.25 10.9 7.35 12.65L9.1 14C9.5 12.75 10.65 11.85 12 11.85Z" fill="#EA4335"/>
                </svg>
              </div>
              {/* Crypto (USDT) */}
              <div className="bg-background border border-border rounded px-3 py-1.5 flex items-center justify-center min-w-[50px]">
                <svg viewBox="0 0 48 32" className="h-6 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="48" height="32" rx="4" fill="white"/>
                  <circle cx="24" cy="16" r="9" fill="#26A17B"/>
                  <path d="M25.5 15.2V13.5H28.5V11.5H19.5V13.5H22.5V15.2C19.9 15.35 18 15.9 18 16.55C18 17.2 19.9 17.75 22.5 17.9V22H25.5V17.9C28.1 17.75 30 17.2 30 16.55C30 15.9 28.1 15.35 25.5 15.2ZM25.5 17.35V17.35C25.35 17.35 24.95 17.4 24 17.4C23.2 17.4 22.7 17.35 22.5 17.3V17.3C20.35 17.15 18.8 16.75 18.8 16.25C18.8 15.8 20.15 15.4 22.5 15.25V16.8C22.7 16.85 23.25 16.9 24.05 16.9C25 16.9 25.4 16.85 25.5 16.8V15.25C27.85 15.4 29.2 15.8 29.2 16.25C29.2 16.75 27.65 17.15 25.5 17.35Z" fill="white"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="text-sm text-muted-foreground">
              © {currentYear} {get('nav_brand', 'Plagaiscans')}. {t('footer.allRightsReserved')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('footer.tradingName')}: {get('nav_brand', 'Plagaiscans')} | {t('footer.legalEntity')}: {get('footer_company_name', 'Plagaiscans Technologies Ltd')} ({get('footer_country', 'United Kingdom')})
            </p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-4 text-xs text-muted-foreground">
            <LanguageSwitcher />
            <span>•</span>
            <Link to="/pricing" className="hover:text-primary transition-colors">{t('footer.pricing')}</Link>
            <span>•</span>
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">{t('footer.privacy')}</Link>
            <span>•</span>
            <Link to="/terms-and-conditions" className="hover:text-primary transition-colors">{t('footer.terms')}</Link>
            <span>•</span>
            <Link to="/refund-policy" className="hover:text-primary transition-colors">{t('footer.refunds')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
