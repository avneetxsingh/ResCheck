import { Hero } from "@/components/landing/Hero";
import { ValueStack } from "@/components/landing/ValueStack";
import { Guarantees } from "@/components/landing/Guarantees";
import { FirstScreenSample } from "@/components/landing/FirstScreenSample";
import { LandingFooter } from "@/components/landing/LandingFooter";

// A <div>, not a <main> — layout.tsx already opens the page's single <main>,
// and nesting a second one is invalid and confuses assistive navigation.
export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6">
      <Hero />
      <ValueStack />
      <Guarantees />
      <FirstScreenSample />
      <LandingFooter />
    </div>
  );
}
