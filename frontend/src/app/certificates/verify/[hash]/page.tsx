'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { examApi } from '@/lib/api';

export default function VerifyCertificatePage() {
  const params = useParams();
  const router = useRouter();
  const hash = params.hash as string;

  const [loading, setLoading] = useState(true);
  const [cert, setCert] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hash) {
      examApi.verifyCertificate(hash)
        .then((res) => {
          setCert(res.data.data);
        })
        .catch((err) => {
          setError(err.response?.data?.message || 'Certificate hash could not be verified.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [hash]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl border border-white/10 shadow-2xl p-6 relative">
        {/* Decorative background glow */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-blue-500/10 rounded-full blur-xl"></div>
        <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl"></div>

        {loading ? (
          <div className="flex flex-col items-center py-12">
            <span className="w-10 h-10 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin"></span>
            <span className="text-sm text-text-muted mt-4">Verifying credential authenticity...</span>
          </div>
        ) : error || !cert ? (
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-5xl text-red-400 mb-3">gpp_maybe</span>
            <h1 className="text-lg font-bold text-text-primary">Verification Failed</h1>
            <p className="text-xs text-text-muted mt-2 px-4 leading-relaxed">
              This certificate hash/ID is invalid or has been revoked. Ensure the URL is correct or contact the issuer.
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-6 px-5 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-semibold text-text-primary transition-colors"
            >
              Go to Home Page
            </button>
          </div>
        ) : (
          <div>
            {/* Header Success Badge */}
            <div className="flex flex-col items-center text-center pb-6 border-b border-white/10">
              <div className="w-16 h-16 rounded-full bg-emerald/10 border border-emerald/20 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-3xl text-emerald">verified</span>
              </div>
              <h1 className="text-lg font-bold text-text-primary">Credential Verified</h1>
              <p className="text-[11px] text-emerald font-semibold mt-1 uppercase tracking-wider">Authentic Certificate</p>
            </div>

            {/* Credential Details */}
            <div className="py-6 space-y-4">
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Recipient Name</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{cert.candidateName}</p>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Exam Title</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{cert.examTitle}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Passing Score</span>
                  <p className="text-sm font-semibold text-text-primary mt-0.5">{cert.score.toFixed(1)}%</p>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Date Issued</span>
                  <p className="text-sm font-semibold text-text-primary mt-0.5">
                    {new Date(cert.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Issuing Organization</span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{cert.issuingOrg}</p>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Certificate Hash</span>
                <p className="text-xs font-mono text-text-secondary mt-0.5 break-all select-all">{cert.signature}</p>
              </div>
            </div>

            {/* Authenticity Footer */}
            <div className="pt-4 border-t border-white/10 text-center text-[10px] text-text-muted leading-relaxed">
              This digital credential is officially cryptographically verified by Xebia Global Academy.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
