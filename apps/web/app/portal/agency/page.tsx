"use client";

import React, { useEffect, useState } from 'react';
import { getAccessToken } from '@/utils/auth';
import { Building2, Users, Plus, AlertCircle, RefreshCw, Shield, UserCheck } from 'lucide-react';
import Link from 'next/link';

type AgencyState = 'loading' | 'no_agency' | 'loaded' | 'permission_denied' | 'error';

export default function AgencyOverviewPage() {
  const [agency, setAgency] = useState<any>(null);
  const [state, setState] = useState<AgencyState>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchAgency();
  }, []);

  const fetchAgency = async () => {
    setState('loading');
    try {
      const token = getAccessToken();
      if (!token) {
        setState('permission_denied');
        return;
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setAgency(data);
        setState('loaded');
      } else if (res.status === 400) {
        // User is not associated with any organization
        setState('no_agency');
      } else if (res.status === 403) {
        setState('permission_denied');
      } else if (res.status === 404) {
        // Organization exists but has no matching agency
        setState('no_agency');
      } else {
        const body = await res.text().catch(() => '');
        setErrorMsg(body || `Unexpected error (${res.status})`);
        setState('error');
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Network error');
      setState('error');
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="p-8 flex items-center justify-center min-h-[240px]">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading agency data…</p>
        </div>
      </div>
    );
  }

  // ── No Agency ────────────────────────────────────────────────────────────
  if (state === 'no_agency') {
    return (
      <div className="p-8 text-center">
        <Building2 className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-4 text-lg font-semibold text-gray-900">No Agency Found</h3>
        <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
          You are not currently linked to an agency. Contact your platform administrator to set one up, or create one below.
        </p>
        <div className="mt-6">
          <button
            onClick={fetchAgency}
            className="inline-flex items-center gap-2 rounded-md bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Permission Denied ────────────────────────────────────────────────────
  if (state === 'permission_denied') {
    return (
      <div className="p-8 text-center">
        <Shield className="mx-auto h-12 w-12 text-orange-300" />
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Access Restricted</h3>
        <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
          You do not have permission to access agency management. Please contact your Agency Admin.
        </p>
      </div>
    );
  }

  // ── Unexpected Error ─────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Something went wrong</h3>
        <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">{errorMsg}</p>
        <button
          onClick={fetchAgency}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    );
  }

  // ── Loaded ───────────────────────────────────────────────────────────────
  const agencyAdmins = agency.staff?.filter((s: any) => s.agencyRole === 'AGENCY_ADMIN') ?? [];
  const teamMembers = agency.staff?.filter((s: any) => s.agencyRole === 'TEAM_MEMBER') ?? [];
  const unrolled = agency.staff?.filter((s: any) => !s.agencyRole) ?? [];

  return (
    <div className="p-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:tracking-tight">
            {agency.name}
          </h2>
          <p className="mt-1 text-sm text-gray-500 capitalize">
            {agency.type?.toLowerCase() ?? 'Agency'} · {agency.status}
          </p>
        </div>
        <Link
          href="/portal/agency/settings"
          className="mt-4 sm:mt-0 inline-flex items-center rounded-md bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 transition-colors"
        >
          Settings
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Total Team */}
        <div className="overflow-hidden rounded-lg bg-white shadow border border-gray-100">
          <div className="p-5">
            <div className="flex items-center">
              <Users className="h-6 w-6 text-gray-400 flex-shrink-0" aria-hidden="true" />
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">Total Team Members</dt>
                  <dd className="text-lg font-medium text-gray-900">{agency.staff?.length ?? 0}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <Link href="/portal/agency/members" className="text-sm font-medium text-orange-600 hover:text-orange-800">
              Manage Team →
            </Link>
          </div>
        </div>

        {/* Agency Admins */}
        <div className="overflow-hidden rounded-lg bg-white shadow border border-gray-100">
          <div className="p-5">
            <div className="flex items-center">
              <Shield className="h-6 w-6 text-purple-400 flex-shrink-0" aria-hidden="true" />
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">Agency Admins</dt>
                  <dd className="text-lg font-medium text-gray-900">{agencyAdmins.length || unrolled.length || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <span className="text-sm text-gray-400">Full agency access</span>
          </div>
        </div>

        {/* Properties */}
        <div className="overflow-hidden rounded-lg bg-white shadow border border-gray-100">
          <div className="p-5">
            <div className="flex items-center">
              <Building2 className="h-6 w-6 text-gray-400 flex-shrink-0" aria-hidden="true" />
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="truncate text-sm font-medium text-gray-500">Managed Properties</dt>
                  <dd className="text-lg font-medium text-gray-900">{agency.properties?.length ?? 0}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <Link href="/portal/properties" className="text-sm font-medium text-orange-600 hover:text-orange-800">
              View Properties →
            </Link>
          </div>
        </div>
      </div>

      {/* Team Roster */}
      {agency.staff && agency.staff.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Team Roster</h3>
            <Link
              href="/portal/agency/members"
              className="text-sm font-medium text-orange-600 hover:text-orange-800"
            >
              Manage →
            </Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {agency.staff.slice(0, 6).map((member: any) => (
              <li key={member.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-semibold text-sm">
                    {member.user?.firstName?.[0]}{member.user?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.user?.firstName} {member.user?.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{member.user?.email}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                  member.agencyRole === 'AGENCY_ADMIN'
                    ? 'bg-purple-50 text-purple-700 ring-purple-700/10'
                    : member.agencyRole === 'TEAM_MEMBER'
                    ? 'bg-green-50 text-green-700 ring-green-600/20'
                    : 'bg-gray-50 text-gray-600 ring-gray-500/10'
                }`}>
                  {member.agencyRole === 'AGENCY_ADMIN' ? 'Agency Admin'
                    : member.agencyRole === 'TEAM_MEMBER' ? 'Team Member'
                    : member.role}
                </span>
              </li>
            ))}
            {agency.staff.length > 6 && (
              <li className="px-6 py-3 text-sm text-gray-400 text-center">
                +{agency.staff.length - 6} more members —{' '}
                <Link href="/portal/agency/members" className="text-orange-600 hover:underline">
                  view all
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
