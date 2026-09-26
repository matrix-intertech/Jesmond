"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken, clearAuth } from '@/utils/auth';
import { handleApiError } from '@/utils/api';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import PageHeader from '@/components/ui/PageHeader';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  profileType: string;
  accountStatus: string;
  organization: { id: string; name: string; type: string; status: string } | null;
  createdAt: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function AccountStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    ACTIVE:               { bg: 'bg-emerald-50',  text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Active' },
    PENDING_VERIFICATION: { bg: 'bg-amber-50',    text: 'text-amber-800',   dot: 'bg-amber-400',   label: 'Pending' },
    LOCKED:               { bg: 'bg-orange-50',   text: 'text-orange-800',  dot: 'bg-orange-500',  label: 'Locked' },
    SUSPENDED:            { bg: 'bg-red-50',       text: 'text-red-700',     dot: 'bg-red-500',     label: 'Suspended' },
    DEACTIVATED:          { bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400',   label: 'Disabled' },
  };
  const s = map[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function ProfileTypeBadge({ profileType }: { profileType: string }) {
  const colorMap: Record<string, string> = {
    Student:          'bg-blue-50 text-blue-800',
    Parent:           'bg-purple-50 text-purple-800',
    Host:             'bg-teal-50 text-teal-800',
    Retailer:         'bg-indigo-50 text-indigo-800',
    Agent:            'bg-cyan-50 text-cyan-800',
    'University Staff': 'bg-violet-50 text-violet-800',
    Admin:            'bg-orange-50 text-orange-800',
    'Super Admin':    'bg-rose-50 text-rose-800',
  };
  const cls = colorMap[profileType] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {profileType}
    </span>
  );
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers]         = useState<UserRow[]>([]);
  const [meta, setMeta]           = useState<Meta | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [toast, setToast]         = useState('');
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage]           = useState(1);

  const [confirmOpen, setConfirmOpen]   = useState(false);
  const [confirmUser, setConfirmUser]   = useState<UserRow | null>(null);
  const [confirmAction, setConfirmAction] = useState<'enable' | 'disable' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const fetchUsers = useCallback(async (searchTerm: string, pageNum: number) => {
    const token = getAccessToken();
    if (!token) { clearAuth(); router.replace('/login'); return; }

    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: '25' });
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`${API_BASE}/api/v1/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
      if (status === 'ok') {
        const json = await res.json();
        setUsers(json.data ?? []);
        setMeta(json.meta ?? null);
      } else if (status === 'forbidden') {
        setError('You do not have permission to manage users.');
      } else {
        setError('Failed to load users.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUsers(search, page);
  }, [search, page, fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const openConfirm = (user: UserRow, action: 'enable' | 'disable') => {
    setConfirmUser(user);
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const performAction = async () => {
    if (!confirmUser || !confirmAction) return;
    const token = getAccessToken();
    if (!token) { clearAuth(); router.replace('/login'); return; }

    setActionLoading(true);
    try {
      const endpoint = confirmAction === 'disable'
        ? `${API_BASE}/api/v1/admin/users/${confirmUser.id}/disable`
        : `${API_BASE}/api/v1/admin/users/${confirmUser.id}/enable`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
      if (status === 'ok') {
        showToast(
          confirmAction === 'disable'
            ? `${confirmUser.firstName} ${confirmUser.lastName} has been disabled.`
            : `${confirmUser.firstName} ${confirmUser.lastName} has been re-enabled.`
        );
        await fetchUsers(search, page);
      } else if (status === 'forbidden') {
        setError('You do not have permission to perform this action.');
      } else {
        let msg = 'Action failed.';
        try {
          const body = await res.json();
          msg = body?.message ?? msg;
        } catch { /* ignore */ }
        setError(msg);
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setConfirmOpen(false);
      setConfirmUser(null);
      setConfirmAction(null);
      setActionLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="User Management"
        description="View and manage all platform users. Disabling a Host or Retailer will also suspend their organization from public listings."
      />

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl mb-6 font-medium flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toast}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl mb-6 font-medium flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          id="user-search"
          type="search"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by name or email..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/40 bg-white"
        />
        <button
          type="submit"
          className="px-5 py-2.5 bg-brand-orange text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
            className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition"
          >
            Clear
          </button>
        )}
      </form>

      {meta && !loading && (
        <p className="text-sm text-slate-500 mb-4">
          Showing {users.length} of {meta.total} users
          {search ? ` matching "${search}"` : ''}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <svg className="animate-spin w-6 h-6 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Loading users...
        </div>
      ) : users.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-brand-navy font-semibold mb-1">No users found</p>
          <p className="text-slate-500 text-sm">Try adjusting your search term.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm hidden md:block">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Profile Type</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Account Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange to-orange-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {u.firstName?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-brand-navy">{u.firstName} {u.lastName}</p>
                          {u.organization && (
                            <p className="text-xs text-slate-400 mt-0.5">{u.organization.name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{u.email}</td>
                    <td className="px-5 py-4">
                      <ProfileTypeBadge profileType={u.profileType} />
                    </td>
                    <td className="px-5 py-4">
                      <AccountStatusBadge status={u.accountStatus} />
                    </td>
                    <td className="px-5 py-4">
                      {u.accountStatus === 'DEACTIVATED' ? (
                        <button
                          id={`enable-user-${u.id}`}
                          onClick={() => openConfirm(u, 'enable')}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                        >
                          Enable
                        </button>
                      ) : (
                        <button
                          id={`disable-user-${u.id}`}
                          onClick={() => openConfirm(u, 'disable')}
                          disabled={u.role === 'ADMIN' || u.role === 'SUPER_ADMIN'}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          title={u.role === 'ADMIN' || u.role === 'SUPER_ADMIN' ? 'Cannot disable admin accounts' : undefined}
                        >
                          Disable
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 md:hidden">
            {users.map((u) => (
              <div key={u.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-orange to-orange-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {u.firstName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-brand-navy text-sm">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                  <AccountStatusBadge status={u.accountStatus} />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <ProfileTypeBadge profileType={u.profileType} />
                  {u.organization && (
                    <span className="text-xs text-slate-400">{u.organization.name}</span>
                  )}
                </div>
                <div className="flex justify-end">
                  {u.accountStatus === 'DEACTIVATED' ? (
                    <button
                      id={`enable-user-mobile-${u.id}`}
                      onClick={() => openConfirm(u, 'enable')}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                    >
                      Enable
                    </button>
                  ) : (
                    <button
                      id={`disable-user-mobile-${u.id}`}
                      onClick={() => openConfirm(u, 'disable')}
                      disabled={u.role === 'ADMIN' || u.role === 'SUPER_ADMIN'}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Disable
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {page} of {meta.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
                className="px-4 py-2 text-sm font-medium rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmationDialog
        open={confirmOpen}
        title={
          confirmAction === 'disable'
            ? `Disable ${confirmUser?.firstName} ${confirmUser?.lastName}?`
            : `Re-enable ${confirmUser?.firstName} ${confirmUser?.lastName}?`
        }
        message={
          confirmAction === 'disable'
            ? confirmUser?.profileType === 'Host'
              ? 'This will disable the user and suspend their Agency from the public directory. No data will be deleted. You can re-enable them at any time.'
              : confirmUser?.profileType === 'Retailer'
              ? 'This will disable the user and suspend their Retail Store from the public marketplace. No data will be deleted. You can re-enable them at any time.'
              : `This will disable ${confirmUser?.firstName} ${confirmUser?.lastName}'s account. They will not be able to log in until re-enabled. No data will be deleted.`
            : 'Re-enabling this account will restore the user\'s access. If they are a Host or Retailer, their organization will also be restored to visible status.'
        }
        onConfirm={performAction}
        onCancel={() => { setConfirmOpen(false); setConfirmUser(null); setConfirmAction(null); }}
      />
    </>
  );
}
