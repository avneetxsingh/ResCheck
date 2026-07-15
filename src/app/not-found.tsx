import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h1 className="text-6xl font-light text-muted-foreground tabular-nums">404</h1>
      <p className="text-xl font-medium">There&apos;s nothing at this address</p>
      <p className="text-muted-foreground max-w-sm">
        The link may be stale, or the page may have moved.
      </p>
      <Link href="/" className={buttonVariants()}>
        Back to home
      </Link>
    </div>
  );
}
