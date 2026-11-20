import { cache } from "react";
import { getApiUrl } from "@/utils/api";
import { getSiteUrl } from "@/utils/site";
import { notFound } from "next/navigation";
import BusinessAppointments from "@/components/appointments/BusinessAppointments";
import { JsonLd, getLocalBusinessSchema, getBreadcrumbSchema } from "@/components/seo/JsonLd";

const getStoreCatalog = cache(async (branchId: string): Promise<any> => {
  try {
    const res = await fetch(`${getApiUrl()}/api/v1/retail/marketplace/stores/${branchId}/catalog`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Failed to fetch store catalog');
    }
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch store catalog", err);
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ branchId: string }> }) {
  try {
    const { branchId } = await params;
    const data = await getStoreCatalog(branchId);
    const name = data?.branch?.name || data?.branch?.organization?.name;
    if (!name) return { title: "Book Appointment | Jesmond" };

    const pageTitle = `Book an Appointment | ${name}`;
    const fullTitle = `${pageTitle} | Jesmond`;
    const description = `Schedule an appointment online with ${name} on Jesmond. Check real-time staff availability and select your preferred time slot.`;

    return {
      title: pageTitle,
      description,
      alternates: {
        canonical: `/businesses/store/${branchId}/book`,
      },
      openGraph: {
        title: fullTitle,
        description,
        url: `/businesses/store/${branchId}/book`,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: fullTitle,
        description,
      },
    };
  } catch {
    return { title: "Book Appointment | Jesmond" };
  }
}

export default async function BookAppointmentPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const data = await getStoreCatalog(branchId);

  if (!data || !data.branch) {
    notFound();
  }

  const { branch } = data;
  const category = branch.organization?.businessCategory || 'RETAIL';

  // Ensure this business branch supports appointments (MECHANICS or SERVICES)
  if (category !== 'MECHANICS' && category !== 'SERVICES') {
    notFound();
  }

  let initialServices = null;
  try {
    const servicesRes = await fetch(
      `${getApiUrl()}/api/v1/appointments/services?branchId=${branch.id}`,
      { cache: 'no-store' }
    );
    if (servicesRes.ok) initialServices = await servicesRes.json();
  } catch (e) {
    // Graceful fallback to client fetch
  }

  const siteUrl = getSiteUrl();
  const businessSchema = getLocalBusinessSchema(branch, siteUrl);
  const breadcrumbsSchema = getBreadcrumbSchema([
    { name: "Home", url: `${siteUrl}/` },
    { name: "Businesses", url: `${siteUrl}/businesses` },
    { name: branch.name || branch.organization?.name || "Business", url: `${siteUrl}/businesses/store/${branch.id}` },
    { name: "Book Appointment", url: `${siteUrl}/businesses/store/${branch.id}/book` },
  ]);

  return (
    <div className="flex-1 max-w-[1440px] w-full mx-auto px-6 sm:px-12 lg:px-16 py-8">
      <JsonLd data={[businessSchema, breadcrumbsSchema]} />
      <BusinessAppointments
        branchId={branch.id}
        businessName={branch.name || branch.organization?.name || 'Business'}
        timezone={branch.organization?.timezone}
        initialServices={initialServices || undefined}
        branchInfo={branch}
        isDedicatedPage={true}
      />
    </div>
  );
}
