import { GlobalNav } from "@/components/marketing/GlobalNav";
import { HeroSection } from "@/components/marketing/HeroSection";
import { MapPreviewSection } from "@/components/marketing/MapPreviewSection";
import { QuickDiscoveryStrip } from "@/components/marketing/QuickDiscoveryStrip";
import { PropertyDiscovery } from "@/components/marketing/PropertyDiscovery";
import { StudyDestinations } from "@/components/marketing/StudyDestinations";
import { TrustExperience } from "@/components/marketing/TrustExperience";
import { FinalConversion } from "@/components/marketing/FinalConversion";
import { EditorialFooter } from "@/components/marketing/EditorialFooter";

export const metadata = {
  title: "Jesmond | Premium Student Accommodation in Australia",
};

export default function Homepage() {
  return (
    <main className="min-h-screen bg-slate-50 selection:bg-indigo-500 selection:text-white">
      <GlobalNav />
      
      {/* 1. First Impression & Aspiration */}
      <HeroSection />
      
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
