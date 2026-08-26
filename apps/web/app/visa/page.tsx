import { GlobalNav } from "../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../components/marketing/EditorialFooter";

export default function Page() {
  return (
    <div className="min-h-screen bg-white">
      <GlobalNav />
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-32 min-h-[70vh] flex flex-col justify-center items-center text-center">
        <h1 className="text-4xl md:text-5xl font-medium text-brand-navy mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>
          Visa Information
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mb-8">
          Discover comprehensive resources and essential information tailored for the Jesmond community. Explore our latest updates and detailed policies.
        </p>
        <div className="w-16 h-1 bg-brand-orange/100 mx-auto rounded-full"></div>
      </main>
      <EditorialFooter />
    </div>
  );
}
