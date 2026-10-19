import type { MetadataRoute } from "next";
import { getSiteUrl, isProductionEnvironment } from "@/utils/site";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  const isProd = isProductionEnvironment();

  // In non-production environments (staging, preview, local dev), disallow all crawling
  if (!isProd) {
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
  // Allow crawlers on public HTML pages.
  // Private HTML routes (/admin, /portal, /student, /settings, checkout, orders) emit
  // `<meta name="robots" content="noindex, nofollow" />` in their rendered metadata.
  // We do NOT block their URLs here so search engines can crawl them, read the noindex directive,
  // and remove them from search results without "Blocked by robots.txt" indexing warnings.
  // Internal API endpoints are disallowed from crawling.
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
