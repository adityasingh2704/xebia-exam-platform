'use client';

import { useState, useEffect } from 'react';
import { tenantApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/components/ui/Toast';
import { SkeletonBlock } from '@/components/ui/LoadingSkeleton';

export default function SecurityPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordMinLength, setPasswordMinLength] = useState(8);
  const [requireSpecialChar, setRequireSpecialChar] = useState(true);
  const [lockoutThreshold, setLockoutThreshold] = useState(5);
  const [lockoutDuration, setLockoutDuration] = useState(15);
  const [firstLoginReset, setFirstLoginReset] = useState(true);

  const tenantId = user?.tenantId || 'platform-global';

  useEffect(() => {
    const loadPolicy = async () => {
      setIsLoading(true);
      try {
        const res = await tenantApi.getSecurityPolicy(tenantId);
        const policy = res.data?.data || res.data;
        if (policy) {
          setPasswordMinLength(policy.passwordMinLength ?? 8);
          setRequireSpecialChar(policy.requireSpecialChar ?? true);
          setLockoutThreshold(policy.lockoutThreshold ?? 5);
          setLockoutDuration(policy.lockoutDuration ?? 15);
          setFirstLoginReset(policy.firstLoginReset ?? true);
        }
      } catch (err) {
        addToast('Failed to load security policy', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    loadPolicy();
  }, [tenantId, addToast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await tenantApi.updateSecurityPolicy(tenantId, {
        passwordMinLength,
        requireSpecialChar,
        lockoutThreshold,
        lockoutDuration,
        firstLoginReset
      });

      // Post audit log
      await tenantApi.createAuditLog(tenantId, {
        actor: user?.email || 'platform-admin',
        action: 'Update Security Policy',
        details: `Password len: ${passwordMinLength}, lockout: ${lockoutThreshold} attempts`,
        ipAddress: '127.0.0.1'
      });

      addToast('Security policy saved in database successfully', 'success');
    } catch (err) {
      addToast('Failed to save security policy', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonBlock className="h-10 w-48" />
        <SkeletonBlock className="h-44 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-headline-xl font-bold text-text-primary">Authentication & Security Settings</h1>
        <p className="text-body-sm text-text-muted mt-1">
          Configure security policy guidelines, account lockouts, and reset criteria stored securely in MongoDB.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card space-y-6">
          <h3 className="text-headline-lg font-bold text-text-primary">Password Strength Rules</h3>
          <div className="space-y-4">
            <div>
              <label className="input-label">Minimum Password Length: <span className="font-mono font-bold text-primary">{passwordMinLength}</span> characters</label>
              <input
                type="range"
                min="6"
                max="20"
                value={passwordMinLength}
                onChange={(e) => setPasswordMinLength(Number(e.target.value))}
                className="w-full h-1 bg-surface-page rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <div>
                <p className="text-sm font-semibold text-text-primary">Require Special Characters</p>
                <p className="text-caption-xs text-text-muted">Enforces digits, symbols, and case variations</p>
              </div>
              <input
                type="checkbox"
                checked={requireSpecialChar}
                onChange={(e) => setRequireSpecialChar(e.target.checked)}
                className="checkbox"
              />
            </div>

            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <div>
                <p className="text-sm font-semibold text-text-primary">Enforce Reset on First Login</p>
                <p className="text-caption-xs text-text-muted">Requires candidates/users to choose new credentials upon onboarding</p>
              </div>
              <input
                type="checkbox"
                checked={firstLoginReset}
                onChange={(e) => setFirstLoginReset(e.target.checked)}
                className="checkbox"
              />
            </div>
          </div>
        </div>

        <div className="card space-y-6">
          <h3 className="text-headline-lg font-bold text-text-primary">Account Lockout Policy</h3>
          <div className="space-y-4">
            <div>
              <label className="input-label">Max Failed Attempts: <span className="font-mono font-bold text-cta">{lockoutThreshold}</span> attempts</label>
              <input
                type="range"
                min="3"
                max="10"
                value={lockoutThreshold}
                onChange={(e) => setLockoutThreshold(Number(e.target.value))}
                className="w-full h-1 bg-surface-page rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label className="input-label">Lockout Duration: <span className="font-mono font-bold text-cta">{lockoutDuration}</span> minutes</label>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={lockoutDuration}
                onChange={(e) => setLockoutDuration(Number(e.target.value))}
                className="w-full h-1 bg-surface-page rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <button
              className="btn-cta !w-full"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving Configurations...' : 'Save Policies to Database'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
