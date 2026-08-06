'use client';

import { useRouter } from 'next/navigation';
import { StatCardSkeleton } from '@/components/ui/LoadingSkeleton';

export default function TeacherDashboard({ stats, recentExams, isLoading, formatDate }: { stats: any, recentExams: any[], isLoading: boolean, formatDate: (d: string) => string }) {
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
      <div className="flex justify-end">
        <button className="btn-cta" onClick={() => router.push('/dashboard/exams/create')}>
          <span className="material-symbols-outlined text-lg">add</span>
          Create New Exam
        </button>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in">
          <StatCard icon="quiz" label="My Exams" value={stats.totalExams?.toString() || '0'} change="" changeLabel="created by me" color="primary" />
          <StatCard icon="help_center" label="Question Bank" value={stats.totalQuestions?.toString() || '0'} change="" changeLabel="available to use" color="emerald" />
          <StatCard icon="warning" label="Pending Incidents" value={stats.pendingIncidents?.toString() || '0'} change="" changeLabel="requires review" color="cta" />
          <StatCard icon="assessment" label="Average Score" value={stats.averageScore || '-'} change="" changeLabel="across my exams" color="emerald" />
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Exams */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-headline-lg font-semibold text-text-primary">My Recent Exams</h2>
            <button
              className="text-sm text-cta hover:text-cta-hover font-medium transition-colors"
              onClick={() => router.push('/dashboard/exams')}
            >
              View All →
            </button>
          </div>

          {recentExams.length === 0 ? (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-4xl text-text-muted mb-3">quiz</span>
              <p className="text-sm text-text-muted">You haven&apos;t created any exams yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="table-cell text-left font-medium">Exam</th>
                    <th className="table-cell text-left font-medium">Status</th>
                    <th className="table-cell text-center font-medium">Candidates</th>
                    <th className="table-cell text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExams.map((exam) => (
                    <tr key={exam.id} className="table-row cursor-pointer" onClick={() => router.push('/dashboard/exams')}>
                      <td className="table-cell font-medium text-text-primary">{exam.title}</td>
                      <td className="table-cell">
                        <span className={statusBadge[exam.status] || 'badge-primary'}>
                          {statusLabel[exam.status] || exam.status}
                        </span>
                      </td>
                      <td className="table-cell text-center">{exam._count?.assignments ?? exam.assignments?.length ?? 0}</td>
                      <td className="table-cell text-right text-text-muted">{formatDate(exam.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card">
            <h2 className="text-headline-lg font-semibold text-text-primary mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { icon: 'upload_file', label: 'Import Questions', color: 'text-primary', href: '/dashboard/questions' },
                { icon: 'checklist', label: 'Review Proctoring Incidents', color: 'text-cta', href: '/dashboard/incidents' },
                { icon: 'assessment', label: 'View Results Analytics', color: 'text-emerald', href: '/dashboard/analytics' },
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
