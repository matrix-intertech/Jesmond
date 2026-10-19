import React from "react";

interface JsonLdProps {
  data: Record<string, any> | Array<Record<string, any>>;
}

/**
 * Safely renders JSON-LD structured data with HTML entity escaping to prevent script injection.
 */
export function JsonLd({ data }: JsonLdProps) {
  const safeJson = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJson }}
    />
  );
}

/**
 * Generates Organization schema for the Jesmond platform
 */
export function getOrganizationSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Jesmond",
    url: siteUrl,
    logo: `${siteUrl}/assets/logo_navbar.png`,
    description: "Jesmond connects students with verified accommodation, local retail stores, and essential services across Australia.",
    sameAs: [
      "https://instagram.com",
      "https://linkedin.com",
    ],
  };
}

/**
 * Generates WebSite schema with SearchAction for site search
 */
export function getWebSiteSchema(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Jesmond",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/search?city={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Generates BreadcrumbList schema
 */
export function getBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

import { convertCentsToAud } from "@/utils/pricing";
export { convertCentsToAud };

/**
 * Generates Accommodation / Apartment / RealEstateListing schema
 */
export function getPropertySchema(property: any, siteUrl: string) {
  const pageUrl = `${siteUrl}/property/${property.id}`;
  const images = property.media && property.media.length > 0
    ? property.media.map((m: any) => m.url).filter(Boolean)
    : undefined;

  const validRoomPrices = property.roomTypes && property.roomTypes.length > 0
    ? property.roomTypes
        .map((r: any) => Number(r.pricePerWeek) || 0)
        .filter((p: number) => p > 0)
    : [];

  const rawMinPriceCents = validRoomPrices.length > 0 ? Math.min(...validRoomPrices) : undefined;
  const minPriceAud = convertCentsToAud(rawMinPriceCents);

  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": property.listingType === "CO_LIVING" ? "Accommodation" : "Apartment",
    "@id": pageUrl,
    name: property.name,
    description: property.description || undefined,
    url: pageUrl,
    image: images,
  };

  if (property.address || property.suburb) {
    schema.address = {
      "@type": "PostalAddress",
      streetAddress: property.address || undefined,
      addressLocality: property.suburb?.name || undefined,
      addressRegion: property.suburb?.state?.name || property.suburb?.state?.code || undefined,
      addressCountry: "AU",
    };
  }

  if (property.lat && property.lng) {
    schema.geo = {
      "@type": "GeoCoordinates",
      latitude: property.lat,
      longitude: property.lng,
    };
  }

  if (property.configuration?.bedrooms) {
    schema.numberOfBedrooms = property.configuration.bedrooms;
  }
  if (property.configuration?.bathrooms) {
    schema.numberOfBathroomsTotal = property.configuration.bathrooms;
  }

  if (minPriceAud && minPriceAud > 0) {
    schema.offers = {
      "@type": "Offer",
      price: minPriceAud,
      priceCurrency: "AUD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: minPriceAud,
        priceCurrency: "AUD",
        unitText: "WEEK",
      },
      availability: "https://schema.org/InStock",
      url: pageUrl,
    };
  }

  return schema;
}

/**
 * Generates LocalBusiness schema (Restaurant, Store, or general LocalBusiness)
 */
export function getLocalBusinessSchema(branch: any, siteUrl: string) {
  const category = branch.organization?.businessCategory || "RETAIL";
  const pageUrl = `${siteUrl}/businesses/store/${branch.id}`;

  let schemaType = "LocalBusiness";
  if (category === "FOOD") schemaType = "Restaurant";
  else if (category === "RETAIL") schemaType = "Store";
  else if (category === "MECHANICS") schemaType = "AutoRepair";
  else if (category === "SERVICES") schemaType = "ProfessionalService";

  const businessName = branch.name || branch.organization?.name || "Local Business";

  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "@id": pageUrl,
    name: businessName,
    url: pageUrl,
  };

  if (branch.address) {
    schema.address = {
      "@type": "PostalAddress",
      streetAddress: branch.address,
      addressCountry: "AU",
    };
  }

  if (branch.phone) {
    schema.telephone = branch.phone;
  }

  if (branch.lat && branch.lng) {
    schema.geo = {
      "@type": "GeoCoordinates",
      latitude: branch.lat,
      longitude: branch.lng,
    };
  }

  if (category === "FOOD" && branch.takeawayEnabled) {
    schema.hasMenu = pageUrl;
    schema.servesCuisine = "Takeaway, Local";
  }

  return schema;
}

/**
 * Generates CollegeOrUniversity schema
 */
export function getUniversitySchema(uni: any, siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "CollegeOrUniversity",
    name: uni.name,
    url: `${siteUrl}/universities/${uni.slug}`,
  };
}

/**
 * Generates RealEstateAgent schema
 */
export function getRealEstateAgentSchema(agency: any, siteUrl: string) {
  const pageUrl = `${siteUrl}/agencies/${agency.id}`;
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": pageUrl,
    name: agency.name,
    url: pageUrl,
    image: agency.branding?.logoUrl || undefined,
  };
}
