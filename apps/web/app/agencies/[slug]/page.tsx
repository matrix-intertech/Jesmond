import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getApiUrl } from '@/utils/api';
import { getSiteUrl } from '@/utils/site';
import { JsonLd, getRealEstateAgentSchema, getBreadcrumbSchema } from '@/components/seo/JsonLd';
import { AgencyDetailClient, AgencyDetail } from './AgencyDetailClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface AgencyFetchResult {
  status: number;
  ok: boolean;
  data: AgencyDetail | null;
  error: string;
}

const getAgencyDetail = cache(async (slug: string): Promise<AgencyFetchResult> => {
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/agency/public/${slug}`, {
      cache: 'no-store',
    });
    if (res.status === 404) {
      return { status: 404, ok: false, data: null, error: '' };
    }
    if (!res.ok) {
      return { status: res.status, ok: false, data: null, error: `Failed to load agency (Status ${res.status})` };
    }
    const data: AgencyDetail = await res.json();
    return { status: 200, ok: true, data, error: '' };
  } catch (e: any) {
    return { status: 0, ok: false, data: null, error: e?.message || 'Network error' };
  }
});

export async function generateMetadata({ params }: PageProps) {
  try {
    const { slug } = await params;
    const { ok, data: agency } = await getAgencyDetail(slug);
    if (!ok || !agency) {
      return {
        title: 'Agency Details',
      };
    }
    const name = agency.name || 'Agency Details';
    const description = `View verified properties and contact the team at ${name} on Jesmond.`;
    const logoUrl = agency.branding?.logoUrl;

    return {
      title: `${name} — Real Estate Agency`,
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
      title: 'Agency Details',
    };
  }
}

export default async function AgencyDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getAgencyDetail(slug);

  if (result.status === 404) {
    notFound();
  }

  if (result.error || !result.data) {
    return (
      <div className="min-h-screen bg-surface-lavender flex items-center justify-center text-center px-4">
        <div>
          <h1 className="mt-4 text-lg font-semibold text-text-primary">Something went wrong</h1>
          <p className="mt-2 text-sm text-text-secondary">{result.error || 'Unable to load agency'}</p>
        </div>
      </div>
    );
  }

  const agency = result.data;

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
