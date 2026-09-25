"use client";

import React, { useEffect, useState } from 'react';
import { getAccessToken } from '@/utils/auth';
import { Plus, Shield, UserCheck, RefreshCw } from 'lucide-react';

type AgencyRole = 'AGENCY_ADMIN' | 'TEAM_MEMBER';
type PropertyPermission = 'VIEW' | 'MANAGE';

interface Member {
  id: string;
  agencyRole: AgencyRole | null;
  role: string;
  user: { id: string; firstName: string; lastName: string; email: string; accountStatus: string };
  managedProperties: Array<{ propertyId: string; permission: PropertyPermission; property: { id: string; name: string } }>;
}

interface Property {
  id: string;
  name: string;
  suburb?: { name: string; city?: { name: string } };
}

const ROLE_LABELS: Record<AgencyRole, string> = {
  AGENCY_ADMIN: 'Agency Admin',
  TEAM_MEMBER: 'Team Member',
};

const ROLE_BADGE_CLASSES: Record<AgencyRole, string> = {
  AGENCY_ADMIN: 'bg-purple-50 text-purple-700 ring-purple-700/10',
  TEAM_MEMBER: 'bg-green-50 text-green-700 ring-green-600/20',
};

export default function AgencyMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isPermsModalOpen, setIsPermsModalOpen] = useState(false);

  const [inviteData, setInviteData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    agencyRole: 'TEAM_MEMBER' as AgencyRole,
  });
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [propertyAssignments, setPropertyAssignments] = useState<{ propertyId: string; permission: PropertyPermission }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const [memRes, propRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/my/members`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/properties/my`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (memRes.ok) setMembers(await memRes.json());
      if (propRes.ok) setProperties(await propRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/my/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(inviteData)
      });
      if (res.ok) {
        setIsInviteModalOpen(false);
        setInviteData({ firstName: '', lastName: '', email: '', agencyRole: 'TEAM_MEMBER' });
        fetchData();
      } else {
        const err = await res.text();
        alert(err);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangeRole = async (member: Member, agencyRole: AgencyRole) => {
    try {
      const token = getAccessToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/my/members/${member.id}/role`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ agencyRole })
        }
      );
      if (res.ok) fetchData();
      else alert(await res.text());
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/my/members/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const openPermsModal = (member: Member) => {
    setSelectedMember(member);
    setPropertyAssignments(
      member.managedProperties.map((mp) => ({
        propertyId: mp.propertyId,
        permission: mp.permission
      }))
    );
    setIsPermsModalOpen(true);
  };

  const togglePropertyAccess = (propertyId: string, checked: boolean) => {
    if (checked) {
      setPropertyAssignments([...propertyAssignments, { propertyId, permission: 'VIEW' }]);
    } else {
      setPropertyAssignments(propertyAssignments.filter(p => p.propertyId !== propertyId));
    }
  };

  const changePropertyPermission = (propertyId: string, permission: PropertyPermission) => {
    setPropertyAssignments(propertyAssignments.map(p =>
      p.propertyId === propertyId ? { ...p, permission } : p
    ));
  };

  const handleSavePermissions = async () => {
    if (!selectedMember) return;
    try {
      const token = getAccessToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/my/members/${selectedMember.id}/permissions`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ propertyAssignments })
        }
      );
      if (res.ok) {
        setIsPermsModalOpen(false);
        fetchData();
      } else {
        alert(await res.text());
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <p className="text-sm">Loading team members…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold leading-7 text-gray-900 sm:truncate sm:tracking-tight">
            Team Members
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your agency staff and their property access. Agency Admins have full access; Team Members only access assigned properties.
          </p>
        </div>
        <div className="mt-4 sm:ml-4 sm:mt-0">
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center rounded-md bg-brand-orange px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 transition-colors"
          >
            <Plus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
            Invite Member
          </button>
        </div>
      </div>

      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Name</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Email</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Agency Role</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Property Access</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {members.map((member) => {
              const roleKey = member.agencyRole ?? null;
              return (
                <tr key={member.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 text-xs font-semibold flex-shrink-0">
                        {member.user.firstName[0]}{member.user.lastName[0]}
                      </div>
                      {member.user.firstName} {member.user.lastName}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{member.user.email}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {roleKey ? (
                      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${ROLE_BADGE_CLASSES[roleKey]}`}>
                        {roleKey === 'AGENCY_ADMIN' ? <Shield className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                        {ROLE_LABELS[roleKey]}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Unset</span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500">
                    {roleKey === 'AGENCY_ADMIN' ? (
                      <span className="text-gray-900 font-medium">All Properties</span>
                    ) : (
                      <div>
                        {member.managedProperties.length === 0 ? (
                          <span className="text-gray-400 text-xs">No properties assigned</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {member.managedProperties.slice(0, 2).map((mp) => (
                              <span key={mp.propertyId} className="text-xs">
                                {mp.property.name}
                                <span className={`ml-1 inline-flex px-1 rounded text-[10px] font-semibold ${mp.permission === 'MANAGE' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {mp.permission}
                                </span>
                              </span>
                            ))}
                            {member.managedProperties.length > 2 && (
                              <span className="text-gray-400 text-xs">+{member.managedProperties.length - 2} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <div className="flex items-center justify-end gap-3">
                      {/* Role toggle */}
                      {roleKey !== 'AGENCY_ADMIN' && (
                        <button
                          onClick={() => handleChangeRole(member, 'AGENCY_ADMIN')}
                          className="text-purple-600 hover:text-purple-800 text-xs font-medium"
                          title="Promote to Agency Admin"
                        >
                          Make Admin
                        </button>
                      )}
                      {roleKey === 'AGENCY_ADMIN' && (
                        <button
                          onClick={() => handleChangeRole(member, 'TEAM_MEMBER')}
                          className="text-gray-500 hover:text-gray-700 text-xs font-medium"
                          title="Demote to Team Member"
                        >
                          Make Member
                        </button>
                      )}
                      {/* Permissions */}
                      {roleKey !== 'AGENCY_ADMIN' && (
                        <button
                          onClick={() => openPermsModal(member)}
                          className="text-brand-orange hover:text-orange-500 text-xs font-medium"
                        >
                          Permissions
                        </button>
                      )}
                      {/* Remove */}
                      <button
                        onClick={() => handleRemove(member.id)}
                        className="text-red-600 hover:text-red-900 text-xs font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-gray-400 text-sm">
                  No team members yet. Click "Invite Member" to add your first team member.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Invite Modal ──────────────────────────────────────────────────────── */}
      {isInviteModalOpen && (
        <div className="relative z-10" aria-labelledby="invite-modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <h3 className="text-base font-semibold leading-6 text-gray-900" id="invite-modal-title">
                  Invite Team Member
                </h3>
                <form onSubmit={handleInvite} className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">First Name</label>
                      <input
                        required
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                        value={inviteData.firstName}
                        onChange={e => setInviteData({ ...inviteData, firstName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Last Name</label>
                      <input
                        required
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                        value={inviteData.lastName}
                        onChange={e => setInviteData({ ...inviteData, lastName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email Address</label>
                    <input
                      type="email"
                      required
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                      value={inviteData.email}
                      onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Agency Role</label>
                    <select
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                      value={inviteData.agencyRole}
                      onChange={e => setInviteData({ ...inviteData, agencyRole: e.target.value as AgencyRole })}
                    >
                      <option value="TEAM_MEMBER">Team Member — access assigned properties only</option>
                      <option value="AGENCY_ADMIN">Agency Admin — full agency access</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Team Members must have properties explicitly assigned with VIEW or MANAGE permission.
                    </p>
                  </div>
                  <div className="mt-5 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      className="inline-flex w-full justify-center rounded-md bg-brand-orange px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 sm:col-start-2"
                    >
                      Send Invite
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsInviteModalOpen(false)}
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Property Permissions Modal ─────────────────────────────────────────── */}
      {isPermsModalOpen && selectedMember && (
        <div className="relative z-10" aria-labelledby="perms-modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                <h3 className="text-base font-semibold leading-6 text-gray-900" id="perms-modal-title">
                  Property Access for {selectedMember.user.firstName} {selectedMember.user.lastName}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Select properties and assign VIEW or MANAGE permission.
                </p>
                <div className="mt-4 max-h-[60vh] overflow-y-auto">
                  {properties.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">
                      You do not have any properties to assign.
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-200">
                      {properties.map((prop) => {
                        const assignment = propertyAssignments.find(p => p.propertyId === prop.id);
                        const isAssigned = !!assignment;
                        return (
                          <li key={prop.id} className="py-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                id={`prop-${prop.id}`}
                                checked={isAssigned}
                                onChange={(e) => togglePropertyAccess(prop.id, e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-brand-orange focus:ring-brand-orange"
                              />
                              <label htmlFor={`prop-${prop.id}`} className="cursor-pointer">
                                <p className="text-sm font-medium text-gray-900">{prop.name}</p>
                                {prop.suburb && (
                                  <p className="text-xs text-gray-500">{prop.suburb.name}{prop.suburb.city ? `, ${prop.suburb.city.name}` : ''}</p>
                                )}
                              </label>
                            </div>
                            {isAssigned && (
                              <select
                                value={assignment!.permission}
                                onChange={(e) => changePropertyPermission(prop.id, e.target.value as PropertyPermission)}
                                className="block w-32 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                              >
                                <option value="VIEW">View Only</option>
                                <option value="MANAGE">Manage</option>
                              </select>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="mt-5 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={handleSavePermissions}
                    className="inline-flex w-full justify-center rounded-md bg-brand-orange px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 sm:col-start-2"
                  >
                    Save Permissions
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPermsModalOpen(false)}
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
    </div>
  );
}
