'use client';

import { useState, useEffect } from 'react';
import { tenantApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/components/ui/Toast';
import { clsx } from 'clsx';
import { SkeletonBlock } from '@/components/ui/LoadingSkeleton';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [activeTab, setActiveTab] = useState('organisation');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Platform admin: tenant selector list
  const [tenantsList, setTenantsList] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  // Organisation Settings
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgPlan, setOrgPlan] = useState('');
  const [maxSeats, setMaxSeats] = useState(500);

  // Branding Details (Requirement 4.1.1)
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6C1D5F');

  // Regional Configs (Requirement 4.1.1)
  const [timezone, setTimezone] = useState('America/New_York');
  const [defaultInstructions, setDefaultInstructions] = useState('');
  const [notificationEmails, setNotificationEmails] = useState('');

  // SMTP Configs
  const [smtpHost, setSmtpHost] = useState('smtp.xe-recruiters.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('notifications@xe-recruiters.com');

  const tabs = [
    { id: 'organisation', label: 'Organisation Overview', icon: 'apartment' },
    ...(user?.role === 'TENANT_ADMIN' ? [{ id: 'branding', label: 'Branding & Logo', icon: 'palette' }] : []),
    { id: 'regional', label: 'Timezone & Defaults', icon: 'language' },
    { id: 'smtp', label: 'SMTP Configurations', icon: 'mail' }
  ];

  // 1. Fetch tenants list if PLATFORM_ADMIN
  useEffect(() => {
    const fetchTenants = async () => {
      if (user?.role !== 'PLATFORM_ADMIN') return;
      try {
        const res = await tenantApi.list();
        const data = res.data?.data || res.data;
        let list: any[] = [];
        if (Array.isArray(data)) {
          list = data;
        } else if (data?.tenants) {
          list = data.tenants;
        } else if (data?.data) {
          list = data.data;
        }
        setTenantsList(list);
        if (list.length > 0) {
          setSelectedTenantId(list[0].id);
        }
      } catch (err) {
        addToast('Failed to load workspace tenants list', 'error');
      }
    };
    fetchTenants();
  }, [user, addToast]);

  const targetTenantId = user?.role === 'PLATFORM_ADMIN' ? selectedTenantId : user?.tenantId;

  // 2. Load configurations on target tenant ID change
  useEffect(() => {
    if (!targetTenantId) {
      setIsLoading(false);
      return;
    }

    const loadSettings = async () => {
      setIsLoading(true);
      try {
        // Fetch Tenant details (with settings & branding)
        const tenantRes = await tenantApi.getById(targetTenantId);
        const tenantData = tenantRes.data?.data || tenantRes.data;
        if (tenantData) {
          setOrgName(tenantData.name || '');
          setOrgSlug(tenantData.slug || '');
          setOrgPlan(tenantData.plan || '');
          setMaxSeats(tenantData.maxSeats || 500);

          // Branding details
          if (tenantData.branding) {
            setCompanyName(tenantData.branding.companyName || '');
            setLogoUrl(tenantData.branding.logoUrl || '');
            setPrimaryColor(tenantData.branding.primaryColor || '#6C1D5F');
          } else {
            setCompanyName('');
            setLogoUrl('');
            setPrimaryColor('#6C1D5F');
          }

          // Regional settings
          if (tenantData.settings) {
            setTimezone(tenantData.settings.timezone || 'America/New_York');
            setDefaultInstructions(tenantData.settings.defaultInstructions || '');
            setNotificationEmails(tenantData.settings.notificationEmails || '');
          } else {
            setTimezone('America/New_York');
            setDefaultInstructions('');
            setNotificationEmails('');
          }
        }

        // Fetch SMTP configs
        try {
          const smtpRes = await tenantApi.getSmtpConfig(targetTenantId);
          const smtpData = smtpRes.data?.data || smtpRes.data;
          if (smtpData) {
            setSmtpHost(smtpData.host || 'smtp.xe-recruiters.com');
            setSmtpPort(smtpData.port ?? 587);
            setSmtpUser(smtpData.user || 'notifications@xe-recruiters.com');
          }
        } catch {
          // Fallback if no SMTP configured yet
          setSmtpHost('smtp.xe-recruiters.com');
          setSmtpPort(587);
          setSmtpUser('notifications@xe-recruiters.com');
        }

      } catch (err) {
        addToast('Failed to load system settings for this workspace', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, [targetTenantId, addToast]);

  // 3. Save Actions
  const handleSaveBranding = async () => {
    if (!targetTenantId) return;
    setIsSaving(true);
    try {
      await tenantApi.updateBranding(targetTenantId, {
        logoUrl,
        primaryColor,
        companyName
      });

      // Post audit log
      await tenantApi.createAuditLog(targetTenantId, {
        actor: user?.email || 'system-admin',
        action: 'Update Tenant Branding',
        details: `Updated brand company: ${companyName}, primary color: ${primaryColor}`,
        ipAddress: '127.0.0.1'
      });

      addToast('Branding configurations updated successfully', 'success');
    } catch (err) {
      addToast('Failed to save branding configurations', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!targetTenantId) return;
    setIsSaving(true);
    try {
      await tenantApi.updateSettings(targetTenantId, {
        timezone,
        defaultInstructions,
        notificationEmails
      });

      // Post audit log
      await tenantApi.createAuditLog(targetTenantId, {
        actor: user?.email || 'system-admin',
        action: 'Update System Settings',
        details: `Updated timezone: ${timezone}, instructions length: ${defaultInstructions?.length || 0}`,
        ipAddress: '127.0.0.1'
      });

      addToast('Regional settings and default instructions saved successfully', 'success');
    } catch (err) {
      addToast('Failed to save settings configurations', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSmtp = async () => {
    if (!targetTenantId) return;
    setIsSaving(true);
    try {
      await tenantApi.updateSmtpConfig(targetTenantId, {
        host: smtpHost,
        port: smtpPort,
        user: smtpUser
      });

      // Post audit log
      await tenantApi.createAuditLog(targetTenantId, {
        actor: user?.email || 'system-admin',
        action: 'Update SMTP Configurations',
        details: `Updated SMTP server: ${smtpHost}:${smtpPort}`,
        ipAddress: '127.0.0.1'
      });

      addToast('SMTP mail configurations saved successfully', 'success');
    } catch (err) {
      addToast('Failed to save SMTP mail configurations', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOrganisation = async () => {
    if (!targetTenantId) return;
    setIsSaving(true);
    try {
      const payload: any = { name: orgName };
      if (user?.role === 'PLATFORM_ADMIN') {
        payload.plan = orgPlan;
        payload.maxSeats = parseInt(maxSeats as any) || 0;
      }

      await tenantApi.update(targetTenantId, payload);

      // Post audit log
      await tenantApi.createAuditLog(targetTenantId, {
        actor: user?.email || 'system-admin',
        action: 'Update Tenant Organisation details',
        details: user?.role === 'PLATFORM_ADMIN'
          ? `Updated name to ${orgName}, plan to ${orgPlan}, seats to ${maxSeats}`
          : `Updated name to ${orgName}`,
        ipAddress: '127.0.0.1'
      });

      addToast('Organisation details updated successfully', 'success');
    } catch (err) {
      addToast('Failed to save organisation details', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !selectedTenantId && user?.role === 'PLATFORM_ADMIN') {
    return (
      <div className="space-y-6">
        <SkeletonBlock className="h-10 w-48" />
        <SkeletonBlock className="h-56 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Page Header */}
      <div>
        <h1 className="text-headline-xl font-bold text-text-primary">Global Configurations & Settings</h1>
        <p className="text-body-sm text-text-muted mt-1">
          Manage system localizations, branding parameters, instructions, and mail servers stored securely in MongoDB database.
        </p>
      </div>

      {/* Platform Admin Override Dropdown */}
      {user?.role === 'PLATFORM_ADMIN' && (
        <div className="card bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl">
          <div>
            <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">admin_panel_settings</span>
              Platform Administration Override
            </h3>
            <p className="text-xs text-text-muted mt-0.5 font-medium">
              Select which workspace tenant settings you wish to inspect or modify.
            </p>
          </div>
          <div>
            {tenantsList.length === 0 ? (
              <span className="text-xs text-text-muted italic">No tenants registered in the system</span>
            ) : (
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="input pr-8 bg-surface-container font-semibold !w-auto text-sm"
              >
                {tenantsList.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {(!targetTenantId) ? (
        <div className="card text-center py-12">
          <span className="material-symbols-outlined text-4xl text-text-muted mb-2">settings_suggest</span>
          <p className="text-sm text-text-secondary">No tenant context selected. Please select a tenant to configure settings.</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Settings Sidebar Tabs */}
          <div className="w-56 shrink-0 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all',
                  activeTab === tab.id
                    ? 'bg-info-bg text-primary font-semibold'
                    : 'text-text-secondary hover:bg-surface-page'
                )}
              >
                <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Settings Content Panels */}
          <div className="flex-1 card space-y-6">
            {isLoading ? (
              <div className="py-16 text-center text-sm text-text-muted flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                Loading settings panel...
              </div>
            ) : (
              <>
                {/* Tab 1: Organisation Details */}
                {activeTab === 'organisation' && (
                  <div className="space-y-4">
                    <h3 className="text-headline-lg font-bold text-text-primary">Workspace Tenant Overview</h3>
                    <p className="text-caption-xs text-text-muted mt-1 leading-relaxed">
                      Basic workspace properties provisioned by Platform Administration.
                    </p>
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="input-label">Workspace Organisation Name</label>
                        <input
                          type="text"
                          className="input"
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          disabled={user?.role !== 'PLATFORM_ADMIN' && user?.role !== 'TENANT_ADMIN'}
                        />
                      </div>
                      <div>
                        <label className="input-label">Slug URL</label>
                        <input type="text" className="input font-mono" value={orgSlug} disabled />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="input-label">Plan Tier</label>
                          {user?.role === 'PLATFORM_ADMIN' ? (
                            <select
                              className="input capitalize font-semibold"
                              value={orgPlan}
                              onChange={(e) => setOrgPlan(e.target.value)}
                            >
                              <option value="enterprise">Enterprise</option>
                              <option value="premium">Premium</option>
                              <option value="free">Free</option>
                            </select>
                          ) : (
                            <input type="text" className="input capitalize font-semibold" value={orgPlan} disabled />
                          )}
                        </div>
                        <div>
                          <label className="input-label">Max Allocated Seats</label>
                          <input
                            type="number"
                            className="input font-semibold"
                            value={maxSeats}
                            onChange={(e) => setMaxSeats(parseInt(e.target.value) || 0)}
                            disabled={user?.role !== 'PLATFORM_ADMIN'}
                          />
                        </div>
                      </div>
                    </div>
                    {(user?.role === 'PLATFORM_ADMIN' || user?.role === 'TENANT_ADMIN') && (
                      <button
                        className="btn-cta text-xs py-2 px-5 mt-4"
                        onClick={handleSaveOrganisation}
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving Organisation...' : 'Save Organisation Details'}
                      </button>
                    )}
                  </div>
                )}

                {/* Tab 2: Branding details */}
                {activeTab === 'branding' && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-headline-lg font-bold text-text-primary">Workspace Custom Branding</h3>
                      <p className="text-caption-xs text-text-muted mt-0.5">
                        Configure the white-label logo and color scheme for this tenant.
                      </p>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="input-label">Company Brand Name</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="e.g. Acme Corporation"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="input-label">Company Logo Image URL</label>
                        <input
                          type="text"
                          className="input font-mono text-sm"
                          placeholder="https://example.com/images/logo.png"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                        />
                        {logoUrl && (
                          <div className="mt-3 p-4 bg-surface-page rounded-xl flex items-center justify-center border border-white/5 h-24">
                            <img src={logoUrl} alt="Brand Logo Preview" className="max-h-full max-w-full object-contain" />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="input-label">Primary Brand Theme Color</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            className="w-12 h-10 border-0 rounded-lg cursor-pointer bg-transparent"
                            value={primaryColor.startsWith('#') ? primaryColor : `#${primaryColor}`}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                          />
                          <input
                            type="text"
                            className="input font-mono max-w-[150px] uppercase"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            maxLength={7}
                            placeholder="#6C1D5F"
                          />
                          <span
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: primaryColor }}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn-cta text-xs py-2 px-5"
                      onClick={handleSaveBranding}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving Branding...' : 'Save Branding Config'}
                    </button>
                  </div>
                )}

                {/* Tab 3: Regional & Candidate Defaults */}
                {activeTab === 'regional' && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-headline-lg font-bold text-text-primary">Regional Defaults & Instructions</h3>
                      <p className="text-caption-xs text-text-muted mt-0.5">
                        Set localized zones, email notification groups, and defaults.
                      </p>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="input-label">Timezone</label>
                        <select
                          className="input"
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                        >
                          <option value="America/New_York">America/New_York (EST)</option>
                          <option value="Europe/London">Europe/London (GMT)</option>
                          <option value="Asia/Calcutta">Asia/Kolkata (IST)</option>
                          <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                          <option value="UTC">Coordinated Universal Time (UTC)</option>
                        </select>
                      </div>

                      <div>
                        <label className="input-label">Default Candidate Instructions</label>
                        <textarea
                          className="input min-h-[120px] leading-relaxed text-sm py-2"
                          placeholder="Standard rules shown to all candidates before starting their assessments..."
                          value={defaultInstructions}
                          onChange={(e) => setDefaultInstructions(e.target.value)}
                        />
                        <span className="text-[10px] text-text-muted font-medium mt-1 block">
                          This text serves as the default prep template for system exam wizards.
                        </span>
                      </div>

                      <div>
                        <label className="input-label">Integrity Notification Email Addresses</label>
                        <input
                          type="text"
                          className="input font-mono text-sm"
                          placeholder="proctors@acme.edu, alerts@acme.edu"
                          value={notificationEmails}
                          onChange={(e) => setNotificationEmails(e.target.value)}
                        />
                        <span className="text-[10px] text-text-muted font-medium mt-1 block">
                          Comma-separated lists of administration emails to copy on critical proctoring alerts.
                        </span>
                      </div>
                    </div>

                    <button
                      className="btn-cta text-xs py-2 px-5"
                      onClick={handleSaveSettings}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving Configurations...' : 'Save Settings'}
                    </button>
                  </div>
                )}

                {/* Tab 4: SMTP Server configs */}
                {activeTab === 'smtp' && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-headline-lg font-bold text-text-primary">SMTP Mail Configuration</h3>
                      <p className="text-caption-xs text-text-muted mt-0.5">
                        Configure transactional outbound servers to dispatch invitations and warnings.
                      </p>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="input-label">SMTP Server Host</label>
                        <input
                          type="text"
                          className="input font-mono text-sm"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="input-label">Port</label>
                          <input
                            type="number"
                            className="input font-mono"
                            value={smtpPort}
                            onChange={(e) => setSmtpPort(Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="input-label">Default From User</label>
                          <input
                            type="email"
                            className="input"
                            value={smtpUser}
                            onChange={(e) => setSmtpUser(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn-cta text-xs py-2 px-5"
                      onClick={handleSaveSmtp}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving SMTP...' : 'Save SMTP Configurations'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
