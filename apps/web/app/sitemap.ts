import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/utils/site";
import { prisma } from "@jesmond/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  // 1. Static high-value public pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/businesses`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/states`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/universities`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/agencies`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/guide`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/cost`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/moving`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/international`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/safety`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/visa`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/list`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/pricing`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/verification`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/support`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/cookies`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/accessibility`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.5 },
  ];

  try {
    const [properties, branches, universities, states, cities, activeSuburbs] = await Promise.all([
      // Published properties only
      prisma.property.findMany({
        where: { status: "PUBLISHED" },
        select: { id: true, updatedAt: true },
        take: 2000,
      }),
      // Active verified business branches
      prisma.retailBranch.findMany({
        where: { isActive: true },
        select: { id: true, updatedAt: true },
        take: 2000,
      }),
      // Universities
      prisma.university.findMany({
        select: { slug: true },
        take: 500,
      }),
      // States
      prisma.state.findMany({
        select: { name: true, normalizedName: true, updatedAt: true },
        take: 20,
      }),
      // Cities
      prisma.city.findMany({
        include: { state: true },
        take: 500,
      }),
      // Only suburbs with published properties (avoids thin/empty location indexation)
      prisma.suburb.findMany({
        where: { properties: { some: { status: "PUBLISHED" } } },
        include: {
          city: { include: { state: true } },
          state: true,
        },
        take: 2000,
      }),
    ]);

    const propertyEntries: MetadataRoute.Sitemap = properties.map((p) => ({
      url: `${siteUrl}/property/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const businessEntries: MetadataRoute.Sitemap = branches.map((b) => ({
      url: `${siteUrl}/businesses/store/${b.id}`,
      lastModified: b.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    const universityEntries: MetadataRoute.Sitemap = universities.map((u) => ({
      url: `${siteUrl}/universities/${u.slug}`,
      changeFrequency: "monthly",
      priority: 0.7,
    }));

    const stateEntries: MetadataRoute.Sitemap = states.map((s) => {
      const stateSlug = (s.normalizedName || s.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
      return {
        url: `${siteUrl}/states/${stateSlug}`,
        lastModified: s.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      };
    });

    const cityEntries: MetadataRoute.Sitemap = cities
      .filter((c) => c.state)
      .map((c) => {
        const stateSlug = (c.state.normalizedName || c.state.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
        const citySlug = (c.normalizedName || c.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
        return {
          url: `${siteUrl}/states/${stateSlug}/${citySlug}`,
          lastModified: c.updatedAt,
          changeFrequency: "weekly",
          priority: 0.7,
        };
      });

    const suburbEntries: MetadataRoute.Sitemap = activeSuburbs
      .filter((sub) => sub.city && (sub.state || sub.city.state))
      .map((sub) => {
        const state = sub.state || sub.city.state;
        const stateSlug = (state.normalizedName || state.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
        const citySlug = (sub.city.normalizedName || sub.city.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
        const suburbSlug = (sub.normalizedName || sub.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
        return {
          url: `${siteUrl}/states/${stateSlug}/${citySlug}/${suburbSlug}`,
          lastModified: sub.updatedAt,
          changeFrequency: "weekly",
          priority: 0.8,
        };
      });

    return [
      ...staticRoutes,
      ...stateEntries,
      ...cityEntries,
      ...suburbEntries,
      ...propertyEntries,
      ...businessEntries,
      ...universityEntries,
    ];
  } catch (error) {
    console.warn("Failed to query database for sitemap generation, returning static routes", error);
    return staticRoutes;
  }
}
