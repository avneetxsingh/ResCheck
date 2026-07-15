import Link from "next/link";
import { FileSearch, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HistoryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <FileSearch className="w-8 h-8 text-muted-foreground" />
      </div>
      <div>
        <p className="text-lg font-medium">Nothing here yet</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Run your first check and it&apos;ll show up here.
        </p>
      </div>
      <Link href="/analyze" className={cn(buttonVariants(), "gap-2")}>
        Analyze a resume
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
