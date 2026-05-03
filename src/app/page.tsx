import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { SampleScorecard } from "@/components/landing/SampleScorecard";
import { CTASection } from "@/components/landing/CTASection";

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <SampleScorecard />
      <CTASection />
    </div>
  );
}
