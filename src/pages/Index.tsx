import Navigation from "@/components/Navigation";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import WorkSection from "@/components/WorkSection";
import ServicesSection from "@/components/ServicesSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";
import { SEO, generateOrganizationSchema, generateServiceSchema, generateSoftwareApplicationSchema } from "@/components/SEO";

const Index = () => {
  return (
    <>
      <SEO
        canonicalUrl="/"
        structuredData={{
          '@context': 'https://schema.org',
          '@graph': [generateOrganizationSchema(), generateServiceSchema(), generateSoftwareApplicationSchema()],
        }}
      />
      <div className="min-h-screen bg-background">
        <Navigation />
        <main>
          <HeroSection />
          <AboutSection />
          <WorkSection />
          <ServicesSection />
          <ContactSection />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
