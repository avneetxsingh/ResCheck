import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Anchors only. There is no Pricing link because there is no pricing beyond the
// free runs, and no Sign in because there are no accounts — either would
// promise a surface that does not exist.
const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#sample", label: "What you get" },
  { href: "#privacy", label: "Privacy" },
  { href: "#faq", label: "Questions" },
];

export function LandingNav() {
  return (
    <header className="flex items-center justify-between gap-4 py-5">
      <span className="font-mono text-sm font-semibold tracking-tight">ResCheck</span>

      <nav className="hidden items-center gap-1 sm:flex" aria-label="Landing sections">
        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {l.label}
          </a>
        ))}
      </nav>

      <Link href="/check" className={cn(buttonVariants({ size: "sm" }), "rounded-full px-4")}>
        Check a résumé
      </Link>
    </header>
  );
}
