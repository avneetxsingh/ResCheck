import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="text-xl font-medium">Page not found</p>
      <p className="text-muted-foreground max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/" className={cn(buttonVariants(), "bg-indigo-600 hover:bg-indigo-700 text-white")}>
        Go Home
      </Link>
    </div>
  );
}
