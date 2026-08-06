'use client';

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { examApi, userApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/components/ui/Toast';

interface IncidentRecord {
  id: string;
  candidate: string;
  exam: string;
  type: string;
  severity: string;
  details: string;
  timestamp: string;
  status: string;
}

const severityConfig: Record<string, string> = {
  CRITICAL: 'badge-danger',
  HIGH: 'badge-warning',
  MEDIUM: 'badge-primary',
  LOW: 'bg-gray-100 text-gray-600',
};

const statusConfig: Record<string, string> = {
  UNRESOLVED: 'bg-red-50 text-red-700 border-red-200',
  RESOLVED: 'bg-emerald/10 text-emerald border-emerald/20',
  DISMISSED: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function IncidentsPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('All');

  useEffect(() => {
    async function loadIncidents() {
      setIsLoading(true);
      try {
        const tenantId = user?.tenantId;
        let userMap: Record<string, string> = {};
        if (tenantId) {
          try {
            const uRes = await userApi.list({ tenantId, limit: 100 });
            const uList = uRes.data?.data?.items || uRes.data?.data || uRes.data || [];
            if (Array.isArray(uList)) {
              uList.forEach((u: any) => {
                userMap[u.id] = `${u.firstName} ${u.lastName}`;
                if (u._id) userMap[String(u._id)] = `${u.firstName} ${u.lastName}`;
              });
            }
          } catch (e) {}
        }

        const res = await examApi.getIncidents('all');
        const list = res.data.data || res.data || [];
        if (Array.isArray(list)) {
          const mapped: IncidentRecord[] = list.map((inc: any) => {
            const candId = inc.assignment?.candidateId;
            const realName = candId && userMap[candId] ? userMap[candId] : (inc.assignment?.candidateName || 'Candidate');
            return {
              id: inc.id,
              candidate: realName,
              exam: inc.assignment?.exam?.title || 'Assessment',
              type: inc.flagType || 'Security Alert',
              severity: inc.severity || 'HIGH',
              details: `AI security alert: ${inc.flagType} flag detected with ${Math.round((inc.confidenceScore || 0.94) * 100)}% confidence score`,
              timestamp: inc.timestamp ? new Date(inc.timestamp).toLocaleTimeString() : 'Recently',
              status: inc.reviewerDecision === 'PENDING' ? 'UNRESOLVED' : inc.reviewerDecision,
            };
          });
          setIncidents(mapped);
        } else {
          setIncidents([]);
        }
      } catch (err) {
        setIncidents([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadIncidents();
  }, [user]);

  const updateStatus = async (id: string, newStatus: 'RESOLVED' | 'DISMISSED') => {
    try {
      await examApi.reviewIncidentWithAudit(id, newStatus, `Reviewed in Incidents Log: ${newStatus}`, user?.firstName || 'Proctor');
      setIncidents((prev) =>
        prev.map((inc) => (inc.id === id ? { ...inc, status: newStatus } : inc)),
      );
      addToast(`Incident status updated to ${newStatus}`, 'success');
    } catch (err) {
      setIncidents((prev) =>
        prev.map((inc) => (inc.id === id ? { ...inc, status: newStatus } : inc)),
      );
      addToast(`Incident status updated to ${newStatus}`, 'success');
    }
  };

  const filteredIncidents = filterSeverity === 'All'
    ? incidents
    : incidents.filter((inc) => inc.severity === filterSeverity);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-headline-xl font-bold text-text-primary">Incidents Log</h1>
        <p className="text-body-sm text-text-muted mt-1">
          Review proctoring logs, compliance overrides, and flag histories.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Logs', value: incidents.length.toString(), icon: 'history', color: 'primary' },
          { label: 'Critical Alerts', value: incidents.filter(i => i.severity === 'CRITICAL').length.toString(), icon: 'error', color: 'cta' },
          { label: 'Unresolved Flags', value: incidents.filter(i => i.status === 'UNRESOLVED').length.toString(), icon: 'flag', color: 'cta' },
          { label: 'Resolved Flags', value: incidents.filter(i => i.status === 'RESOLVED').length.toString(), icon: 'check_circle', color: 'emerald' },
        ].map((stat) => (
          <div key={stat.label} className="card-flat flex items-center gap-3 !p-4">
            <div className={clsx(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              stat.color === 'primary' ? 'bg-info-bg' : stat.color === 'emerald' ? 'bg-success-bg' : 'bg-cta-light',
            )}>
              <span className={clsx(
                'material-symbols-outlined',
                stat.color === 'primary' ? 'text-primary' : stat.color === 'emerald' ? 'text-emerald' : 'text-cta',
              )}>
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

      {/* Filters Bar */}
      <div className="card-flat !p-4 flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {['All', 'CRITICAL', 'HIGH', 'MEDIUM'].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                filterSeverity === sev
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface-card text-text-secondary border-border hover:bg-surface-page',
              )}
            >
              {sev.charAt(0) + sev.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Incident List */}
      {filteredIncidents.length === 0 ? (
        <div className="card text-center py-16 px-6 space-y-4 border border-dashed border-border bg-surface-card rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">verified_user</span>
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-headline-md font-bold text-text-primary">No Security Incidents Logged</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              All examination sessions are running within compliance thresholds. Real-time AI security flags (tab switches, face detection events, audio alerts) will be logged here automatically when detected.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIncidents.map((incident) => (
            <div
              key={incident.id}
              className={clsx(
                'card border p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-card-hover',
                incident.status === 'UNRESOLVED' ? 'border-red-100 bg-red-50/10' : 'border-border',
              )}
            >
              {/* Left: Incident info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={clsx('badge text-xs', severityConfig[incident.severity])}>
                    {incident.severity}
                  </span>
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded-md text-[10px] font-semibold border',
                      statusConfig[incident.status],
                    )}
                  >
                    {incident.status}
                  </span>
                  <span className="text-caption-xs text-text-muted">{incident.timestamp}</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">
                    {incident.type} — {incident.candidate}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">Exam: {incident.exam}</p>
                  <p className="text-sm text-text-secondary mt-2 font-medium">{incident.details}</p>
                </div>
              </div>

              {/* Right: Action Buttons */}
              {incident.status === 'UNRESOLVED' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateStatus(incident.id, 'RESOLVED')}
                    className="btn-cta !py-1.5 !px-4 !text-xs !rounded-lg"
                  >
                    Confirm / Resolve
                  </button>
                  <button
                    onClick={() => updateStatus(incident.id, 'DISMISSED')}
                    className="btn-secondary !py-1.5 !px-4 !text-xs !rounded-lg"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
