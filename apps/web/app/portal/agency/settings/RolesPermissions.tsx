import React, { useEffect, useState } from 'react';
import { getAccessToken } from '@/utils/auth';
import { Plus, Edit2, Trash2 } from 'lucide-react';

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  _count: { staff: number };
}

const PERMISSION_GROUPS = [
  { group: 'Properties', options: [
    { label: 'View properties', value: 'property.view' },
    { label: 'View property details', value: 'property.view_details' },
    { label: 'Create properties', value: 'property.create' },
    { label: 'Edit properties', value: 'property.edit' },
    { label: 'Delete properties', value: 'property.delete' },
    { label: 'Manage applications', value: 'property.manage_applications' },
  ]},
  { group: 'Leads', options: [
    { label: 'View leads', value: 'lead.view' },
    { label: 'Create leads', value: 'lead.create' },
    { label: 'Edit leads', value: 'lead.edit' },
    { label: 'Delete leads', value: 'lead.delete' },
    { label: 'Assign leads', value: 'lead.assign' },
  ]},
  { group: 'Enquiries', options: [
    { label: 'View enquiries', value: 'enquiry.view' },
    { label: 'Respond to enquiries', value: 'enquiry.respond' },
    { label: 'Delete enquiries', value: 'enquiry.delete' },
  ]},
  { group: 'Team', options: [
    { label: 'View team members', value: 'team.view' },
    { label: 'Invite team members', value: 'team.invite' },
    { label: 'Edit team members', value: 'team.edit' },
    { label: 'Remove team members', value: 'team.remove' },
  ]},
  { group: 'Agency', options: [
    { label: 'View settings', value: 'agency.view_settings' },
    { label: 'Manage settings', value: 'agency.manage_settings' },
    { label: 'Manage roles', value: 'agency.manage_roles' },
  ]},
];

export default function RolesPermissions() {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[]
  });

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/my/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setRoles(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingRole(null);
    setFormData({ name: '', description: '', permissions: [] });
    setIsModalOpen(true);
  };

  const openEditModal = (role: CustomRole) => {
    setEditingRole(role);
    setFormData({ name: role.name, description: role.description || '', permissions: role.permissions || [] });
    setIsModalOpen(true);
  };

  const togglePermission = (perm: string) => {
    if (formData.permissions.includes(perm)) {
      setFormData(prev => ({ ...prev, permissions: prev.permissions.filter(p => p !== perm) }));
    } else {
      setFormData(prev => ({ ...prev, permissions: [...prev.permissions, perm] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = getAccessToken();
      const url = editingRole 
        ? `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/my/roles/${editingRole.id}`
        : `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/my/roles`;
        
      const res = await fetch(url, {
        method: editingRole ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        fetchRoles();
      } else {
        alert(await res.text());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: CustomRole) => {
    if (role.isSystem) return;
    if (role._count.staff > 0) {
      alert('Cannot delete a role that is assigned to members.');
      return;
    }
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      const token = getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agency/my/roles/${role.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchRoles();
      else alert(await res.text());
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="py-8 text-center text-text-secondary">Loading roles...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-medium leading-6 text-text-primary">Roles & Permissions</h3>
          <p className="mt-1 text-sm text-text-secondary">Manage your organization's roles and assign granular permissions.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500"
        >
          <Plus className="-ml-0.5 mr-1.5 h-5 w-5" />
          Create Role
        </button>
      </div>

      <div className="overflow-hidden bg-surface shadow sm:rounded-md">
        <ul role="list" className="divide-y divide-gray-200">
          {roles.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-text-secondary">No roles found.</li>
          ) : (
            roles.map(role => (
              <li key={role.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition-colors flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-medium text-text-primary">{role.name} {role.isSystem && <span className="ml-2 inline-flex items-center rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-text-secondary">System</span>}</h4>
                  <p className="text-sm text-text-secondary mt-1">{role.description || 'No description'}</p>
                  <div className="mt-2 text-xs text-text-secondary flex gap-4">
                    <span>{role._count.staff} members assigned</span>
                    <span>{role.permissions.length} permissions</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => openEditModal(role)} className="text-text-muted hover:text-text-secondary">
                    <Edit2 className="h-5 w-5" />
                  </button>
                  {!role.isSystem && role._count.staff === 0 && (
                    <button onClick={() => handleDelete(role)} className="text-red-400 hover:text-red-500">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500/75">
          <div className="bg-surface rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-border-strong">
              <h3 className="text-lg font-medium text-text-primary">{editingRole ? 'Edit Role' : 'Create Role'}</h3>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="px-6 py-4 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-text-primary">Role Name</label>
                  <input
                    required
                    disabled={editingRole?.isSystem}
                    className="mt-1 block w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm disabled:bg-surface-muted disabled:text-text-secondary"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary">Description</label>
                  <input
                    disabled={editingRole?.isSystem}
                    className="mt-1 block w-full rounded-md border-border-strong shadow-sm focus:border-accent focus:ring-accent sm:text-sm disabled:bg-surface-muted disabled:text-text-secondary"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-3">Permissions</label>
                  <div className="space-y-6">
                    {PERMISSION_GROUPS.map(group => (
                      <div key={group.group}>
                        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{group.group}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {group.options.map(opt => (
                            <label key={opt.value} className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-border-strong text-accent focus:ring-accent"
                                checked={formData.permissions.includes(opt.value)}
                                onChange={() => togglePermission(opt.value)}
                              />
                              <span className="text-sm text-text-primary">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-border-strong flex justify-end gap-3 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-md bg-surface px-3 py-2 text-sm font-semibold text-text-primary shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
