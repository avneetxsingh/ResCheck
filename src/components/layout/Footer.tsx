import { Zap } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border/40 py-8 mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-5 h-5 rounded bg-indigo-600 text-white">
            <Zap className="w-3 h-3" />
          </div>
          <span className="font-medium text-foreground">ResCheck</span>
          <span>— Land the interview. Beat the algorithm.</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/analyze" className="hover:text-foreground transition-colors">
            Analyze
          </Link>
          <Link href="/history" className="hover:text-foreground transition-colors">
            History
          </Link>
          <span>Your key never leaves your browser.</span>
        </div>
      </div>
    </footer>
  );
}
