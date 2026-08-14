"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getAccessToken, clearAuth } from "@/utils/auth";
import { handleApiError } from "@/utils/api";
import PageHeader from "@/components/ui/PageHeader";

export default function AdminApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params as { id: string };
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchApp = async () => {
      const token = getAccessToken();
      if (!token) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/admin/applications/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
        if (status === 'ok') {
          const data = await res.json();
          setApplication(data);
        } else {
          setError('Failed to load application');
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchApp();
  }, [id]);

  if (loading) return <div className="p-12 text-center">Loading...</div>;
  if (error) return <div className="p-12 text-center text-rose-600">{error}</div>;
  if (!application) return null;

  return (
    <>
      <PageHeader title="Application Detail" description={`Application ${application.id}`} />
      <div className="grid grid-cols-2 gap-4 mt-6 bg-white p-6 rounded-xl shadow-sm">
        <div className="col-span-2 text-lg font-semibold text-slate-900 mb-4">Student</div>
        <div className="text-slate-900">{application.student?.firstName} {application.student?.lastName}</div>
        <div className="text-slate-500">{application.student?.email}</div>

        <div className="col-span-2 text-lg font-semibold text-slate-900 mb-4 mt-4">Property</div>
        <div className="text-slate-900">{application.roomType?.property?.name}</div>
        <div className="text-slate-500">
          {application.roomType?.property?.suburb?.name}, {application.roomType?.property?.suburb?.city?.name}
        </div>

        <div className="col-span-2 text-lg font-semibold text-slate-900 mb-4 mt-4">Room Type</div>
        <div className="text-slate-900">{application.roomType?.name}</div>

        <div className="col-span-2 text-lg font-semibold text-slate-900 mb-4 mt-4">Provider</div>
        <div className="text-slate-900">{application.roomType?.property?.organization?.name}</div>

        <div className="col-span-2 text-lg font-semibold text-slate-900 mb-4 mt-4">Details</div>
        <div className="text-slate-900">Move‑In: {new Date(application.moveInDate).toLocaleDateString()}</div>
        <div className="text-slate-900">Duration: {application.durationMonths} months</div>
        <div className="text-slate-900">Locked Price: ${(application.lockedPrice / 100).toFixed(2)}</div>
        <div className="text-slate-900">Status: {application.status}</div>
        <div className="text-slate-900">Created At: {new Date(application.createdAt).toLocaleDateString()}</div>
      </div>
    </>
  );
}
