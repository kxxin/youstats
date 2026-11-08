import Link from "next/link";
import { AuthButton } from "./auth-button";

export function SiteHeader() {
  return (
    <header className="border-border border-b">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-5 px-4 py-3 text-sm sm:px-8">
        <Link href="/" className="text-accent font-mono font-medium">
          YouStats
        </Link>
        <Link href="/insights" className="text-muted hover:text-foreground">
          Insights
        </Link>
        <Link
          href="/subscriptions"
          className="text-muted hover:text-foreground"
        >
          Subscriptions
        </Link>
        <div className="ml-auto">
          <AuthButton />
        </div>
      </nav>
    </header>
  );
}
