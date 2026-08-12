import { GlobalNav } from "../../components/marketing/GlobalNav";
import { EditorialFooter } from "../../components/marketing/EditorialFooter";
import { prisma } from "@jesmond/db";
import Link from "next/link";

export default async function ProvidersPage() {
  const providers = await prisma.organization.findMany({ where: { type: 'PROVIDER' } });

  return (
    <div className="min-h-screen bg-white">
      <GlobalNav />
      <main className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-16 py-24 min-h-[70vh]">
        <h1 className="text-4xl md:text-5xl font-medium text-slate-900 mb-6" style={{ fontFamily: 'var(--font-outfit)' }}>
          Verified Providers
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mb-12">Discover properties managed by Australia's most trusted student accommodation providers.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {providers.map((provider) => (
            <div key={provider.id} className="group border border-slate-200 rounded-[24px] p-8 flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{provider.name}</h2>
                <div className="mt-4 inline-block bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase">Verified Partner</div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}