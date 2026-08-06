'use client';

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { userApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { TableSkeleton, StatCardSkeleton } from '@/components/ui/LoadingSkeleton';

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

const statusDot: Record<string, string> = {
  Active: 'bg-emerald',
  Suspended: 'bg-red-500',
  Inactive: 'bg-gray-400',
};

export default function CandidatesPage() {
  const { addToast } = useToastStore();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', firstName: '', lastName: '', password: 'Candidate@123' });
  const [addLoading, setAddLoading] = useState(false);
  const { user } = useAuthStore();
  const tenantId = user?.tenantId;

  const fetchCandidates = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeTenantId = tenantId || user?.tenantId;
      const params: Record<string, unknown> = { role: 'CANDIDATE', tenantId: activeTenantId };
      if (searchQuery) params.search = searchQuery;

      const response = await userApi.list(params);
      const resObj = response.data;
      let list: any[] = [];
      if (Array.isArray(resObj)) {
        list = resObj;
      } else if (Array.isArray(resObj?.data?.data)) {
        list = resObj.data.data;
      } else if (Array.isArray(resObj?.data?.items)) {
        list = resObj.data.items;
      } else if (Array.isArray(resObj?.data?.users)) {
        list = resObj.data.users;
      } else if (Array.isArray(resObj?.data)) {
        list = resObj.data;
      } else if (Array.isArray(resObj?.items)) {
        list = resObj.items;
      } else if (Array.isArray(resObj?.users)) {
        list = resObj.users;
      }

      setCandidates(list);
    } catch {
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, tenantId, user]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleAddCandidate = async () => {
    if (!addForm.email || !addForm.firstName || !addForm.lastName) {
      addToast('Please fill all required fields', 'warning');
      return;
    }
    setAddLoading(true);
    try {
      await userApi.create({ ...addForm, role: 'CANDIDATE', tenantId });
      addToast(`Candidate ${addForm.firstName} ${addForm.lastName} added`, 'success');
      setAddOpen(false);
      setAddForm({ email: '', firstName: '', lastName: '', password: 'Candidate@123' });
      fetchCandidates();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to add candidate', 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const getStatus = (c: Candidate) => (c.isActive ? 'Active' : 'Inactive');

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  const activeCount = candidates.filter((c) => c.isActive).length;
  const inactiveCount = candidates.filter((c) => !c.isActive).length;

  const handleToggleStatus = async (candidate: Candidate) => {
    try {
      await userApi.update(candidate.id, { isActive: !candidate.isActive });
      addToast(`Candidate ${candidate.firstName} ${candidate.isActive ? 'deactivated' : 'activated'}`, 'success');
      fetchCandidates();
    } catch (err: any) {
      addToast('Failed to update candidate status', 'error');
    }
  };

  const handleDeleteCandidate = async (candidate: Candidate) => {
    if (!confirm(`Are you sure you want to delete candidate ${candidate.firstName} ${candidate.lastName}?`)) return;
    try {
      await userApi.delete(candidate.id);
      addToast('Candidate deleted successfully', 'success');
      fetchCandidates();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to delete candidate', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-xl font-bold text-text-primary">Candidates</h1>
          <p className="text-body-sm text-text-muted mt-1">
            Manage assessment candidates, invitations, and compliance scores.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <label className="btn-secondary cursor-pointer text-xs sm:text-sm">
            <span className="material-symbols-outlined text-lg">upload_file</span>
            Import List
            <input type="file" className="hidden" accept=".csv" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;

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

                  if (emailIdx === -1) {
                    addToast('CSV must contain an "email" column', 'error');
                    return;
                  }

                  const candidatesToImport = [];
                  for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    if (!cols[emailIdx]) continue;

                    candidatesToImport.push({
                      email: cols[emailIdx],
                      firstName: firstIdx !== -1 && cols[firstIdx] ? cols[firstIdx] : 'Imported',
                      lastName: lastIdx !== -1 && cols[lastIdx] ? cols[lastIdx] : 'Candidate',
                    });
                  }

                  if (candidatesToImport.length === 0) {
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

                  addToast(`Importing ${candidatesToImport.length} candidates...`, 'info');

                  let createdCount = 0;
                  for (const candidateData of candidatesToImport) {
                    try {
                      await userApi.create({
                        ...candidateData,
                        password: 'Candidate@123',
                        tenantId: tenantId !== 'platform-global' ? tenantId : undefined,
                        role: 'CANDIDATE'
                      });
                      createdCount++;
                    } catch {
                      // ignore duplicates
                    }
                  }

                  addToast(`Successfully imported ${createdCount} candidates!`, 'success');
                  fetchCandidates();
                } catch {
                  addToast('Failed to import CSV file', 'error');
                }
              };
              reader.readAsText(file);
            }} />
          </label>
          <button className="btn-cta text-xs sm:text-sm" onClick={() => setAddOpen(true)}>
            <span className="material-symbols-outlined text-lg">person_add</span>
            Add Candidate
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Total Candidates', value: candidates.length.toString(), icon: 'school', color: 'primary' },
            { label: 'Active', value: activeCount.toString(), icon: 'play_circle', color: 'emerald' },
            { label: 'Inactive', value: inactiveCount.toString(), icon: 'pause_circle', color: 'cta' },
            { label: 'Added Today', value: candidates.filter((c) => new Date(c.createdAt).toDateString() === new Date().toDateString()).length.toString(), icon: 'today', color: 'emerald' },
          ].map((stat) => (
            <div key={stat.label} className="card-flat flex items-center gap-3 !p-4">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center',
                stat.color === 'primary' ? 'bg-info-bg' : stat.color === 'emerald' ? 'bg-success-bg' : 'bg-cta-light')}>
                <span className={clsx('material-symbols-outlined',
                  stat.color === 'primary' ? 'text-primary' : stat.color === 'emerald' ? 'text-emerald' : 'text-cta')}>
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

      {/* Search & Filter */}
      <div className="card-flat !p-4 flex items-center gap-4">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg">search</span>
          <input
            type="text"
            placeholder="Search candidates by name or email..."
            className="input !pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Candidates Table */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : candidates.length === 0 ? (
        <div className="card text-center py-12">
          <span className="material-symbols-outlined text-5xl text-text-muted mb-4">school</span>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No candidates found</h3>
          <p className="text-body-sm text-text-muted mb-6">Add your first candidate to get started.</p>
          <button className="btn-cta" onClick={() => setAddOpen(true)}>
            <span className="material-symbols-outlined text-lg">person_add</span>
            Add Candidate
          </button>
        </div>
      ) : (
        <div className="card !p-0 overflow-visible">
          <table className="w-full">
            <thead>
              <tr className="table-header border-b border-border">
                <th className="table-cell text-left font-medium">Candidate</th>
                <th className="table-cell text-center font-medium w-32">Status</th>
                <th className="table-cell text-left font-medium w-36">Registered</th>
                <th className="table-cell w-12"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => {
                const status = getStatus(candidate);
                return (
                  <tr key={candidate.id} className="table-row cursor-pointer">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-cta/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-cta text-xs font-bold">
                            {(candidate.firstName?.[0] || '') + (candidate.lastName?.[0] || '')}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">{candidate.firstName} {candidate.lastName}</p>
                          <p className="text-caption-xs text-text-muted">{candidate.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(candidate);
                          }}
                          className={clsx(
                            'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5',
                            candidate.isActive
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
                    <td className="table-cell text-sm text-text-muted">{formatDate(candidate.createdAt)}</td>
                    <td className="table-cell">
                      <div className="relative group">
                        <button className="p-1 rounded-lg hover:bg-surface-page transition-colors">
                          <span className="material-symbols-outlined text-text-muted text-lg">more_vert</span>
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-page rounded-t-xl"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(candidate);
                            }}
                          >
                            <span className="material-symbols-outlined text-base">
                              {candidate.isActive ? 'person_off' : 'person'}
                            </span>
                            {candidate.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-bg rounded-b-xl border-t border-border"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCandidate(candidate);
                            }}
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

      {/* Add Candidate Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Candidate"
        description="Create a new candidate account."
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="btn-cta" onClick={handleAddCandidate} disabled={addLoading}>
              {addLoading ? 'Adding...' : 'Add Candidate'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">First Name</label>
              <input className="input" placeholder="Jane" value={addForm.firstName} onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })} />
            </div>
            <div>
              <label className="input-label">Last Name</label>
              <input className="input" placeholder="Doe" value={addForm.lastName} onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="input-label">Email Address</label>
            <input className="input" type="email" placeholder="jane@student.edu" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
          </div>
          <div>
            <label className="input-label">Initial Password</label>
            <input className="input" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} />
            <p className="text-caption-xs text-text-muted mt-1">Candidate will be prompted to change this on first login.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
