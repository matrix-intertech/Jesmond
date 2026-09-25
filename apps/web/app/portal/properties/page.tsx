'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAccessToken, clearAuth, getCurrentUser } from '@/utils/auth';
import { handleApiError } from '@/utils/api';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Users } from 'lucide-react';

export default function PortalPropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [assignments, setAssignments] = useState<{orgStaffId: string, permission: 'VIEW' | 'MANAGE'}[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');

  const fetchProperties = async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const status = await handleApiError(res, () => { clearAuth(); router.replace('/login'); });
      if (status === 'ok') {
        const data = await res.json();
        setProperties(data);
      } else {
        setError('Failed to fetch properties');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching properties');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    fetchProperties();
  }, [router]);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN' || currentUser?.orgRole === 'ADMIN' || currentUser?.agencyRole === 'AGENCY_ADMIN';

  const openAssignModal = async (property: any) => {
    setSelectedProperty(property);
    setIsAssignModalOpen(true);
    setTeamLoading(true);
    setAssignError('');
    setAssignSuccess('');
    setAssignments([]);
    
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/agency/my/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const members = await res.json();
        setTeamMembers(members);
        
        // Populate current assignments for this property
        const initialAssignments = members.flatMap((m: any) => {
          const matched = m.managedProperties.find((mp: any) => mp.propertyId === property.id);
          return matched ? [{ orgStaffId: m.id, permission: matched.permission }] : [];
        });
        setAssignments(initialAssignments);
      } else {
        setAssignError('Failed to load team members');
      }
    } catch (e: any) {
      setAssignError(e.message || 'Error loading team members');
    } finally {
      setTeamLoading(false);
    }
  };

  const handleAssignmentChange = (orgStaffId: string, permission: 'VIEW' | 'MANAGE' | 'NONE') => {
    if (permission === 'NONE') {
      setAssignments(assignments.filter(a => a.orgStaffId !== orgStaffId));
    } else {
      const existing = assignments.find(a => a.orgStaffId === orgStaffId);
      if (existing) {
        setAssignments(assignments.map(a => a.orgStaffId === orgStaffId ? { ...a, permission } : a));
      } else {
        setAssignments([...assignments, { orgStaffId, permission }]);
      }
    }
  };

  const saveAssignments = async () => {
    if (!selectedProperty) return;
    setSavingAssignments(true);
    setAssignError('');
    setAssignSuccess('');
    
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/agency/properties/${selectedProperty.id}/team`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ assignments })
      });
      
      if (res.ok) {
        setAssignSuccess('Team members updated successfully.');
        setTimeout(() => {
          setIsAssignModalOpen(false);
        }, 1500);
      } else {
        const err = await res.text();
        setAssignError(err || 'Failed to update assignments');
      }
    } catch (e: any) {
      setAssignError(e.message || 'Error updating assignments');
    } finally {
      setSavingAssignments(false);
    }
  };

  return (
    <>
      <PageHeader 
        title="My Properties" 
        description="Manage your accommodation listings" 
        primaryAction={{ label: 'Create Accommodation', href: '/portal/create' }} 
      />

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading...</div>
      ) : error ? (
        <div className="p-12 text-center text-red-600">{error}</div>
      ) : properties.length === 0 ? (
        <EmptyState title="No properties found." description="Get started by creating your first listing." />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {properties.map(p => (
              <div key={p.id} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/portal/properties/${p.id}`} className="font-semibold text-brand-orange hover:underline">
                      {p.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">{p.suburb?.name || 'N/A'}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/portal/properties/${p.id}`} className="flex-1 inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-orange px-4 py-2 text-sm font-semibold text-brand-orange">
                    Manage
                  </Link>
                  {isAdmin && (
                    <button 
                      onClick={() => openAssignModal(p)}
                      className="flex-1 inline-flex min-h-11 items-center justify-center rounded-lg bg-gray-100 text-gray-700 px-4 py-2 text-sm font-semibold"
                    >
                      <Users className="mr-1 h-4 w-4" /> Team
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
            <table className="w-full text-left">
              <thead className="bg-surface-muted border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-sm font-medium text-brand-navy">Property</th>
                  <th className="px-6 py-4 text-sm font-medium text-brand-navy">Location</th>
                  <th className="px-6 py-4 text-sm font-medium text-brand-navy">Status</th>
                  <th className="px-6 py-4 text-sm font-medium text-brand-navy text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {properties.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <Link href={`/portal/properties/${p.id}`} className="font-medium text-brand-orange hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-brand-navy">{p.suburb?.name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {isAdmin && (
                          <button 
                            onClick={() => openAssignModal(p)}
                            className="text-sm font-medium text-gray-600 hover:text-brand-orange flex items-center"
                          >
                            <Users className="mr-1 h-4 w-4" /> Assign
                          </button>
                        )}
                        <Link href={`/portal/properties/${p.id}`} className="text-sm font-medium text-brand-orange hover:underline">
                          Manage →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Assignment Modal */}
      {isAssignModalOpen && selectedProperty && (
        <div className="relative z-10" aria-labelledby="assign-modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-1" id="assign-modal-title">
                  Assign Team Members
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Property: <span className="font-semibold text-gray-900">{selectedProperty.name}</span>
                </p>

                {assignError && (
                  <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">{assignError}</div>
                )}
                {assignSuccess && (
                  <div className="mb-4 p-3 rounded bg-green-50 text-green-700 text-sm">{assignSuccess}</div>
                )}

                {teamLoading ? (
                  <div className="py-8 text-center text-gray-500">Loading team members...</div>
                ) : teamMembers.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">No team members found in your agency.</div>
                ) : (
                  <div className="max-h-[50vh] overflow-y-auto border rounded-md divide-y">
                    {teamMembers.map(member => {
                      const isAgencyAdmin = member.agencyRole === 'AGENCY_ADMIN';
                      const assignment = assignments.find(a => a.orgStaffId === member.id);
                      const permission = assignment ? assignment.permission : 'NONE';
                      
                      return (
                        <div key={member.id} className="flex items-center justify-between p-4">
                          <div>
                            <p className="font-medium text-gray-900">{member.user.firstName} {member.user.lastName}</p>
                            <p className="text-xs text-gray-500">{member.user.email}</p>
                            {isAgencyAdmin ? (
                              <span className="mt-1 inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                                Agency Admin (Full Access)
                              </span>
                            ) : (
                              <span className="mt-1 inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                Team Member
                              </span>
                            )}
                          </div>
                          <div>
                            {isAgencyAdmin ? (
                              <span className="text-sm font-medium text-gray-500">Always MANAGE</span>
                            ) : (
                              <select 
                                value={permission}
                                onChange={(e) => handleAssignmentChange(member.id, e.target.value as any)}
                                className="block w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                              >
                                <option value="NONE">Not Assigned</option>
                                <option value="VIEW">VIEW</option>
                                <option value="MANAGE">MANAGE</option>
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                  <button
                    type="button"
                    disabled={savingAssignments || teamLoading}
                    onClick={saveAssignments}
                    className="inline-flex w-full justify-center rounded-md bg-brand-orange px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50 sm:col-start-2"
                  >
                    {savingAssignments ? 'Saving...' : 'Save Assignments'}
                  </button>
                  <button
                    type="button"
                    disabled={savingAssignments}
                    onClick={() => setIsAssignModalOpen(false)}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
