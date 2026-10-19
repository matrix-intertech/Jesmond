import { notFound } from 'next/navigation';
import { getApiUrl } from '@/utils/api';
import { getSiteUrl } from '@/utils/site';
import { JsonLd, getRealEstateAgentSchema, getBreadcrumbSchema } from '@/components/seo/JsonLd';
import { AgencyDetailClient, AgencyDetail } from './AgencyDetailClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  try {
    const { slug } = await params;
    const res = await fetch(`${getApiUrl()}/api/v1/agency/public/${slug}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return {
        title: 'Agency Details | Jesmond',
      };
    }
    const agency: AgencyDetail = await res.json();
    const name = agency.name || 'Agency Details';
    const description = `View verified properties and contact the team at ${name} on Jesmond.`;
    const logoUrl = agency.branding?.logoUrl;

    return {
      title: `${name} — Real Estate Agency | Jesmond`,
      description,
      alternates: {
        canonical: `/agencies/${slug}`,
      },
      openGraph: {
        title: `${name} — Real Estate Agency | Jesmond`,
        description,
        url: `/agencies/${slug}`,
        images: logoUrl ? [{ url: logoUrl, alt: name }] : undefined,
      },
      twitter: {
        card: 'summary',
        title: `${name} — Real Estate Agency | Jesmond`,
        description,
      },
    };
  } catch {
    return {
      title: 'Agency Details | Jesmond',
    };
  }
}

export default async function AgencyDetailPage({ params }: PageProps) {
  const { slug } = await params;

  let agency: AgencyDetail | null = null;
  let isNotFound = false;
  let fetchError = '';

  try {
    const res = await fetch(`${getApiUrl()}/api/v1/agency/public/${slug}`, {
      cache: 'no-store',
    });
    if (res.status === 404) {
      isNotFound = true;
    } else if (res.ok) {
      agency = await res.json();
    } else {
      fetchError = `Failed to load agency (Status ${res.status})`;
    }
  } catch (e: any) {
    fetchError = e?.message || 'Network error';
  }

  if (isNotFound) {
    notFound();
  }

  if (fetchError || !agency) {
    return (
      <div className="min-h-screen bg-surface-lavender flex items-center justify-center text-center px-4">
        <div>
          <h1 className="mt-4 text-lg font-semibold text-text-primary">Something went wrong</h1>
          <p className="mt-2 text-sm text-text-secondary">{fetchError || 'Unable to load agency'}</p>
        </div>
      </div>
    );
  }

  const siteUrl = getSiteUrl();
  const agencySchema = getRealEstateAgentSchema(agency, siteUrl);
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: siteUrl },
    { name: 'Agencies', url: `${siteUrl}/agencies` },
    { name: agency.name, url: `${siteUrl}/agencies/${slug}` },
  ]);

  return (
    <>
      <JsonLd data={[agencySchema, breadcrumbSchema]} />
      <AgencyDetailClient agency={agency} />
    </>
  );
}
