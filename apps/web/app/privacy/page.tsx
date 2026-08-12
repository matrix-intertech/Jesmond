import { GlobalNav } from "../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../components/marketing/EditorialFooter";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <GlobalNav />
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-32 min-h-[70vh] flex flex-col justify-center items-center text-center">
        <h1 className="text-4xl md:text-5xl font-medium text-slate-900 mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>
          Privacy
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mb-8">
          This section is currently being updated. Please check back later for full details.
        </p>
        <div className="w-16 h-1 bg-indigo-500 mx-auto rounded-full"></div>
      </main>
      <EditorialFooter />
    </div>
  );
}
