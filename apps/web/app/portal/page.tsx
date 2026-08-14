'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAccessToken, clearAuth, User } from '@/utils/auth';
import { handleApiError } from '@/utils/api';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';

export default function ProviderPortalPage() {
  const router = useRouter();

  const onAuthError = () => { clearAuth(); router.replace('/login'); };

  const [user, setUser] = useState<User | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [loadingApps, setLoadingApps] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const init = async () => {
      const token = getAccessToken();
      if (!token) return;

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
        if (status === 'ok') {
          const data = await res.json();
          setProperties(data);
        } else {
          setError('Failed to load properties');
        }
      } catch (e) {
        setError('Error fetching properties');
      } finally {
        setLoadingProps(false);
      }

      try {
        const appRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/applications/provider`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const appStatus = await handleApiError(appRes, onAuthError);
        if (appStatus === 'ok') {
          setApplications(await appRes.json());
        } else if (appStatus === 'forbidden') {
          // keep existing behavior: applications may be empty
        }
      } catch (e) {
        // ignore apps error for now
      } finally {
        setLoadingApps(false);
      }
    };
    init();
  }, [router]);

  if (loadingProps) {
    return (
      <>
        <PageHeader title="Provider Dashboard" description="Manage your accommodations and applications" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="My Properties" value="..." loading />
          <StatCard label="Draft" value="..." loading />
          <StatCard label="Pending Approval" value="..." loading />
        </div>
      </>
    );
  }

  const total = properties.length;
  const drafts = properties.filter(p => p.status === 'DRAFT');
  const pending = properties.filter(p => p.status === 'PENDING_APPROVAL');
  const published = properties.filter(p => p.status === 'PUBLISHED');
  const appsNeedingAttention = applications.filter(a => a.status !== 'APPROVED');

  return (
    <>
      <PageHeader title="Provider Dashboard" description="Manage your accommodations and applications" primaryAction={{ label: 'Create Accommodation', href: '/portal/create' }} />
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="My Properties" value={total} />
        <StatCard label="Draft" value={drafts.length} />
        <StatCard label="Pending Approval" value={pending.length} />
        <StatCard label="Published" value={published.length} />
        <StatCard label="Applications" value={applications.length} description={appsNeedingAttention.length > 0 ? `${appsNeedingAttention.length} require attention` : undefined} />
      </section>

      {drafts.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Draft Properties</h2>
          <ul className="divide-y divide-gray-200">
            {drafts.map(prop => (
              <li key={prop.id} className="p-4 flex justify-between items-center">
                <Link href={`/portal/properties/${prop.id}`} className="font-medium text-indigo-600 hover:underline">
                  {prop.name}
                </Link>
                <StatusBadge status={prop.status} />
                <Link href={`/portal/properties/${prop.id}`} className="text-sm text-indigo-600 hover:underline">Edit</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Pending Approval</h2>
          <p className="text-sm text-gray-600 mb-4">Awaiting admin approval – editing disabled.</p>
          <ul className="divide-y divide-gray-200">
            {pending.map(prop => (
              <li key={prop.id} className="p-4 flex justify-between items-center opacity-60">
                <span className="font-medium text-gray-700">{prop.name}</span>
                <StatusBadge status={prop.status} />
                <button disabled className="text-sm text-gray-400 cursor-not-allowed">Edit</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {published.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Published Properties</h2>
          <ul className="divide-y divide-gray-200">
            {published.map(prop => (
              <li key={prop.id} className="p-4 flex justify-between items-center">
                <Link href={`/property/${prop.id}`} target="_blank" className="font-medium text-indigo-600 hover:underline">
                  {prop.name}
                </Link>
                <StatusBadge status={prop.status} />
                <Link href={`/portal/properties/${prop.id}`} className="text-sm text-indigo-600 hover:underline">Manage</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Applications</h2>
        {applications.length === 0 ? (
          <EmptyState title="No applications yet." />
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b">
              <tr className="text-sm text-slate-500 uppercase tracking-wider">
                <th className="p-4 font-semibold">Student</th>
                <th className="p-4 font-semibold">Property</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Move‑In</th>
                <th className="p-4 font-semibold">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {applications.map(app => (
                <tr key={app.id} className="hover:bg-slate-50 transition">
                  <td className="p-4">{app.student.firstName} {app.student.lastName}</td>
                  <td className="p-4">{app.roomType.property.name}</td>
                  <td className="p-4"><StatusBadge status={app.status} /></td>
                  <td className="p-4">{new Date(app.moveInDate).toLocaleDateString()}</td>
                  <td className="p-4">{app.durationMonths} mo</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
