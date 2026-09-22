"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import clsx from "clsx";

export interface SettingsLink {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export interface SettingsLayoutProps {
  title: string;
  description?: string;
  links: SettingsLink[];
  children: React.ReactNode;
}

export default function SettingsLayout({ title, description, links, children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-7xl px-0 py-2 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader title={title} description={description} />

      <div className="mt-6 flex min-w-0 flex-col gap-6 md:flex-row md:gap-8">
        <aside className="min-w-0 flex-shrink-0 md:w-64">
          <nav className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:block md:space-y-1">
            {links.map((link) => {
              const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/settings' && link.href !== '/portal/settings' && link.href !== '/admin/settings');
              // Strict exact match for root settings path to prevent all links matching root
              const isStrictActive = link.href.endsWith('/settings') ? pathname === link.href : isActive;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "flex min-h-11 min-w-0 items-center rounded-md px-3 py-2 text-sm font-medium",
                    isStrictActive
                      ? "bg-brand-orange/10 text-brand-orange"
                      : "text-brand-navy hover:bg-surface-muted hover:text-brand-navy"
                  )}
                >
                  {link.icon && (
                    <span className={clsx("mr-3 h-5 w-5", isStrictActive ? "text-brand-orange" : "text-gray-400")}>
                      {link.icon}
                    </span>
                  )}
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
