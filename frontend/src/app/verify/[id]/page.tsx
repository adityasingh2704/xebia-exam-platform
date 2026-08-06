'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { certificateApi } from '@/lib/api';
import { clsx } from 'clsx';

export default function CertificateVerificationPage() {
  const params = useParams();
  const router = useRouter();
  const certId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [certData, setCertData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyCert = async () => {
      if (!certId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await certificateApi.verify(certId);
        const resData = response.data?.data || response.data;
        if (resData && resData.isAuthentic) {
          setCertData(resData);
        } else {
          setError('This certificate has failed the tamper-evident validation check or the digital signature is invalid.');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Certificate verification failed. Ensure the ID is entered correctly.');
      } finally {
        setLoading(false);
      }
    };
    verifyCert();
  }, [certId]);

  return (
    <div className="min-h-screen bg-[#1E1E2E] text-[#CDD6F4] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#6C1D5F]/15 rounded-full blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#FF6200]/10 rounded-full blur-3xl" />

      {/* Main Container */}
      <div className="w-full max-w-xl bg-[#181825]/90 border border-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl relative z-10 flex flex-col">
        {/* Branding Logo & Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-3 mb-2">
            <img src="/Logo-White.png" alt="Xe-Recruits Logo" className="h-10 w-auto" />
            <span className="text-xl font-bold tracking-wider text-white">Xe-Recruits</span>
          </div>
          <h1 className="text-sm font-semibold tracking-widest text-[#7F8C8D] uppercase">Certificate Verification</h1>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="w-10 h-10 border-4 border-white/10 border-t-[#FF6200] rounded-full animate-spin mb-4" />
            <p className="text-sm text-[#7F8C8D]">Cryptographically verifying credentials...</p>
          </div>
        ) : error ? (
          /* Error / Invalid state */
          <div className="text-center py-6 animate-scale-in">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <span className="material-symbols-outlined text-3xl">gpp_bad</span>
            </div>
            <h2 className="text-lg font-bold text-red-500 mb-2">Verification Failed</h2>
            <p className="text-sm text-[#7F8C8D] leading-relaxed mb-6">
              {error}
            </p>
            <div className="border-t border-white/5 pt-4">
              <p className="text-[10px] text-[#7F8C8D] font-mono select-all">Cert ID: {certId}</p>
            </div>
          </div>
        ) : (
          /* Valid Verified State */
          <div className="space-y-6 animate-scale-in">
            {/* Status Banner */}
            <div className="bg-[#A6E3A1]/10 border border-[#A6E3A1]/20 rounded-xl p-4 flex items-center gap-3.5 text-[#A6E3A1]">
              <span className="material-symbols-outlined text-3xl">verified_user</span>
              <div>
                <h3 className="text-sm font-bold tracking-wide uppercase">Credentials Verified</h3>
                <p className="text-xs text-[#A6E3A1]/80 mt-0.5">This certificate is authentic and matches records in our secure database.</p>
              </div>
            </div>

            {/* Certificate Details */}
            <div className="space-y-4 bg-white/5 border border-white/5 rounded-xl p-5">
              <div>
                <span className="text-[10px] text-[#7F8C8D] font-semibold uppercase tracking-wider block">Candidate Name</span>
                <span className="text-base font-bold text-white mt-0.5 block">{certData.candidateName}</span>
              </div>
              <hr className="border-white/5" />
              <div>
                <span className="text-[10px] text-[#7F8C8D] font-semibold uppercase tracking-wider block">Examination Completed</span>
                <span className="text-base font-bold text-white mt-0.5 block">{certData.examTitle}</span>
              </div>
              <hr className="border-white/5" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-[#7F8C8D] font-semibold uppercase tracking-wider block">Achieved Score</span>
                  <span className="text-sm font-bold text-white mt-0.5 block">
                    {certData.score} / {certData.totalMarks} ({(certData.score / certData.totalMarks * 100).toFixed(1)}%)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7F8C8D] font-semibold uppercase tracking-wider block">Date Issued</span>
                  <span className="text-sm font-bold text-white mt-0.5 block">
                    {new Date(certData.issuedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>
              <hr className="border-white/5" />
              <div>
                <span className="text-[10px] text-[#7F8C8D] font-semibold uppercase tracking-wider block">Issuing Organization</span>
                <span className="text-sm font-bold text-white mt-0.5 block">
                  {certData.issuingOrg === 'Xebia Assessment Platform' || certData.issuingOrg === 'Xebia Global Academy' ? 'Xe-Recruits' : certData.issuingOrg}
                </span>
              </div>
            </div>

            {/* Verification Metadata & PDF Download */}
            <div className="space-y-4 pt-2">
              <a
                href={certificateApi.getDownloadUrl(certId)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-[#FF6200] hover:bg-[#FF6200]/90 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-[#FF6200]/25"
              >
                <span className="material-symbols-outlined text-base">download</span>
                Download Official PDF Certificate
              </a>

              <div className="text-center text-[9px] text-[#7F8C8D] font-mono select-all">
                <p>Tamper-Evident ID: {certId}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer copyright */}
      <p className="text-[10px] text-[#7F8C8D] mt-6 relative z-10">
        &copy; {new Date().getFullYear()} Xebia Inc. All rights reserved.
      </p>
    </div>
  );
}
