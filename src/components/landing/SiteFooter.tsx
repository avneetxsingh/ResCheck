import Link from "next/link";

// No newsletter, no social row, no sitemap of pages that do not exist.
export function SiteFooter() {
  return (
    <footer className="flex flex-col gap-3 border-t border-border py-10 sm:flex-row sm:items-center sm:justify-between">
      <span className="font-mono text-sm font-semibold tracking-tight">ResCheck</span>
      <p className="text-xs text-muted-foreground">
        Reports what it can derive from your documents, and says so when it cannot.
      </p>
      <Link
        href="/check"
        className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
      >
        Check a résumé
      </Link>
    </footer>
  );
}
