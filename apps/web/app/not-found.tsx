import Link from "next/link";
import { GlobalNav } from "@/components/marketing/GlobalNav";
import { EditorialFooter } from "@/components/marketing/EditorialFooter";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      <GlobalNav />
      <main id="main-content" tabIndex={-1} className="flex-1 flex items-center justify-center px-6 py-28 outline-none">
        <div className="max-w-md w-full text-center space-y-6">
          <p className="text-sm font-bold uppercase tracking-wider text-accent">404 Error</p>
          <h1 className="text-4xl font-extrabold text-primary font-outfit">Page Not Found</h1>
          <p className="text-text-secondary text-base leading-relaxed">
            The page or property you are looking for might have been moved, removed, or is temporarily unavailable.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 min-h-[44px] min-w-[44px] rounded-xl bg-accent text-white font-semibold shadow hover:bg-accent focus:outline-none focus:ring-2 focus:ring-accent"
            >
              Go to Homepage
            </Link>
            <Link
              href="/search"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 min-h-[44px] min-w-[44px] rounded-xl bg-surface-lavender text-primary font-semibold hover:bg-border-strong focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Browse Properties
            </Link>
          </div>
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}
