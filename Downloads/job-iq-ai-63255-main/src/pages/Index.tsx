import { SEO } from "@/components/SEO";
import { RLHFNavbar } from "@/components/RLHFNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { NDABanner } from "@/components/landing/NDABanner";
import { DemoSection } from "@/components/landing/DemoSection";
import { ComparisonSection } from "@/components/landing/ComparisonSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { MobileStickyCTA } from "@/components/landing/MobileStickyCTA";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { DataPointSection } from "@/components/landing/DataPointSection";
import { TaskTypesSection } from "@/components/landing/TaskTypesSection";
import { DomainsSection } from "@/components/landing/DomainsSection";
import { QualitySection } from "@/components/landing/QualitySection";
import { IntegrationSection } from "@/components/landing/IntegrationSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { CTASection } from "@/components/landing/CTASection";
import { LandingFooter } from "@/components/landing/LandingFooter";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="STEF — Données d'alignement IA vérifiées par des experts"
        description="Des experts certifiés annotent vos données sur 10 dimensions. Chaque datapoint est validé mathématiquement. RLHF, DPO, red-teaming."
        path="/"
      />
      <RLHFNavbar />
      <HeroSection />
      <NDABanner />
      <DemoSection />
      <ProblemSection />
      <HowItWorksSection />
      <DataPointSection />
      <TaskTypesSection />
      <DomainsSection />
      <QualitySection />
      <ComparisonSection />
      <IntegrationSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <LandingFooter />
      <MobileStickyCTA />
    </div>
  );
};

export default Index;
