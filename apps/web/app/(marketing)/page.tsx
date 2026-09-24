import { GlobalNav } from "@/components/marketing/GlobalNav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { MapPreviewSection } from "@/components/marketing/MapPreviewSection";
import { QuickDiscoveryStrip } from "@/components/marketing/QuickDiscoveryStrip";
import { PropertyDiscovery } from "@/components/marketing/PropertyDiscovery";
import { EditorialFooter } from "@/components/marketing/EditorialFooter";
import { StudyDestinations } from "@/components/marketing/StudyDestinations";
import { TrustExperience } from "@/components/marketing/TrustExperience";
import { FinalConversion } from "@/components/marketing/FinalConversion";
import { prisma } from "@jesmond/db";

export const metadata = {
  title: {
    absolute: "Jesmond | Premium Student Accommodation in Australia",
  },
};

export const dynamic = 'force-dynamic';

export default async function Homepage() {
  let platformSettings = null;
  let featuredData = null;

  try {
    console.log(">>> Homepage: Fetching platform settings... DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 15) + "...");
    platformSettings = await prisma.platformSettings.findUnique({
        where: { id: 'singleton' }
      });
      console.log(">>> Homepage: platformSettings featuredPropertyId =", platformSettings?.featuredPropertyId);

      if (platformSettings?.featuredPropertyId) {
        const featuredProperty = await prisma.property.findUnique({
          where: { id: platformSettings.featuredPropertyId },
          include: {
            suburb: { include: { city: { include: { state: true } } } },
            media: true,
          }
        });
        
        console.log(">>> Homepage: featuredProperty name =", featuredProperty?.name, "status =", featuredProperty?.status, "verification =", featuredProperty?.verificationStatus);

        if (featuredProperty && featuredProperty.status === 'PUBLISHED' && featuredProperty.verificationStatus === 'VERIFIED') {
          const mainImage = (featuredProperty.media as any[])?.find(m => m.isMain)?.url || (featuredProperty.media as any[])?.[0]?.url;
          featuredData = {
            id: featuredProperty.id,
            name: featuredProperty.name,
            location: `${featuredProperty.suburb.name}, ${featuredProperty.suburb.city?.state?.code || ''}`,
            imageUrl: mainImage || null,
          };
        }
      }
    } catch (error) {
    console.warn("Skipping Prisma queries during prerender due to database error", error);
  }

  return (
    <main className="min-h-screen bg-surface-muted selection:bg-orange-500 selection:text-white">
      <GlobalNav />
      
      {/* 1. First Impression & Aspiration */}
      <HeroSection featuredProperty={featuredData} />
      
      {/* 2. Destination Selection (Data Hub) */}
      <MapPreviewSection />
      
      {/* 3. Narrative Bridge (Quick Filter) */}
      <QuickDiscoveryStrip />
      
      {/* 4. Emotional Proof (Featured Properties) */}
      <PropertyDiscovery />
      
      {/* 5. Destination Deep Dive (Progressive Disclosure) */}
      <StudyDestinations />
      
      {/* 6. Security & Trust (Editorial Statistics) */}
      <TrustExperience />
      
      {/* 7. Conversion (Calm Action) */}
      <FinalConversion />
      
      {/* 8. Conclusion (Editorial Sitemap) */}
      <EditorialFooter />
    </main>
  );
}
