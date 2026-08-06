'use client';

import { useState } from 'react';
import { useToastStore } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { clsx } from 'clsx';

interface RequestLog {
  id: string;
  type: 'EXPORT' | 'DELETION';
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
  date: string;
}

export default function DSARPage() {
  const { addToast } = useToastStore();
  const [requests, setRequests] = useState<RequestLog[]>([
    { id: 'req-1', type: 'EXPORT', status: 'COMPLETED', date: '2026-07-10T14:30:00Z' },
  ]);

  const [modalOpen, setModalOpen] = useState(false);
  const [requestType, setRequestType] = useState<'EXPORT' | 'DELETION' | null>(null);

  const handleRequest = (type: 'EXPORT' | 'DELETION') => {
    setRequestType(type);
    setModalOpen(true);
  };

  const submitRequest = () => {
    if (!requestType) return;
    
    const newReq: RequestLog = {
      id: `req-${Date.now()}`,
      type: requestType,
      status: 'PENDING',
      date: new Date().toISOString(),
    };
    
    setRequests([newReq, ...requests]);
    addToast(`Data ${requestType.toLowerCase()} request submitted successfully.`, 'success');
    setModalOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return 'badge-warning';
      case 'COMPLETED': return 'badge-success';
      case 'REJECTED': return 'badge-danger';
      default: return 'badge-primary';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-headline-xl font-bold text-text-primary">Data Requests (DSAR)</h1>
        <p className="text-body-sm text-text-muted mt-1">
          Manage your personal data in compliance with GDPR and CCPA.
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-primary text-2xl">download</span>
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Request Data Export</h3>
          <p className="text-sm text-text-secondary mb-6">
            Receive a copy of all your personal data, examination records, and activity logs in a machine-readable format (JSON/CSV).
          </p>
          <button className="btn-secondary w-full justify-center" onClick={() => handleRequest('EXPORT')}>
            Request Export
          </button>
        </div>

        <div className="card border-danger/20">
          <div className="w-12 h-12 bg-danger-bg rounded-xl flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-danger text-2xl">delete_forever</span>
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Request Account Deletion</h3>
          <p className="text-sm text-text-secondary mb-6">
            Permanently delete your account and all associated personal data from our systems. This action cannot be undone.
          </p>
          <button className="btn-secondary !text-danger hover:!bg-danger-bg w-full justify-center" onClick={() => handleRequest('DELETION')}>
            Request Deletion
          </button>
        </div>
      </div>

      {/* Request History */}
      <div className="card !p-0 overflow-hidden mt-8">
        <div className="p-4 border-b border-border">
          <h3 className="text-base font-semibold text-text-primary">Request History</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="table-header border-b border-border">
              <th className="table-cell text-left font-medium">Request ID</th>
              <th className="table-cell text-left font-medium">Type</th>
              <th className="table-cell text-left font-medium">Date</th>
              <th className="table-cell text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req.id} className="table-row">
                <td className="table-cell font-mono text-xs text-text-secondary">{req.id}</td>
                <td className="table-cell text-sm font-medium">{req.type === 'EXPORT' ? 'Data Export' : 'Account Deletion'}</td>
                <td className="table-cell text-sm text-text-muted">{formatDate(req.date)}</td>
                <td className="table-cell">
                  <span className={clsx('badge text-xs', getStatusBadge(req.status))}>
                    {req.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={requestType === 'EXPORT' ? 'Confirm Data Export' : 'Confirm Account Deletion'}
        description={requestType === 'EXPORT' 
          ? 'Are you sure you want to request an export of all your personal data? It may take up to 24 hours to compile.'
          : 'Are you sure you want to request account deletion? Your organization administrator will review this request.'}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button 
              className={clsx('btn-cta', requestType === 'DELETION' && '!bg-danger hover:!bg-red-800')} 
              onClick={submitRequest}
            >
              Confirm Request
            </button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          By confirming, a formal Data Subject Access Request (DSAR) will be logged in our compliance system.
        </p>
      </Modal>
    </div>
  );
}
