'use client';

import { useState, useEffect, useCallback } from 'react';
import { tenantApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/components/ui/Toast';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { clsx } from 'clsx';
import Modal from '@/components/ui/Modal';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  maxSeats: number;
  usedSeats: number;
}

export default function BillingPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Upgrade / Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [plan, setPlan] = useState('enterprise');
  const [maxSeats, setMaxSeats] = useState(500);
  const [isSaving, setIsSaving] = useState(false);

  const loadTenants = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await tenantApi.list({ limit: 100 });
      const data = res.data?.data || res.data;
      let list: Tenant[] = [];
      if (Array.isArray(data)) list = data;
      else if (data?.data && Array.isArray(data.data)) list = data.data;
      else if (data?.tenants && Array.isArray(data.tenants)) list = data.tenants;
      setTenants(list);
    } catch {
      addToast('Failed to load subscriptions data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const handleEditClick = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setPlan(tenant.plan);
    setMaxSeats(tenant.maxSeats);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!selectedTenant) return;
    setIsSaving(true);
    try {
      await tenantApi.update(selectedTenant.id, {
        plan,
        maxSeats
      });

      // Post audit log
      await tenantApi.createAuditLog(selectedTenant.id, {
        actor: user?.email || 'platform-admin',
        action: 'Update Subscription Plan',
        details: `Plan upgraded to: ${plan}, seat quota: ${maxSeats}`,
        ipAddress: '127.0.0.1'
      });

      addToast(`Subscription modified successfully for "${selectedTenant.name}"`, 'success');
      setEditOpen(false);
      setSelectedTenant(null);
      loadTenants();
    } catch (err) {
      addToast('Failed to update plan properties', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-headline-xl font-bold text-text-primary">Subscription & Billing Administration</h1>
        <p className="text-body-sm text-text-muted mt-1">
          Monitor subscription plans, allocate seats quota, and manage billing features in the database.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { tier: 'Enterprise Plan', price: '$999 / mo', seats: 'Up to 2000 seats', features: ['AI live proctoring monitoring', 'Judge0 sandbox compiler', 'Compliance reports'], color: 'border-primary bg-primary/5' },
          { tier: 'Professional Plan', price: '$499 / mo', seats: 'Up to 500 seats', features: ['Question banks & lists', 'Automated graded scoring', 'Email notification configs'], color: 'border-border' },
          { tier: 'Startup Plan', price: '$199 / mo', seats: 'Up to 100 seats', features: ['Core assessments tools', 'Basic candidate profiles', 'Immutable audit logs'], color: 'border-border' }
        ].map((p, idx) => (
          <div key={idx} className={clsx('card border relative flex flex-col', p.color)}>
            <h4 className="text-lg font-bold text-text-primary mb-1">{p.tier}</h4>
            <p className="text-2xl font-extrabold text-primary font-mono mb-4">{p.price}</p>
            <p className="text-sm font-semibold text-text-secondary mb-4">{p.seats}</p>
            <ul className="space-y-2 text-xs text-text-muted flex-1">
              {p.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-emerald">check_circle</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="card space-y-4">
        <h3 className="text-headline-lg font-bold text-text-primary">Active Subscriptions</h3>
        
        {isLoading ? (
          <TableSkeleton rows={3} cols={5} />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="table-header border-b border-border">
                <th className="table-cell text-left font-medium">Workspace Tenant</th>
                <th className="table-cell text-center font-medium">Plan Tier</th>
                <th className="table-cell text-center font-medium">Used Seats</th>
                <th className="table-cell text-center font-medium">Quota Limit</th>
                <th className="table-cell text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="table-row">
                  <td className="table-cell font-bold text-text-primary">{t.name}</td>
                  <td className="table-cell text-center">
                    <span className={clsx('badge text-xs font-bold uppercase tracking-wider',
                      t.plan === 'enterprise' ? 'badge-primary' : 'badge-success'
                    )}>{t.plan}</span>
                  </td>
                  <td className="table-cell text-center text-sm font-semibold text-text-secondary">{t.usedSeats || 0}</td>
                  <td className="table-cell text-center text-sm font-semibold text-text-secondary">{t.maxSeats}</td>
                  <td className="table-cell text-right">
                    <button
                      className="btn-secondary !py-1 !px-2.5 !text-xs !rounded-lg"
                      onClick={() => handleEditClick(t)}
                    >
                      Modify Plan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modify Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Adjust Subscription Plan Quotas"
        description="Allocate workspace resources and seats directly inside MongoDB."
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="btn-cta" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Updating...' : 'Save Plan Changes'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {selectedTenant && (
            <p className="text-sm font-semibold text-text-primary">Tenant: {selectedTenant.name}</p>
          )}
          <div>
            <label className="input-label">Select Subscription Plan</label>
            <select
              className="input"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            >
              <option value="enterprise">Enterprise</option>
              <option value="professional">Professional</option>
              <option value="startup">Startup</option>
            </select>
          </div>
          <div>
            <label className="input-label">Seats Limit Quota</label>
            <input
              type="number"
              className="input font-mono"
              value={maxSeats}
              onChange={(e) => setMaxSeats(Number(e.target.value))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
