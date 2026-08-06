'use client';

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { tenantApi } from '@/lib/api';
import { useToastStore } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { TableSkeleton, StatCardSkeleton } from '@/components/ui/LoadingSkeleton';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  maxSeats: number;
  usedSeats: number;
  createdAt: string;
}

export default function TenantsPage() {
  const { addToast } = useToastStore();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', slug: '', plan: 'enterprise', maxSeats: 500, adminEmail: '', adminFirstName: '', adminLastName: '' });
  const [createLoading, setCreateLoading] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: '', name: '', slug: '', plan: 'enterprise', maxSeats: 500 });
  const [editLoading, setEditLoading] = useState(false);

  const handleEditSubmit = async () => {
    if (!editForm.name || !editForm.slug) {
      addToast('Name and slug are required', 'warning');
      return;
    }
    setEditLoading(true);
    try {
      await tenantApi.update(editForm.id, {
        name: editForm.name,
        slug: editForm.slug,
        plan: editForm.plan,
        maxSeats: parseInt(editForm.maxSeats as any)
      });
      addToast('Workspace updated successfully', 'success');
      setEditOpen(false);
      fetchTenants();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to update workspace', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  const fetchTenants = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await tenantApi.list();
      const resObj = response.data;
      let list: any[] = [];
      if (Array.isArray(resObj)) list = resObj;
      else if (Array.isArray(resObj?.data)) list = resObj.data;
      else if (Array.isArray(resObj?.data?.items)) list = resObj.data.items;
      else if (Array.isArray(resObj?.data?.tenants)) list = resObj.data.tenants;
      else if (Array.isArray(resObj?.items)) list = resObj.items;
      else if (Array.isArray(resObj?.tenants)) list = resObj.tenants;

      setTenants(list);
    } catch {
      setTenants([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleCreate = async () => {
    if (!createForm.name || !createForm.slug) {
      addToast('Name and slug are required', 'warning');
      return;
    }
    setCreateLoading(true);
    try {
      await tenantApi.create(createForm);
      addToast(`Tenant "${createForm.name}" created successfully`, 'success');
      setCreateOpen(false);
      setCreateForm({ name: '', slug: '', plan: 'enterprise', maxSeats: 500, adminEmail: '', adminFirstName: '', adminLastName: '' });
      fetchTenants();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to create tenant', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleStatus = async (tenant: Tenant) => {
    const newStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await tenantApi.update(tenant.id, { status: newStatus });
      addToast(`Tenant ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'}`, 'success');
      fetchTenants();
    } catch {
      addToast('Failed to update tenant status', 'error');
    }
  };

  const handleDelete = async (tenant: Tenant) => {
    if (!confirm(`Are you sure you want to delete workspace "${tenant.name}"? This action cannot be undone.`)) return;
    try {
      await tenantApi.delete(tenant.id);
      addToast('Workspace deleted successfully', 'success');
      fetchTenants();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to delete workspace', 'error');
    }
  };

  const activeTenants = tenants.filter((t) => t.status === 'ACTIVE');
  const totalSeats = tenants.reduce((s, t) => s + (t.usedSeats || 0), 0);
  const maxSeats = tenants.reduce((s, t) => s + (t.maxSeats || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-xl font-bold text-text-primary">Tenants</h1>
          <p className="text-body-sm text-text-muted mt-1">
            Manage multi-tenant workspace credentials, database pools, and plans.
          </p>
        </div>
        <button className="btn-cta" onClick={() => setCreateOpen(true)}>
          <span className="material-symbols-outlined text-lg">add_box</span>
          New Tenant Workspace
        </button>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Tenants', value: activeTenants.length.toString(), icon: 'apartment', color: 'primary' },
            { label: 'Total Allocated Seats', value: `${totalSeats} / ${maxSeats}`, icon: 'groups', color: 'emerald' },
            { label: 'System Health', value: '100% OK', icon: 'check_circle', color: 'emerald' },
            { label: 'Total Tenants', value: tenants.length.toString(), icon: 'dns', color: 'primary' },
          ].map((stat) => (
            <div key={stat.label} className="card-flat flex items-center gap-3 !p-4">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center',
                stat.color === 'primary' ? 'bg-info-bg' : 'bg-success-bg')}>
                <span className={clsx('material-symbols-outlined',
                  stat.color === 'primary' ? 'text-primary' : 'text-emerald')}>
                  {stat.icon}
                </span>
              </div>
              <div>
                <p className="text-xl font-bold text-text-primary">{stat.value}</p>
                <p className="text-caption-xs text-text-muted">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tenants Table */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : tenants.length === 0 ? (
        <div className="card text-center py-12">
          <span className="material-symbols-outlined text-5xl text-text-muted mb-4">apartment</span>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No tenants yet</h3>
          <p className="text-body-sm text-text-muted mb-6">Create your first tenant workspace to get started.</p>
          <button className="btn-cta" onClick={() => setCreateOpen(true)}>
            <span className="material-symbols-outlined text-lg">add_box</span>
            New Tenant Workspace
          </button>
        </div>
      ) : (
        <div className="card !p-0 overflow-visible">
          <table className="w-full">
            <thead>
              <tr className="table-header border-b border-border">
                <th className="table-cell text-left font-medium">Organisation Name</th>
                <th className="table-cell text-left font-medium">Slug</th>
                <th className="table-cell text-center font-medium w-32">Plan</th>
                <th className="table-cell text-center font-medium w-36">Seats Utilized</th>
                <th className="table-cell text-center font-medium w-32">Status</th>
                <th className="table-cell w-12"></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="table-row cursor-pointer">
                  <td className="table-cell font-semibold text-text-primary">{tenant.name}</td>
                  <td className="table-cell text-sm text-text-muted font-mono">{tenant.slug}</td>
                  <td className="table-cell text-center">
                    <span className={clsx('badge text-xs font-semibold',
                      tenant.plan === 'enterprise' ? 'badge-primary' : tenant.plan === 'professional' ? 'badge-success' : 'badge-warning')}>
                      {tenant.plan?.charAt(0).toUpperCase() + tenant.plan?.slice(1)}
                    </span>
                  </td>
                  <td className="table-cell text-center text-sm text-text-secondary">
                    {tenant.usedSeats} / {tenant.maxSeats}
                  </td>
                  <td className="table-cell">
                    <div className="flex justify-center">
                      <button
                        onClick={() => toggleStatus(tenant)}
                        className={clsx(
                          'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
                          tenant.status === 'ACTIVE'
                            ? 'bg-emerald/10 text-emerald border-emerald/20 hover:bg-emerald/20'
                            : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
                        )}
                      >
                        {tenant.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                      </button>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="relative group">
                      <button className="p-1 rounded-lg hover:bg-surface-page transition-colors">
                        <span className="material-symbols-outlined text-text-muted text-lg">more_vert</span>
                      </button>
                      <div className="absolute right-0 top-full mt-1 w-40 bg-surface-card rounded-xl shadow-lg border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-page rounded-t-xl"
                          onClick={() => {
                            setEditForm({
                              id: tenant.id,
                              name: tenant.name,
                              slug: tenant.slug,
                              plan: tenant.plan,
                              maxSeats: tenant.maxSeats
                            });
                            setEditOpen(true);
                          }}
                        >
                          <span className="material-symbols-outlined text-base">edit</span> Edit
                        </button>
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-page"
                          onClick={() => toggleStatus(tenant)}
                        >
                          <span className="material-symbols-outlined text-base">
                            {tenant.status === 'ACTIVE' ? 'pause_circle' : 'play_circle'}
                          </span>
                          {tenant.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-bg rounded-b-xl border-t border-border"
                          onClick={() => handleDelete(tenant)}
                        >
                          <span className="material-symbols-outlined text-base">delete</span> Delete
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Tenant Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Tenant Workspace"
        description="Set up a new isolated tenant environment."
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn-cta" onClick={handleCreate} disabled={createLoading}>
              {createLoading ? 'Creating...' : 'Create Workspace'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Organisation Name</label>
            <input className="input" placeholder="ACME University" value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })} />
          </div>
          <div>
            <label className="input-label">URL Slug</label>
            <input className="input font-mono" placeholder="acme-university" value={createForm.slug}
              onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })} />
            <p className="text-caption-xs text-text-muted mt-1">Used in URLs and API calls. Must be unique.</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Admin First Name</label>
              <input className="input" placeholder="John" value={createForm.adminFirstName}
                onChange={(e) => setCreateForm({ ...createForm, adminFirstName: e.target.value })} />
            </div>
            <div>
              <label className="input-label">Admin Last Name</label>
              <input className="input" placeholder="Doe" value={createForm.adminLastName}
                onChange={(e) => setCreateForm({ ...createForm, adminLastName: e.target.value })} />
            </div>
          </div>
          
          <div>
            <label className="input-label">Admin Email</label>
            <input className="input" type="email" placeholder="admin@acme.edu" value={createForm.adminEmail}
              onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Plan</label>
              <select className="input" value={createForm.plan} onChange={(e) => setCreateForm({ ...createForm, plan: e.target.value })}>
                <option value="enterprise">Enterprise</option>
                <option value="professional">Professional</option>
                <option value="team">Team</option>
                <option value="developer">Developer</option>
              </select>
            </div>
            <div>
              <label className="input-label">Max Seats</label>
              <input className="input" type="number" value={createForm.maxSeats} min={1}
                onChange={(e) => setCreateForm({ ...createForm, maxSeats: parseInt(e.target.value) || 500 })} />
            </div>
          </div>
        </div>
      </Modal>

      {/* Edit Tenant Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Workspace"
        description="Update organisation details and plan parameters."
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="btn-cta" onClick={handleEditSubmit} disabled={editLoading}>
              {editLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">Organisation Name</label>
            <input className="input" placeholder="Organisation Name" value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') })} />
          </div>
          <div>
            <label className="input-label">URL Slug</label>
            <input className="input font-mono" placeholder="slug" value={editForm.slug}
              onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">Plan</label>
              <select className="input" value={editForm.plan} onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })}>
                <option value="enterprise">Enterprise</option>
                <option value="professional">Professional</option>
                <option value="team">Team</option>
                <option value="developer">Developer</option>
              </select>
            </div>
            <div>
              <label className="input-label">Max Seats</label>
              <input className="input" type="number" value={editForm.maxSeats} min={1}
                onChange={(e) => setEditForm({ ...editForm, maxSeats: parseInt(e.target.value) || 500 })} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
