import Link from "next/link";
import { AuthButton } from "./auth-button";

const LINKS = [
  { href: "/insights", label: "Insights" },
  { href: "/channels", label: "Channels" },
  { href: "/subscriptions", label: "Subscriptions" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-border border-b">
      <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm sm:px-8">
        <Link href="/" className="text-accent font-mono font-medium">
          YouStats
        </Link>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-muted hover:text-foreground"
          >
            {l.label}
          </Link>
        ))}
        <div className="ml-auto">
          <AuthButton />
        </div>
      </nav>
    </header>
  );
}
