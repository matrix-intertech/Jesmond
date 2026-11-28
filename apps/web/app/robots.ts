import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getSiteUrl, isProductionEnvironment } from "@/utils/site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteUrl = getSiteUrl();
  const isProd = isProductionEnvironment();
  const reqHeaders = await headers();
  const host = (
    reqHeaders.get("x-forwarded-host") ||
    reqHeaders.get("host") ||
    ""
  )
    .toLowerCase()
    .trim();

  const isBusinessSubdomain =
    host.startsWith("business.jesmond.com.au") ||
    host.startsWith("business.localhost") ||
    host.startsWith("business.");

  // In non-production environments or on the isolated Business Portal subdomain,
  // disallow all crawling and do not advertise the customer sitemap.
  if (!isProd || isBusinessSubdomain) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    };
  }

  // In production:
  // Standard search engines (Googlebot, Bingbot, etc.):
  // Allow public crawling across all discoverable content and disallow internal API endpoints (/api/).
  // Private HTML routes (/admin, /portal, /student, /settings, checkout, orders) emit
  // `<meta name="robots" content="noindex, nofollow" />` in their rendered page metadata.
  // We do NOT block their URLs here so search engines can crawl them, read the noindex directive,
  // and remove them cleanly from search results without "Blocked by robots.txt" indexing warnings.
  //
  // AI Bots & Crawlers:
  // We explicitly separate Search Discovery from Model Training Scraping:
  // - OAI-SearchBot, PerplexityBot, Claude-Web: Allowed for user-facing search discovery, summaries,
  //   and direct citations of public accommodation, business, and guide pages.
  //   Private transactional and account paths are explicitly disallowed.
  // - GPTBot: Disallowed from model training scraping of proprietary property listings and marketplace data.
  const privateAndApiDisallows = [
    "/api/",
    "/admin",
    "/portal",
    "/student",
    "/settings",
    "/messages",
    "/businesses/checkout",
    "/businesses/order",
    "/food/checkout",
    "/food/orders",
    "/my-appointments",
    "/my-orders",
  ];

  const publicSearchAllows = [
    "/",
    "/businesses",
    "/businesses/store/",
    "/property/",
    "/search",
    "/states/",
    "/cities/",
    "/universities/",
    "/agencies/",
    "/guide",
    "/cost",
    "/moving",
    "/international",
    "/safety",
    "/visa",
    "/verification",
    "/pricing",
    "/support",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
        ],
      },
      {
        userAgent: "OAI-SearchBot",
        allow: publicSearchAllows,
        disallow: privateAndApiDisallows,
      },
      {
        userAgent: "GPTBot",
        disallow: "/",
      },
      {
        userAgent: "PerplexityBot",
        allow: publicSearchAllows,
        disallow: privateAndApiDisallows,
      },
      {
        userAgent: "Claude-Web",
        allow: publicSearchAllows,
        disallow: privateAndApiDisallows,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
