"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAccessToken } from '@/utils/auth';
import {
  Building2,
  Users,
  MapPin,
  ArrowLeft,
  Home,
  Shield,
  X,
} from 'lucide-react';
import { LeadTracker } from '@/components/marketing/LeadTracker';

export interface AgencyDetail {
  id: string;
  name: string;
  branding: any;
  staff: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      allowPublicContactDetails: boolean;
    };
  }>;
  properties: Array<{
    id: string;
    name: string;
    address: string;
    media: Array<{ url: string }>;
    roomTypes: Array<{ pricePerWeek: number }>;
  }>;
}

interface AgencyDetailClientProps {
  agency: AgencyDetail;
}

export function AgencyDetailClient({ agency }: AgencyDetailClientProps) {
  const router = useRouter();
  const [selectedMember, setSelectedMember] = useState<AgencyDetail['staff'][0] | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');

  const handleDirectMessage = async () => {
    if (!selectedMember) return;
    const token = getAccessToken();
    if (!token) {
      router.push('/login');
      return;
    }

    setChatError('');
    setChatLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/chat/conversations/direct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ recipientUserId: selectedMember.user.id })
      });

      if (res.ok) {
        const convo = await res.json();
        router.push(`/messages/${convo.id}`);
        window.dispatchEvent(new CustomEvent('openCompactChat', { detail: { conversationId: convo.id } }));
      } else {
        const err = await res.json();
        setChatError(err.message || 'Failed to start conversation');
      }
    } catch (e: any) {
      setChatError(e?.message || 'Network error');
    } finally {
      setChatLoading(false);
    }
  };

  const getBrandingColor = (branding: any) => branding?.primaryColor || '#EA580C';
  const getLogo = (branding: any) => branding?.logoUrl || null;

  const getMinPrice = (roomTypes: Array<{ pricePerWeek: number }>) => {
    if (!roomTypes?.length) return null;
    const min = Math.min(...roomTypes.map((r) => r.pricePerWeek));
    return `$${Math.round(min / 100)}/wk`;
  };

  const color = getBrandingColor(agency.branding);
  const logo = getLogo(agency.branding);
  const initials = agency.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const publicStaff = agency.staff ?? [];

  return (
    <div className="min-h-screen bg-surface-lavender">
      <LeadTracker organizationId={agency.id} />
      {/* Back */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Link
          href="/agencies"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Agencies
        </Link>
      </div>

      {/* Agency Hero */}
      <section className="mt-6 border-b border-border-strong bg-surface">
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
                <h1 className="text-3xl font-bold text-text-primary">{agency.name}</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  <Shield className="h-3 w-3" />
                  Verified
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <Home className="h-4 w-4 text-text-muted" />
                  {agency.properties?.length ?? 0} properties
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-text-muted" />
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
          <h2 className="text-xl font-semibold text-text-primary mb-5">Properties</h2>
          {agency.properties?.length === 0 ? (
            <div className="rounded-2xl bg-surface border border-border-subtle p-8 text-center text-text-muted text-sm">
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
                    className="group rounded-2xl bg-surface border border-border-subtle overflow-hidden hover:shadow-md hover:border-brand-orange transition-all duration-200"
                  >
                    <div className="h-40 bg-surface-muted overflow-hidden">
                      {img ? (
                        <img
                          src={img}
                          alt={prop.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-muted">
                          <Building2 className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors line-clamp-1">
                        {prop.name}
                      </h3>
                      <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1 line-clamp-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {prop.address}
                      </p>
                      {price && (
                        <p className="mt-2 text-xs font-semibold text-accent">
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
          <h2 className="text-xl font-semibold text-text-primary mb-5">Team</h2>
          <div className="rounded-2xl bg-surface border border-border-subtle overflow-hidden">
            {publicStaff.length === 0 ? (
              <p className="p-6 text-sm text-text-muted text-center">No public team information.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {publicStaff.map((member, i) => {
                  const name = `${member.user.firstName} ${member.user.lastName}`;
                  const avatarInitial = (member.user.firstName?.[0] ?? '') + (member.user.lastName?.[0] ?? '');
                  return (
                    <li key={i}>
                      <button
                        onClick={() => setSelectedMember(member)}
                        className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-surface-lavender focus:outline-none focus:bg-surface-lavender transition-colors"
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {avatarInitial.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{name}</p>
                          <p className="text-xs text-text-muted">Team Member</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Team Member Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-primary/50 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
              <h3 className="text-lg font-semibold text-text-primary">Team Member</h3>
              <button
                onClick={() => setSelectedMember(null)}
                className="text-text-muted hover:text-text-secondary transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {((selectedMember.user.firstName?.[0] ?? '') + (selectedMember.user.lastName?.[0] ?? '')).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-text-primary">
                    {selectedMember.user.firstName} {selectedMember.user.lastName}
                  </h4>
                  <p className="text-sm text-text-secondary">Team Member</p>
                </div>
              </div>

              {selectedMember.user.allowPublicContactDetails ? (
                <div className="space-y-3 mb-6 p-4 bg-surface-lavender rounded-xl border border-border-subtle">
                  {selectedMember.user.email && (
                    <div>
                      <p className="text-xs text-text-secondary mb-0.5">Email</p>
                      <a href={`mailto:${selectedMember.user.email}`} className="text-sm font-medium text-text-primary hover:text-accent">
                        {selectedMember.user.email}
                      </a>
                    </div>
                  )}
                  {selectedMember.user.phone && (
                    <div>
                      <p className="text-xs text-text-secondary mb-0.5">Phone</p>
                      <a href={`tel:${selectedMember.user.phone}`} className="text-sm font-medium text-text-primary hover:text-accent">
                        {selectedMember.user.phone}
                      </a>
                    </div>
                  )}
                  {!selectedMember.user.email && !selectedMember.user.phone && (
                    <p className="text-sm text-text-secondary">Contact details not provided.</p>
                  )}
                </div>
              ) : (
                <div className="mb-6 p-4 bg-surface-lavender rounded-xl border border-border-subtle text-center">
                  <p className="text-sm font-medium text-text-primary mb-1">Contact details are private.</p>
                  <p className="text-xs text-text-secondary">You can message this team member through Jesmond.</p>
                </div>
              )}

              <button
                onClick={handleDirectMessage}
                disabled={chatLoading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-accent hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
              >
                {chatLoading ? 'Starting...' : 'Message on Jesmond'}
              </button>
              {chatError && <p className="mt-2 text-xs text-red-500 text-center">{chatError}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
