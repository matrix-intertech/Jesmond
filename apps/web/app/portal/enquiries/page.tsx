"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import { getAccessToken, clearAuth } from '@/utils/auth';
import { handleApiError } from '@/utils/api';
import Link from 'next/link';

interface Enquiry {
  id: string;
  message: string;
  status: string;
  seekerName: string | null;
  seekerEmail: string | null;
  seekerPhone: string | null;
  student: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  } | null;
  property: {
    id: string;
    name: string;
  };
  createdAt: string;
}

export default function ProviderEnquiriesPage() {
  const onAuthError = () => {
    clearAuth();
    router.replace('/login');
  };
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchEnquiries();
  }, []);

  const fetchEnquiries = async () => {
    try {
      const token = getAccessToken();
      if (!token) { onAuthError(); return; }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/enquiries`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        setEnquiries(await res.json());
      } else if (status === 'forbidden') {
        setEnquiries([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleUpdateStatus = async (enquiryId: string, newStatus: string) => {
    setActionLoadingId(enquiryId);
    try {
      const token = getAccessToken();
      if (!token) { onAuthError(); return; }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/enquiries/${enquiryId}/status`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const status = await handleApiError(res, onAuthError);
      if (status === 'ok') {
        fetchEnquiries();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading enquiries...</div>;

  return (
    <>
      <PageHeader title="Property Enquiries" description="Manage enquiries from prospective tenants" onBack={() => router.push('/portal')} />
      <div className="max-w-7xl mx-auto py-8">

        {enquiries.length === 0 ? (
          <div className="bg-white p-10 rounded-xl shadow-sm text-center border">
            <h2 className="text-xl font-bold mb-2">No enquiries yet</h2>
            <p className="text-slate-500 mb-6">When seekers contact you about your properties, they will appear here.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-muted border-b text-sm text-slate-500 uppercase tracking-wider">
                  <th className="p-4 font-semibold">Seeker</th>
                  <th className="p-4 font-semibold">Contact</th>
                  <th className="p-4 font-semibold">Property</th>
                  <th className="p-4 font-semibold w-1/3">Message</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {enquiries.map(enq => {
                  const name = enq.student ? `${enq.student.firstName} ${enq.student.lastName}` : (enq.seekerName || 'Guest');
                  const email = enq.student ? enq.student.email : (enq.seekerEmail || 'No Email');
                  const phone = enq.student?.phone || enq.seekerPhone || 'No Phone';
                  
                  return (
                    <tr key={enq.id} className="hover:bg-surface-muted transition align-top">
                      <td className="p-4">
                        <div className="font-bold text-brand-navy">{name}</div>
                        {!enq.student && <div className="text-[10px] uppercase font-bold text-slate-400 mt-1">Guest</div>}
                      </td>
                      <td className="p-4">
                        <div className="text-xs text-slate-600 mb-1">{email}</div>
                        <div className="text-xs text-slate-500">{phone}</div>
                      </td>
                      <td className="p-4 font-medium">
                        <Link href={`/property/${enq.property.id}`} className="hover:text-brand-orange hover:underline" target="_blank">
                          {enq.property.name}
                        </Link>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-600 whitespace-pre-wrap text-sm line-clamp-3" title={enq.message}>{enq.message}</div>
                        <div className="text-xs text-slate-400 mt-2">{new Date(enq.createdAt).toLocaleString()}</div>
                      </td>
                      <td className="p-4">
                        <select 
                          value={enq.status}
                          onChange={(e) => handleUpdateStatus(enq.id, e.target.value)}
                          disabled={actionLoadingId === enq.id}
                          className={`text-xs font-bold uppercase tracking-wider border rounded px-2 py-1 outline-none ${
                            enq.status === 'RESPONDED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            enq.status === 'ARCHIVED' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                            'bg-amber-100 text-amber-700 border-amber-200'
                          }`}
                        >
                          <option value="NEW">New</option>
                          <option value="RESPONDED">Responded</option>
                          <option value="ARCHIVED">Archived</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <a 
                          href={`mailto:${email}`}
                          className="px-3 py-1.5 text-xs font-semibold text-brand-navy bg-slate-100 hover:bg-slate-200 rounded-lg transition border border-slate-200 inline-block"
                        >
                          Reply
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
