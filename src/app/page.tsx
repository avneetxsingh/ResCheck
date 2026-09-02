import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { AnalysisPreview } from "@/components/landing/AnalysisPreview";
import { Privacy } from "@/components/landing/Privacy";
import { FinalCta } from "@/components/landing/FinalCta";
import { Faq } from "@/components/landing/Faq";
import { SiteFooter } from "@/components/landing/SiteFooter";

// A <div>, not a <main> — layout.tsx already opens the page's single <main>,
// and nesting a second one is invalid and confuses assistive navigation.
//
// Seven sections and no more. Every one earns its place: the product shot, how
// it works, the payoff, what it does with your document, the ask, the four
// questions people actually have, and a footer. There is no logo wall and no
// testimonial, because we have neither to show honestly, and an empty stretch
// of page reads better than a fabricated one.
export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6">
      <LandingNav />
      <Hero />
      <HowItWorks />
      <AnalysisPreview />
      <Privacy />
      <FinalCta />
      <Faq />
      <SiteFooter />
    </div>
  );
}
