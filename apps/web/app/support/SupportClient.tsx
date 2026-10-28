"use client";

import { useState, useEffect, useTransition, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_ARTICLES,
  SupportCategory,
  SupportArticle,
  searchSupportArticles,
} from "./support-data";
import EmptyState from "@/components/ui/EmptyState";

function renderCategoryIcon(icon: string, className = "w-6 h-6") {
  switch (icon) {
    case "home":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case "user":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case "briefcase":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case "document":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "shield":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case "credit-card":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      );
    default:
      return null;
  }
}

export function SupportClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const queryParam = searchParams.get("q") || "";
  const categoryParam = searchParams.get("category") || "";

  const [inputVal, setInputVal] = useState(queryParam);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);

  // Synchronize local input state if URL param changes (e.g. browser Back/Forward)
  useEffect(() => {
    setInputVal(queryParam);
  }, [queryParam]);

  // Find selected category if parameter exists
  const activeCategory: SupportCategory | undefined = categoryParam
    ? SUPPORT_CATEGORIES.find((c) => c.slug === categoryParam)
    : undefined;

  // Search results or filtered category articles
  const searchResults: SupportArticle[] = queryParam
    ? searchSupportArticles(queryParam, activeCategory?.slug)
    : [];

  const categoryArticles: SupportArticle[] = activeCategory
    ? SUPPORT_ARTICLES.filter((a) => a.category === activeCategory.slug)
    : [];

  // Default featured FAQs shown when no category or search is active
  const defaultFaqs: SupportArticle[] = SUPPORT_ARTICLES.slice(0, 6);

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    startTransition(() => {
      const params = new URLSearchParams();
      if (trimmed) {
        params.set("q", trimmed);
      }
      if (categoryParam) {
        params.set("category", categoryParam);
      }
      const queryString = params.toString();
      router.push(queryString ? `/support?${queryString}` : "/support");
    });
  };

  const handleClearSearch = () => {
    setInputVal("");
    startTransition(() => {
      if (categoryParam) {
        router.push(`/support?category=${categoryParam}`);
      } else {
        router.push("/support");
      }
    });
  };

  const toggleArticle = (id: string) => {
    setExpandedArticleId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      {/* Support Hero with Functional Search */}
      <section className="bg-primary pt-32 pb-24 px-6 relative overflow-hidden" aria-labelledby="support-hero-heading">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-400 via-slate-900 to-slate-900 pointer-events-none" />
        <div className="max-w-[800px] mx-auto text-center relative z-10">
          <h1
            id="support-hero-heading"
            className="text-4xl md:text-5xl font-medium text-white mb-6"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            How can we help?
          </h1>
          <p className="text-lg text-text-muted mb-10">
            Search our knowledge base or browse categories below.
          </p>

          <form
            role="search"
            aria-label="Knowledge base search"
            action="/support"
            method="GET"
            onSubmit={handleSearchSubmit}
            className="relative max-w-2xl mx-auto"
          >
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-muted" aria-hidden="true">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {categoryParam && <input type="hidden" name="category" value={categoryParam} />}

            <label htmlFor="support-search" className="sr-only">
              Search support articles, guides, or help topics
            </label>
            <input
              id="support-search"
              name="q"
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="block w-full pl-12 pr-28 py-4 rounded-2xl bg-surface/10 border border-white/20 text-white placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-purple focus:bg-surface focus:text-primary transition-all shadow-lg backdrop-blur-md text-base"
              placeholder="Search for articles, guides, or help topics..."
              autoComplete="off"
            />

            <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
              {inputVal && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Clear search input"
                  className="p-2 text-white/70 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl text-sm font-medium transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white min-h-[38px] flex items-center justify-center cursor-pointer"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* VIEW STATE 1: Search Query Results */}
      {queryParam ? (
        <section className="max-w-[1000px] mx-auto px-6 -mt-8 relative z-20" aria-label="Search Results">
          <div className="bg-surface rounded-[24px] p-8 md:p-12 border border-border-strong shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle mb-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Link
                    href={categoryParam ? `/support?category=${categoryParam}` : "/support"}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md px-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {categoryParam ? "Back to category" : "Back to all categories"}
                  </Link>
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold text-primary" style={{ fontFamily: "var(--font-outfit)" }}>
                  Search Results
                </h2>
                <p className="text-sm text-text-secondary mt-1">
                  Showing {searchResults.length} {searchResults.length === 1 ? "article" : "articles"} for &ldquo;<span className="font-semibold text-primary">{queryParam}</span>&rdquo;
                  {activeCategory ? ` in ${activeCategory.title}` : ""}
                </p>
              </div>

              <button
                type="button"
                onClick={handleClearSearch}
                className="self-start sm:self-auto px-4 py-2 text-sm font-medium text-text-secondary hover:text-primary bg-surface-muted border border-border-subtle rounded-xl hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Clear search
              </button>
            </div>

            {searchResults.length > 0 ? (
              <div className="space-y-6">
                {searchResults.map((article) => {
                  const categoryInfo = SUPPORT_CATEGORIES.find((c) => c.slug === article.category);
                  const isExpanded = expandedArticleId === article.id;

                  return (
                    <article
                      key={article.id}
                      className="border border-border-subtle rounded-2xl p-6 bg-surface hover:border-accent/30 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        {categoryInfo && (
                          <Link
                            href={`/support?category=${categoryInfo.slug}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors"
                          >
                            {categoryInfo.title}
                          </Link>
                        )}
                        {article.relatedHref && (
                          <Link
                            href={article.relatedHref}
                            className="text-xs font-medium text-accent hover:underline inline-flex items-center gap-1"
                          >
                            <span>{article.relatedLabel || "Official Guide"}</span>
                            <span aria-hidden="true">&rarr;</span>
                          </Link>
                        )}
                      </div>

                      <h3 className="text-lg font-semibold text-primary mb-2">
                        {article.title}
                      </h3>

                      <p className="text-text-secondary text-sm leading-relaxed mb-4">
                        {article.content}
                      </p>

                      {article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border-subtle/50">
                          {article.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-surface-muted text-text-muted"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={
                  <svg className="w-12 h-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                title="No matching articles found"
                description={`We couldn't find any help articles matching "${queryParam}". Try checking for spelling, using simpler keywords, or browse all categories.`}
                action={{
                  label: "Clear search & view all categories",
                  href: "/support",
                }}
              />
            )}
          </div>
        </section>
      ) : activeCategory ? (
        /* VIEW STATE 2: Category Filtered View */
        <section className="max-w-[1000px] mx-auto px-6 -mt-8 relative z-20" aria-label={`${activeCategory.title} Category`}>
          <div className="bg-surface rounded-[24px] p-8 md:p-12 border border-border-strong shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            {/* Header with Back button */}
            <div className="pb-8 border-b border-border-subtle mb-8">
              <Link
                href="/support"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md px-1 mb-6"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to all categories
              </Link>

              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0" aria-hidden="true">
                  {renderCategoryIcon(activeCategory.icon, "w-7 h-7")}
                </div>
                <div>
                  <h2 className="text-3xl font-semibold text-primary mb-2" style={{ fontFamily: "var(--font-outfit)" }}>
                    {activeCategory.title}
                  </h2>
                  <p className="text-base text-text-secondary leading-relaxed">
                    {activeCategory.desc}
                  </p>
                </div>
              </div>

              {/* Related Official Guides */}
              {activeCategory.relatedLinks.length > 0 && (
                <div className="mt-6 pt-6 border-t border-border-subtle/60">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
                    Related official guides & resources
                  </h3>
                  <div className="flex flex-wrap gap-2.5">
                    {activeCategory.relatedLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-xl bg-surface-muted hover:bg-accent hover:text-white text-primary border border-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span>{link.label}</span>
                        <span aria-hidden="true">&rarr;</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Articles List */}
            {categoryArticles.length > 0 ? (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-primary mb-4" style={{ fontFamily: "var(--font-outfit)" }}>
                  Help Articles & FAQs
                </h3>
                {categoryArticles.map((article) => (
                  <article
                    key={article.id}
                    className="border border-border-subtle rounded-2xl p-6 bg-surface hover:border-accent/30 transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-primary mb-2">
                          {article.title}
                        </h4>
                        <p className="text-text-secondary text-sm leading-relaxed mb-4">
                          {article.content}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border-subtle/50">
                      <div className="flex flex-wrap gap-1.5">
                        {article.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-surface-muted text-text-muted"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {article.relatedHref && (
                        <Link
                          href={article.relatedHref}
                          className="text-xs font-medium text-accent hover:underline inline-flex items-center gap-1"
                        >
                          <span>{article.relatedLabel || "Learn more"}</span>
                          <span aria-hidden="true">&rarr;</span>
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No articles in this category"
                description="We haven't added specific articles for this category yet. Please check our official guides or reach out to support."
                action={{
                  label: "Return to all categories",
                  href: "/support",
                }}
              />
            )}
          </div>
        </section>
      ) : categoryParam ? (
        /* Unknown category slug provided in URL */
        <section className="max-w-[1000px] mx-auto px-6 -mt-8 relative z-20">
          <div className="bg-surface rounded-[24px] p-8 md:p-12 border border-border-strong shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <EmptyState
              title="Category not found"
              description={`The support category "${categoryParam}" does not exist. Please browse our available categories below.`}
              action={{
                label: "Return to all categories",
                href: "/support",
              }}
            />
          </div>
        </section>
      ) : (
        /* VIEW STATE 3: Default Overview (Categories Grid + Featured FAQs) */
        <>
          {/* FAQ Categories Grid */}
          <section className="max-w-[1000px] mx-auto px-6 -mt-8 relative z-20" aria-label="Support Categories">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {SUPPORT_CATEGORIES.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/support?category=${cat.slug}`}
                  className="bg-surface rounded-[24px] p-8 border border-border-strong shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-lg hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all group block text-left"
                  aria-label={`${cat.title} - ${cat.desc}`}
                >
                  <div className="flex items-start gap-5">
                    <div
                      className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0 group-hover:bg-accent group-hover:text-white transition-colors"
                      aria-hidden="true"
                    >
                      {renderCategoryIcon(cat.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold text-primary mb-2 group-hover:text-accent transition-colors flex items-center justify-between">
                        <span>{cat.title}</span>
                        <svg
                          className="w-4 h-4 text-text-muted group-hover:text-accent group-hover:translate-x-1 transition-all"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </h2>
                      <p className="text-text-secondary text-sm leading-relaxed">{cat.desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Frequently Asked Questions */}
          <section className="max-w-[1000px] mx-auto px-6 mt-20" aria-labelledby="featured-faqs-heading">
            <div className="bg-surface rounded-[24px] p-8 md:p-12 border border-border-strong shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <h2
                id="featured-faqs-heading"
                className="text-3xl font-semibold text-primary mb-6"
                style={{ fontFamily: "var(--font-outfit)" }}
              >
                Frequently Asked Questions
              </h2>
              <div className="space-y-6">
                {defaultFaqs.map((faq) => {
                  const categoryInfo = SUPPORT_CATEGORIES.find((c) => c.slug === faq.category);

                  return (
                    <div key={faq.id} className="border-b border-border-subtle pb-6 last:border-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        {categoryInfo && (
                          <Link
                            href={`/support?category=${categoryInfo.slug}`}
                            className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors"
                          >
                            {categoryInfo.title}
                          </Link>
                        )}
                        {faq.relatedHref && (
                          <Link
                            href={faq.relatedHref}
                            className="text-xs font-medium text-accent hover:underline inline-flex items-center gap-1"
                          >
                            <span>{faq.relatedLabel || "Learn more"}</span>
                            <span aria-hidden="true">&rarr;</span>
                          </Link>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-primary">{faq.title}</h3>
                      <p className="mt-2 text-text-secondary leading-relaxed">{faq.content}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Contact Support CTA */}
      <section className="mt-24 max-w-[800px] mx-auto px-6" aria-labelledby="contact-cta-heading">
        <div className="bg-accent/10 rounded-[32px] p-10 md:p-14 text-center border border-border-strong">
          <h2
            id="contact-cta-heading"
            className="text-3xl font-semibold text-primary mb-4"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            Can&apos;t find what you&apos;re looking for?
          </h2>
          <p className="text-lg text-text-secondary mb-8 max-w-lg mx-auto">
            Our support team is here to help. Reach out to us directly and we&apos;ll get back to you as soon as possible.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-8 py-4 text-base font-medium rounded-xl text-white bg-accent hover:bg-accent/90 shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Contact Support
          </Link>
        </div>
      </section>
    </>
  );
}
