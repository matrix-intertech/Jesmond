"use client";

import React, { useEffect, useState } from 'react';
import { getAccessToken } from '@/utils/auth';
import { Plus } from 'lucide-react';

export default function AgencyMembersPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isPermsModalOpen, setIsPermsModalOpen] = useState(false);
  
  const [inviteData, setInviteData] = useState({ firstName: '', lastName: '', email: '', role: 'ORG_STAFF' });
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [propertyAssignments, setPropertyAssignments] = useState<{propertyId: string, permission: string}[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
        setInviteData({ firstName: '', lastName: '', email: '', role: 'ORG_STAFF' });
        fetchData();
      } else {
        alert(await res.text());
      }
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

  const openPermsModal = (member: any) => {
    setSelectedMember(member);
    setPropertyAssignments(
      member.managedProperties.map((mp: any) => ({
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

  const changePropertyPermission = (propertyId: string, permission: string) => {
    setPropertyAssignments(propertyAssignments.map(p => 
      p.propertyId === propertyId ? { ...p, permission } : p
    ));
  };

  const handleSavePermissions = async () => {
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/my/members/${selectedMember.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ propertyAssignments })
      });
      if (res.ok) {
        setIsPermsModalOpen(false);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading team members...</div>;

  return (
    <div className="p-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold leading-7 text-gray-900 sm:truncate sm:tracking-tight">
            Team Members
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your agency staff and their property access.
          </p>
        </div>
        <div className="mt-4 sm:ml-4 sm:mt-0">
          <button 
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center rounded-md bg-brand-orange px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500"
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
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Role</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Property Access</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {members.map((member) => (
              <tr key={member.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                  {member.user.firstName} {member.user.lastName}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{member.user.email}</td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${member.role === 'ADMIN' ? 'bg-purple-50 text-purple-700 ring-purple-700/10' : 'bg-green-50 text-green-700 ring-green-600/20'}`}>
                    {member.role}
                  </span>
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  {member.role === 'ADMIN' ? (
                    <span className="text-gray-900 font-medium">All Properties</span>
                  ) : (
                    <div>
                      {member.managedProperties.length} assigned properties
                    </div>
                  )}
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  {member.role !== 'ADMIN' && (
                    <button onClick={() => openPermsModal(member)} className="text-brand-orange hover:text-orange-500 mr-4">
                      Permissions
                    </button>
                  )}
                  <button onClick={() => handleRemove(member.id)} className="text-red-600 hover:text-red-900">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                  No team members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Simple Modals via conditional rendering */}
      {isInviteModalOpen && (
        <div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <h3 className="text-base font-semibold leading-6 text-gray-900" id="modal-title">Invite Team Member</h3>
                  <div className="mt-2">
                    <form onSubmit={handleInvite}>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium leading-6 text-gray-900">First Name</label>
                            <div className="mt-2">
                              <input required className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-brand-orange sm:text-sm sm:leading-6" value={inviteData.firstName} onChange={e => setInviteData({...inviteData, firstName: e.target.value})} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium leading-6 text-gray-900">Last Name</label>
                            <div className="mt-2">
                              <input required className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-brand-orange sm:text-sm sm:leading-6" value={inviteData.lastName} onChange={e => setInviteData({...inviteData, lastName: e.target.value})} />
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium leading-6 text-gray-900">Email Address</label>
                          <div className="mt-2">
                            <input type="email" required className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-brand-orange sm:text-sm sm:leading-6" value={inviteData.email} onChange={e => setInviteData({...inviteData, email: e.target.value})} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium leading-6 text-gray-900">Role</label>
                          <div className="mt-2">
                            <select className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-brand-orange sm:text-sm sm:leading-6" value={inviteData.role} onChange={e => setInviteData({...inviteData, role: e.target.value})}>
                              <option value="ORG_STAFF">Staff (Limited Access)</option>
                              <option value="ADMIN">Agency Admin (Full Access)</option>
                            </select>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Staff members require specific property access assignments.</p>
                        </div>
                      </div>
                      <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                        <button type="submit" className="inline-flex w-full justify-center rounded-md bg-brand-orange px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 sm:col-start-2">Send Invite</button>
                        <button type="button" onClick={() => setIsInviteModalOpen(false)} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0">Cancel</button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPermsModalOpen && (
        <div className="relative z-10" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
          <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
                <div>
                  <h3 className="text-base font-semibold leading-6 text-gray-900" id="modal-title">Property Access for {selectedMember?.user?.firstName}</h3>
                  <div className="mt-2">
                    <div className="py-4 max-h-[60vh] overflow-y-auto">
                      {properties.length === 0 ? (
                        <p className="text-sm text-gray-500">You do not have any properties to assign.</p>
                      ) : (
                        <ul className="divide-y divide-gray-200">
                          {properties.map((prop) => {
                            const assignment = propertyAssignments.find(p => p.propertyId === prop.id);
                            const isAssigned = !!assignment;
                            
                            return (
                              <li key={prop.id} className="py-4 flex items-center justify-between">
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={isAssigned}
                                    onChange={(e) => togglePropertyAccess(prop.id, e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-brand-orange focus:ring-brand-orange"
                                  />
                                  <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-900">{prop.name}</p>
                                    <p className="text-sm text-gray-500">{prop.suburb?.name}, {prop.suburb?.city?.name}</p>
                                  </div>
                                </div>
                                {isAssigned && (
                                  <select
                                    value={assignment.permission}
                                    onChange={(e) => changePropertyPermission(prop.id, e.target.value)}
                                    className="block w-32 rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-brand-orange sm:text-sm sm:leading-6"
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
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button type="button" onClick={handleSavePermissions} className="inline-flex w-full justify-center rounded-md bg-brand-orange px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 sm:col-start-2">Save Permissions</button>
                    <button type="button" onClick={() => setIsPermsModalOpen(false)} className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
