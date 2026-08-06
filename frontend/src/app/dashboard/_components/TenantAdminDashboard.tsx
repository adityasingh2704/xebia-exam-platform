'use client';

import { useRouter } from 'next/navigation';
import { StatCardSkeleton } from '@/components/ui/LoadingSkeleton';

export default function TenantAdminDashboard({ stats, recentExams, isLoading, formatDate }: { stats: any, recentExams: any[], isLoading: boolean, formatDate: (d: string) => string }) {
  const router = useRouter();

  const statusBadge: Record<string, string> = {
    DRAFT: 'badge-warning',
    PUBLISHED: 'badge-primary',
    SCHEDULED: 'badge-cta',
    IN_PROGRESS: 'badge-cta',
    COMPLETED: 'badge-success',
  };

  const statusLabel: Record<string, string> = {
    DRAFT: 'Draft',
    PUBLISHED: 'Published',
    SCHEDULED: 'Scheduled',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in">
          <StatCard icon="group" label="Team Members" value={stats.totalUsers?.toString() || '0'} change="" changeLabel="active tenant users" color="primary" />
          <StatCard icon="school" label="Candidates" value={stats.totalCandidates?.toString() || '0'} change="" changeLabel="enrolled candidates" color="emerald" />
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenant Team Members */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-headline-lg font-semibold text-text-primary">Tenant Management Overview</h2>
            <button
              className="text-sm text-cta hover:text-cta-hover font-medium transition-colors"
              onClick={() => router.push('/dashboard/users')}
            >
              Manage Users →
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-surface-page border border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary">User & Staff Control</h3>
                <p className="text-xs text-text-muted mt-0.5">Manage teachers, proctors, and candidate accounts within your tenant organization.</p>
              </div>
              <button
                onClick={() => router.push('/dashboard/users')}
                className="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              >
                Open User Roster
              </button>
            </div>

            <div className="p-4 rounded-xl bg-surface-page border border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Candidate Roster & History</h3>
                <p className="text-xs text-text-muted mt-0.5">View enrolled candidates, profile details, and organization performance.</p>
              </div>
              <button
                onClick={() => router.push('/dashboard/candidates')}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald text-white rounded-lg hover:bg-emerald-hover transition-colors"
              >
                View Candidates
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card">
            <h2 className="text-headline-lg font-semibold text-text-primary mb-4">Tenant Quick Actions</h2>
            <div className="space-y-2">
              {[
                { icon: 'person_add', label: 'Manage Users', color: 'text-emerald', href: '/dashboard/users' },
                { icon: 'school', label: 'Candidates Roster', color: 'text-primary', href: '/dashboard/candidates' },
                { icon: 'assessment', label: 'Tenant Analytics', color: 'text-cta', href: '/dashboard/analytics' },
                { icon: 'settings', label: 'Tenant Settings', color: 'text-primary', href: '/dashboard/settings' },
                { icon: 'history', label: 'Audit Log', color: 'text-text-muted', href: '/dashboard/audit' },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => router.push(action.href)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-page transition-colors text-left"
                >
                  <span className={`material-symbols-outlined ${action.color}`}>{action.icon}</span>
                  <span className="text-sm font-medium text-text-primary">{action.label}</span>
                  <span className="material-symbols-outlined text-text-muted ml-auto text-lg">chevron_right</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  change,
  changeLabel,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  change: string;
  changeLabel: string;
  color: 'primary' | 'emerald' | 'cta';
}) {
  const colorMap = {
    primary: { bg: 'bg-info-bg', text: 'text-primary', icon: 'text-primary' },
    emerald: { bg: 'bg-success-bg', text: 'text-emerald', icon: 'text-emerald' },
    cta: { bg: 'bg-cta-light', text: 'text-cta', icon: 'text-cta' },
  };

  const c = colorMap[color];

  return (
    <div className="card group cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
          <span className={`material-symbols-outlined ${c.icon}`}>{icon}</span>
        </div>
        <span className="material-symbols-outlined text-text-muted text-lg opacity-0 group-hover:opacity-100 transition-opacity">
          open_in_new
        </span>
      </div>
      <div>
        <p className="stat-value">{value}</p>
        <p className="stat-label mt-1">{label}</p>
      </div>
      {change && (
        <div className="flex items-center gap-1 mt-2">
          <span className={`text-xs font-medium ${c.text}`}>{change}</span>
          <span className="text-caption-xs text-text-muted">{changeLabel}</span>
        </div>
      )}
      {!change && changeLabel && (
        <div className="mt-2">
          <span className="text-caption-xs text-text-muted">{changeLabel}</span>
        </div>
      )}
    </div>
  );
}
