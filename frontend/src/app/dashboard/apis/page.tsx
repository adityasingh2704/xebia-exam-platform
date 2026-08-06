'use client';

import { useState, useEffect, useCallback } from 'react';
import { tenantApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/components/ui/Toast';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  status: string;
  createdAt: string;
}

interface WebhookConfig {
  id: string;
  url: string;
  isActive: boolean;
  createdAt: string;
}

export default function ApisPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [isLoadingWebhooks, setIsLoadingWebhooks] = useState(true);

  // Form states
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isCreatingWebhook, setIsCreatingWebhook] = useState(false);

  const tenantId = user?.tenantId || 'platform-global';

  const loadApiKeys = useCallback(async () => {
    setIsLoadingKeys(true);
    try {
      const res = await tenantApi.getApiKeys(tenantId);
      setApiKeys(res.data?.data || res.data || []);
    } catch {
      addToast('Failed to load API keys', 'error');
    } finally {
      setIsLoadingKeys(false);
    }
  }, [tenantId, addToast]);

  const loadWebhooks = useCallback(async () => {
    setIsLoadingWebhooks(true);
    try {
      const res = await tenantApi.getWebhooks(tenantId);
      setWebhooks(res.data?.data || res.data || []);
    } catch {
      addToast('Failed to load Webhook integrations', 'error');
    } finally {
      setIsLoadingWebhooks(false);
    }
  }, [tenantId, addToast]);

  useEffect(() => {
    loadApiKeys();
    loadWebhooks();
  }, [loadApiKeys, loadWebhooks]);

  const handleCreateApiKey = async () => {
    const keyName = prompt('Enter a name/description for this API Key:');
    if (!keyName) return;

    try {
      await tenantApi.createApiKey(tenantId, keyName);
      addToast('API Key generated and stored in MongoDB successfully', 'success');

      // Post audit log
      await tenantApi.createAuditLog(tenantId, {
        actor: user?.email || 'platform-admin',
        action: 'Generate API Key',
        details: `Key generated for: "${keyName}"`,
        ipAddress: '127.0.0.1'
      });

      loadApiKeys();
    } catch {
      addToast('Failed to generate API Key', 'error');
    }
  };

  const handleRevokeApiKey = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to revoke key "${name}"? Connected microservices will instantly lose authorization.`)) return;

    try {
      await tenantApi.deleteApiKey(id);
      addToast('API key successfully revoked from database', 'success');

      // Post audit log
      await tenantApi.createAuditLog(tenantId, {
        actor: user?.email || 'platform-admin',
        action: 'Revoke API Key',
        details: `Key revoked for: "${name}"`,
        ipAddress: '127.0.0.1'
      });

      loadApiKeys();
    } catch {
      addToast('Failed to revoke API key', 'error');
    }
  };

  const handleCreateWebhook = async () => {
    if (!webhookUrl.trim()) return;
    setIsCreatingWebhook(true);
    try {
      await tenantApi.createWebhook(tenantId, webhookUrl);
      addToast('Webhook callback URL registered successfully', 'success');
      setWebhookUrl('');

      // Post audit log
      await tenantApi.createAuditLog(tenantId, {
        actor: user?.email || 'platform-admin',
        action: 'Create Webhook Config',
        details: `Webhook URL: ${webhookUrl}`,
        ipAddress: '127.0.0.1'
      });

      loadWebhooks();
    } catch {
      addToast('Failed to register Webhook config', 'error');
    } finally {
      setIsCreatingWebhook(false);
    }
  };

  const handleRevokeWebhook = async (id: string, url: string) => {
    if (!window.confirm(`Are you sure you want to delete the webhook "${url}"?`)) return;

    try {
      await tenantApi.deleteWebhook(id);
      addToast('Webhook successfully deleted from database', 'success');

      // Post audit log
      await tenantApi.createAuditLog(tenantId, {
        actor: user?.email || 'platform-admin',
        action: 'Revoke Webhook Config',
        details: `Webhook deleted: ${url}`,
        ipAddress: '127.0.0.1'
      });

      loadWebhooks();
    } catch {
      addToast('Failed to delete webhook configuration', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-headline-xl font-bold text-text-primary">Developer APIs & Webhooks Configuration</h1>
        <p className="text-body-sm text-text-muted mt-1">
          Provision developer REST API tokens, manage credentials, and register real-time system hooks connected directly to the database.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* API Keys Table */}
        <div className="lg:col-span-2 card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-headline-lg font-bold text-text-primary">REST API Keys</h3>
            <button className="btn-cta !py-1.5 !text-xs !rounded-lg" onClick={handleCreateApiKey}>
              Generate API Key
            </button>
          </div>

          {isLoadingKeys ? (
            <TableSkeleton rows={2} cols={3} />
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-xs text-text-muted border border-dashed border-white/5 rounded-xl bg-white/5">
              No API keys generated yet. Click "Generate API Key" to provision developer credentials.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="table-header border-b border-border">
                  <th className="table-cell text-left font-medium">Integration Name</th>
                  <th className="table-cell text-left font-medium">API Token Key</th>
                  <th className="table-cell text-center font-medium">Status</th>
                  <th className="table-cell w-12"></th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((k) => (
                  <tr key={k.id} className="table-row">
                    <td className="table-cell font-bold text-text-primary">{k.name}</td>
                    <td className="table-cell font-mono text-xs text-text-muted">{k.key}</td>
                    <td className="table-cell text-center">
                      <span className="badge badge-success text-[10px] uppercase font-bold">{k.status}</span>
                    </td>
                    <td className="table-cell text-right">
                      <button className="p-1 text-danger rounded hover:bg-red-50" onClick={() => handleRevokeApiKey(k.id, k.name)}>
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Webhooks Section */}
        <div className="card space-y-4">
          <h3 className="text-headline-lg font-bold text-text-primary">Active Webhooks</h3>
          
          <div className="space-y-3">
            <div>
              <label className="input-label">Callback HTTP Endpoint URL</label>
              <input
                type="text"
                placeholder="e.g. https://ats.corp.com/v1/webhook"
                className="input font-mono text-xs"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>
            <button
              className="btn-cta !w-full"
              onClick={handleCreateWebhook}
              disabled={isCreatingWebhook || !webhookUrl.trim()}
            >
              {isCreatingWebhook ? 'Registering...' : 'Register Webhook URL'}
            </button>
          </div>

          <div className="border-t border-white/5 pt-4 space-y-2">
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wide">Registered Webhooks</h4>
            {isLoadingWebhooks ? (
              <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ) : webhooks.length === 0 ? (
              <p className="text-caption-xs text-text-muted">No webhook callbacks configured.</p>
            ) : (
              <div className="space-y-2">
                {webhooks.map((w) => (
                  <div key={w.id} className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/5 text-xs">
                    <span className="font-mono text-text-secondary truncate max-w-[200px]">{w.url}</span>
                    <button className="p-1 text-danger rounded hover:bg-red-50 shrink-0" onClick={() => handleRevokeWebhook(w.id, w.url)}>
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
