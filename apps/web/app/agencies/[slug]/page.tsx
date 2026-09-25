"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Users,
  MapPin,
  ChevronRight,
  ArrowLeft,
  Home,
  Shield,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface AgencyDetail {
  id: string;
  name: string;
  branding: any;
  staff: Array<{
    role: string;
    user: { firstName: string; lastName: string };
  }>;
  properties: Array<{
    id: string;
    name: string;
    address: string;
    media: Array<{ url: string }>;
    roomTypes: Array<{ pricePerWeek: number }>;
  }>;
}

export default function AgencyDetailPage() {
  const params = useParams();
  const id = params?.slug as string;

  const [agency, setAgency] = useState<AgencyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) fetchAgency();
  }, [id]);

  const fetchAgency = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/public/${id}`
      );
      if (res.ok) {
        setAgency(await res.json());
      } else if (res.status === 404) {
        setNotFound(true);
      } else {
        setError(`Error ${res.status}`);
      }
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const getBrandingColor = (branding: any) => branding?.primaryColor || '#EA580C';
  const getLogo = (branding: any) => branding?.logoUrl || null;

  const getMinPrice = (roomTypes: Array<{ pricePerWeek: number }>) => {
    if (!roomTypes?.length) return null;
    const min = Math.min(...roomTypes.map((r) => r.pricePerWeek));
    return `$${Math.round(min / 100)}/wk`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading agency…</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center px-4">
        <div>
          <Building2 className="mx-auto h-12 w-12 text-gray-300" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Agency not found</h1>
          <p className="mt-2 text-gray-500 text-sm">
            This agency may not exist or is not publicly listed.
          </p>
          <Link
            href="/agencies"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Browse all agencies
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-center px-4">
        <div>
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h1 className="mt-4 text-lg font-semibold text-gray-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
          <button
            onClick={fetchAgency}
            className="mt-4 text-sm font-medium text-orange-600 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!agency) return null;

  const color = getBrandingColor(agency.branding);
  const logo = getLogo(agency.branding);
  const initials = agency.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  // Only expose public member names (no emails, phones, roles beyond 'member')
  const publicStaff = agency.staff ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Link
          href="/agencies"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-orange-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Agencies
        </Link>
      </div>

      {/* Agency Hero */}
      <section
        className="mt-6 border-b border-gray-200 bg-white"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-6">
            {/* Logo */}
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: logo ? 'transparent' : color }}
            >
              {logo ? (
                <img src={logo} alt={`${agency.name} logo`} className="w-full h-full object-contain" />
              ) : (
                initials
              )}
            </div>

            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{agency.name}</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  <Shield className="h-3 w-3" />
                  Verified
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Home className="h-4 w-4 text-gray-400" />
                  {agency.properties?.length ?? 0} properties
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-gray-400" />
                  {publicStaff.length} team members
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left: Properties */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold text-gray-900 mb-5">Properties</h2>
          {agency.properties?.length === 0 ? (
            <div className="rounded-2xl bg-white border border-gray-100 p-8 text-center text-gray-400 text-sm">
              No public properties listed.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {agency.properties.map((prop) => {
                const img = prop.media?.[0]?.url;
                const price = getMinPrice(prop.roomTypes);
                return (
                  <Link
                    key={prop.id}
                    href={`/property/${prop.id}`}
                    className="group rounded-2xl bg-white border border-gray-100 overflow-hidden hover:shadow-md hover:border-orange-200 transition-all duration-200"
                  >
                    <div className="h-40 bg-gray-100 overflow-hidden">
                      {img ? (
                        <img
                          src={img}
                          alt={prop.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Building2 className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-1">
                        {prop.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 line-clamp-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {prop.address}
                      </p>
                      {price && (
                        <p className="mt-2 text-xs font-semibold text-orange-600">
                          From {price}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Team */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-5">Team</h2>
          <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden">
            {publicStaff.length === 0 ? (
              <p className="p-6 text-sm text-gray-400 text-center">No public team information.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {publicStaff.map((member, i) => {
                  const name = `${member.user.firstName} ${member.user.lastName}`;
                  const avatarInitial = (member.user.firstName?.[0] ?? '') + (member.user.lastName?.[0] ?? '');
                  return (
                    <li key={i} className="flex items-center gap-3 px-5 py-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {avatarInitial.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                        {/* Only show whether they are a team member - no agencyRole exposed */}
                        <p className="text-xs text-gray-400">Team Member</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
