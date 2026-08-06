'use client';

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { userApi } from '@/lib/api';
import { useToastStore } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

const roleConfig: Record<string, { badge: string; label: string }> = {
  PLATFORM_ADMIN: { badge: 'badge-cta', label: 'Platform Admin' },
  TENANT_ADMIN: { badge: 'badge-cta', label: 'Tenant Admin' },
  EXAM_MANAGER: { badge: 'badge-primary', label: 'Exam Manager' },
  TEACHER: { badge: 'badge-success', label: 'Teacher' },
  PROCTOR: { badge: 'bg-blue-50 text-blue-700', label: 'Proctor' },
  CANDIDATE: { badge: 'bg-gray-100 text-gray-600', label: 'Candidate' },
};

export default function UsersPage() {
  const { addToast } = useToastStore();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [page, setPage] = useState(1);

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', firstName: '', lastName: '', role: 'TEACHER' });
  const [inviteLoading, setInviteLoading] = useState(false);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: '', firstName: '', lastName: '', role: 'TEACHER' });
  const [editLoading, setEditLoading] = useState(false);

  const handleEditSubmit = async () => {
    if (!editForm.firstName || !editForm.lastName) {
      addToast('First name and last name are required', 'warning');
      return;
    }
    setEditLoading(true);
    try {
      await userApi.update(editForm.id, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        role: editForm.role
      });
      addToast('User updated successfully', 'success');
      setEditOpen(false);
      fetchUsers();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to update user', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addToast('Parsing CSV...', 'info');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length <= 1) {
          addToast('CSV is empty or missing headers', 'warning');
          return;
        }

        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        const emailIdx = headers.indexOf('email');
        const firstIdx = headers.indexOf('firstname');
        const lastIdx = headers.indexOf('lastname');
        const roleIdx = headers.indexOf('role');

        if (emailIdx === -1) {
          addToast('CSV must contain an "email" column', 'error');
          return;
        }

        const usersToImport = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (!cols[emailIdx]) continue;

          usersToImport.push({
            email: cols[emailIdx],
            firstName: firstIdx !== -1 && cols[firstIdx] ? cols[firstIdx] : 'Imported',
            lastName: lastIdx !== -1 && cols[lastIdx] ? cols[lastIdx] : 'User',
            role: roleIdx !== -1 && cols[roleIdx] ? cols[roleIdx].toUpperCase() : 'TEACHER',
          });
        }

        if (usersToImport.length === 0) {
          addToast('No valid records found in CSV', 'warning');
          return;
        }

        let tenantId = 'platform-global';
        try {
          const token = localStorage.getItem('accessToken');
          if (token) {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(window.atob(base64));
            if (payload.tenantId) {
              tenantId = payload.tenantId;
            }
          }
        } catch {
          // ignore
        }

        await userApi.import(tenantId, usersToImport);
        addToast(`Successfully imported ${usersToImport.length} users!`, 'success');
        fetchUsers();
      } catch (err: any) {
        addToast(err.response?.data?.message || 'Failed to import users', 'error');
      }
    };
    reader.readAsText(file);
  };

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (searchQuery) params.search = searchQuery;
      if (roleFilter !== 'All') params.role = roleFilter;

      const response = await userApi.list(params);
      const resObj = response.data;
      let list: any[] = [];
      if (Array.isArray(resObj)) list = resObj;
      else if (Array.isArray(resObj?.data)) list = resObj.data;
      else if (Array.isArray(resObj?.data?.items)) list = resObj.data.items;
      else if (Array.isArray(resObj?.data?.users)) list = resObj.data.users;
      else if (Array.isArray(resObj?.items)) list = resObj.items;
      else if (Array.isArray(resObj?.users)) list = resObj.users;

      setUsers(list);
    } catch {
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.firstName || !inviteForm.lastName) {
      addToast('Please fill all required fields', 'warning');
      return;
    }
    setInviteLoading(true);
    try {
      await userApi.invite(inviteForm);
      addToast(`Invitation sent to ${inviteForm.email}`, 'success');
      setInviteOpen(false);
      setInviteForm({ email: '', firstName: '', lastName: '', role: 'TEACHER' });
      fetchUsers();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to send invitation', 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleDeactivate = async (user: User) => {
    try {
      await userApi.update(user.id, { isActive: !user.isActive });
      addToast(`User ${user.isActive ? 'deactivated' : 'activated'}`, 'success');
      fetchUsers();
    } catch {
      addToast('Failed to update user status', 'error');
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Are you sure you want to delete user ${user.firstName} ${user.lastName}?`)) return;
    try {
      await userApi.delete(user.id);
      addToast('User deleted successfully', 'success');
      fetchUsers();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to delete user', 'error');
    }
  };

  const getStatus = (user: User) => {
    if (!user.isActive) return 'Inactive';
    if (!user.lastLoginAt) return 'Invited';
    return 'Active';
  };

  const statusDot: Record<string, string> = {
    Active: 'bg-emerald',
    Invited: 'bg-cta',
    Inactive: 'bg-gray-400',
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Never';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours < 24) return 'Today';
      if (diffHours < 48) return 'Yesterday';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-xl font-bold text-text-primary">Users</h1>
          <p className="text-body-sm text-text-muted mt-1">
            Manage team members and their roles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="btn-secondary cursor-pointer">
            <span className="material-symbols-outlined text-lg">upload_file</span>
            Bulk Import (CSV)
            <input type="file" className="hidden" accept=".csv" onChange={handleBulkImport} />
          </label>
          <button className="btn-cta" onClick={() => setInviteOpen(true)}>
            <span className="material-symbols-outlined text-lg">person_add</span>
            Invite User
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="card-flat !p-4 flex items-center gap-4">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg">search</span>
          <input
            type="text"
            placeholder="Search users by name or email..."
            className="input !pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="input !w-auto !min-w-[140px]"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="All">All Roles</option>
          <option value="TENANT_ADMIN">Tenant Admin</option>
          <option value="EXAM_MANAGER">Exam Manager</option>
          <option value="TEACHER">Teacher</option>
          <option value="PROCTOR">Proctor</option>
        </select>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : users.length === 0 ? (
        <div className="card text-center py-12">
          <span className="material-symbols-outlined text-5xl text-text-muted mb-4">group</span>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No users found</h3>
          <p className="text-body-sm text-text-muted mb-6">Invite your first team member to get started.</p>
          <button className="btn-cta" onClick={() => setInviteOpen(true)}>
            <span className="material-symbols-outlined text-lg">person_add</span>
            Invite User
          </button>
        </div>
      ) : (
        <div className="card !p-0 overflow-visible">
          <table className="w-full">
            <thead>
              <tr className="table-header border-b border-border">
                <th className="table-cell text-left font-medium">User</th>
                <th className="table-cell text-left font-medium w-32">Role</th>
                <th className="table-cell text-center font-medium w-24">Status</th>
                <th className="table-cell text-left font-medium w-36">Last Login</th>
                <th className="table-cell w-12"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const status = getStatus(user);
                return (
                  <tr key={user.id} className="table-row cursor-pointer">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary text-xs font-bold">
                            {(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{user.firstName} {user.lastName}</p>
                          <p className="text-caption-xs text-text-muted">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={clsx('badge text-xs', roleConfig[user.role]?.badge)}>
                        {roleConfig[user.role]?.label || user.role}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeactivate(user);
                          }}
                          className={clsx(
                            'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5',
                            user.isActive
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20'
                          )}
                          title="Click to toggle Active / Deactive status"
                        >
                          <span className={clsx('w-2 h-2 rounded-full', statusDot[status])} />
                          {status}
                        </button>
                      </div>
                    </td>
                    <td className="table-cell text-sm text-text-muted">{formatDate(user.lastLoginAt)}</td>
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
                                id: user.id,
                                firstName: user.firstName,
                                lastName: user.lastName,
                                role: user.role
                              });
                              setEditOpen(true);
                            }}
                          >
                            <span className="material-symbols-outlined text-base">edit</span> Edit
                          </button>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-page"
                            onClick={() => handleDeactivate(user)}
                          >
                            <span className="material-symbols-outlined text-base">
                              {user.isActive ? 'person_off' : 'person'}
                            </span>
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-bg rounded-b-xl border-t border-border"
                            onClick={() => handleDelete(user)}
                          >
                            <span className="material-symbols-outlined text-base">delete</span> Delete
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite User Modal */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite User"
        description="Send an invitation email to add a new team member."
        footer={
          <>
            <button className="btn-secondary" onClick={() => setInviteOpen(false)}>Cancel</button>
            <button className="btn-cta" onClick={handleInvite} disabled={inviteLoading}>
              {inviteLoading ? 'Sending...' : 'Send Invitation'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">First Name</label>
              <input
                className="input"
                placeholder="John"
                value={inviteForm.firstName}
                onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="input-label">Last Name</label>
              <input
                className="input"
                placeholder="Doe"
                value={inviteForm.lastName}
                onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="input-label">Email Address</label>
            <input
              className="input"
              type="email"
              placeholder="john@organisation.edu"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            />
          </div>
          <div>
            <label className="input-label">Role</label>
            <select
              className="input"
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
            >
              <option value="TEACHER">Teacher</option>
              <option value="EXAM_MANAGER">Exam Manager</option>
              <option value="PROCTOR">Proctor</option>
              <option value="TENANT_ADMIN">Tenant Admin</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit User"
        description="Update user profiles and roles in the database."
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">First Name</label>
              <input
                className="input"
                placeholder="First Name"
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="input-label">Last Name</label>
              <input
                className="input"
                placeholder="Last Name"
                value={editForm.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="input-label">Role</label>
            <select
              className="input"
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            >
              <option value="TEACHER">Teacher</option>
              <option value="EXAM_MANAGER">Exam Manager</option>
              <option value="PROCTOR">Proctor</option>
              <option value="TENANT_ADMIN">Tenant Admin</option>
              <option value="CANDIDATE">Candidate</option>
              <option value="PLATFORM_ADMIN">Platform Admin</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
