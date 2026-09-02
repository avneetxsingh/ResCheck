/**
 * A template, not a layout, and the distinction is the whole point: Next.js
 * remounts a template on every navigation while a layout persists. That remount
 * is what lets the route-change animation run when someone moves between `/`
 * and `/check`, rather than only on first load.
 *
 * It stays a plain wrapper — no state, no client boundary — so the pages below
 * it remain server components and nothing here costs hydration.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
