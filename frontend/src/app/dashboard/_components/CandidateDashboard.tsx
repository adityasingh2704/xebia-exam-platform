'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { certificateApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/components/ui/Toast';

export default function CandidateDashboard({ recentExams, isLoading, formatDate }: { recentExams: any[], isLoading: boolean, formatDate: (d: string) => string }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [selectedCert, setSelectedCert] = useState<any | null>(null);
  const [isCertsLoading, setIsCertsLoading] = useState(true);

  const getVerifyUrl = (id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3100';
    return `${origin}/verify/${id}`;
  };

  useEffect(() => {
    const fetchCertificates = async () => {
      if (!user?.id) return;
      setIsCertsLoading(true);
      try {
        const response = await certificateApi.listByCandidateId(user.id);
        const data = response.data.data || response.data;
        if (Array.isArray(data)) {
          setCertificates(data);
        }
      } catch (err) {
        console.error('Failed to fetch certificates:', err);
      } finally {
        setIsCertsLoading(false);
      }
    };
    fetchCertificates();
  }, [user]);

  const handlePrintCertificate = (cert: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formattedDate = new Date(cert.issuedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const verifyUrl = getVerifyUrl(cert.id);

    printWindow.document.write(`
      <html>
        <head>
          <title>Certificate - ${cert.candidateName}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Alex+Brush&family=Pinyon+Script&family=Great+Vibes&display=swap" rel="stylesheet">
          <style>
            @page { size: landscape; margin: 0; }
            body { margin: 0; padding: 0; font-family: sans-serif; background-color: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @media print {
              body { background-color: #ffffff; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body class="flex items-center justify-center min-h-screen p-4 bg-slate-100">
          <div class="w-[850px] h-[550px] p-12 bg-white relative flex flex-col justify-between text-left select-none overflow-hidden border border-slate-200 shadow-xl">
            
            <!-- SVG Right waves matching the image -->
            <svg class="absolute top-0 right-0 h-full w-[38%] pointer-events-none select-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M 30 0 C 60 25, 60 75, 10 100 L 100 100 L 100 0 Z" fill="#FFCA58" />
              <path d="M 55 0 C 80 25, 80 75, 30 100 L 100 100 L 100 0 Z" fill="#0A346C" />
            </svg>

            <!-- Gold seal matching the image -->
            <div class="absolute bottom-16 right-16 w-24 h-24 pointer-events-none select-none z-10">
              <svg class="w-full h-full drop-shadow-lg" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="url(#goldGrad)" stroke="#FFE082" stroke-width="2" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#FFF9C4" stroke-width="1" stroke-dasharray="3,3" />
                <circle cx="50" cy="50" r="30" fill="url(#goldGradInner)" stroke="#FFD54F" stroke-width="1.5" />
                <circle cx="50" cy="50" r="14" fill="none" stroke="#FFF9C4" stroke-width="2" />
                <circle cx="50" cy="50" r="23" fill="none" stroke="#FFE082" stroke-width="1" stroke-dasharray="1,5" />
                
                <defs>
                  <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FFF9C4" />
                    <stop offset="50%" stop-color="#FFCA58" />
                    <stop offset="100%" stop-color="#D4AF37" />
                  </linearGradient>
                  <linearGradient id="goldGradInner" x1="100%" y1="100%" x2="0%" y2="0%">
                    <stop offset="0%" stop-color="#FFF9C4" />
                    <stop offset="50%" stop-color="#FFD54F" />
                    <stop offset="100%" stop-color="#B8860B" />
                  </linearGradient>
                </defs>
              </svg>
              <div class="absolute inset-0 flex items-center justify-center text-[7px] text-[#5C4033] font-bold text-center uppercase tracking-tighter leading-none pointer-events-none select-none">
                <div class="scale-[0.8] rotate-[-12deg]">
                  XE-HQ<br/>VERIFIED
                </div>
              </div>
            </div>

            <!-- Left border accent lines -->
            <div class="absolute top-8 left-8 w-[50%] h-28 border-t-2 border-l-2 border-slate-700 pointer-events-none z-10"></div>
            <div class="absolute bottom-8 left-8 w-[40%] h-28 border-b-2 border-l-2 border-slate-700 pointer-events-none z-10"></div>

            <!-- Main Content Areas -->
            <div class="z-10 pl-10 pr-24 pt-8 space-y-8 flex-1 flex flex-col justify-between">
              
              <!-- Header Titles -->
              <div class="space-y-1">
                <h1 class="text-4xl md:text-5xl font-extrabold tracking-[0.18em] text-[#0A346C] uppercase">
                  Certificate
                </h1>
                <h3 class="text-xs font-bold tracking-[0.3em] text-[#7F8C8D] uppercase pl-1">
                  of achievement
                </h3>
              </div>

              <!-- Recipient Name -->
              <div class="py-2">
                <h2 class="text-4xl md:text-5xl text-slate-800 font-normal pl-1" style="font-family: 'Alex Brush', 'Great Vibes', 'Pinyon Script', cursive">
                  ${cert.candidateName}
                </h2>
              </div>

              <!-- Description -->
              <div class="max-w-[70%] text-xs text-slate-500 leading-relaxed pl-1 font-serif">
                For successfully meeting all the criteria and passing the professional assessment examination for <strong class="text-slate-800 font-semibold">${cert.examTitle}</strong> with an outstanding score of <strong class="text-slate-800 font-semibold">${cert.score.toFixed(1)}%</strong>. Issued by ${cert.issuingOrg === 'Xebia Assessment Platform' || cert.issuingOrg === 'Xebia Global Academy' ? 'Xe-Recruits' : cert.issuingOrg} and recorded securely.
              </div>

              <!-- Bottom Row -->
              <div class="flex items-end justify-between pl-1 pt-6 w-[75%] gap-6">
                <!-- Date -->
                <div>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-[#0A346C]">Date</span>
                  <p class="text-xs font-semibold text-slate-700 mt-2 font-mono">
                    ${new Date(cert.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </p>
                </div>

                <!-- Signature -->
                <div class="flex flex-col items-center">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-[#0A346C]">Signature</span>
                  <div class="h-10 flex items-center justify-center mt-1">
                    <svg class="w-24 h-8 text-slate-600 opacity-80" viewBox="0 0 100 30" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M10,15 Q25,5 35,20 T60,10 T85,15 Q95,5 90,25" />
                      <path d="M40,12 L70,12" stroke-width="1" />
                    </svg>
                  </div>
                </div>

                <!-- Verification QR -->
                <div class="flex items-center gap-2">
                  <div class="w-14 h-14 bg-white flex items-center justify-center p-0.5 border border-slate-200 shadow-sm rounded-lg shrink-0">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}" alt="Verification QR" class="w-full h-full" />
                  </div>
                  <div class="text-[7.5px] text-slate-500 font-mono leading-tight max-w-[140px] break-all">
                    <p class="font-bold text-slate-700">ID: ${cert.id.slice(0, 16)}...</p>
                    <p class="text-blue-600 font-bold mt-0.5">Scan to verify credential:</p>
                    <a href="${verifyUrl}" target="_blank" class="text-blue-600 font-semibold underline hover:text-blue-800 break-all">${verifyUrl}</a>
                  </div>
                </div>
              </div>

            </div>

          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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
    SCHEDULED: 'Upcoming',
    IN_PROGRESS: 'Resume',
    COMPLETED: 'Completed',
  };

  return (
    <div className="space-y-6">
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candidate Exams */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-headline-lg font-semibold text-text-primary">My Exams</h2>
            <button
              className="text-sm text-cta hover:text-cta-hover font-medium transition-colors"
              onClick={() => router.push('/dashboard/exams')}
            >
              View All →
            </button>
          </div>

          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-white/5 rounded w-full"></div>
              <div className="h-12 bg-white/5 rounded w-full"></div>
            </div>
          ) : recentExams.length === 0 ? (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-4xl text-text-muted mb-3">school</span>
              <p className="text-sm text-text-muted">You have no upcoming or completed exams.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="table-cell text-left font-medium">Exam Name</th>
                    <th className="table-cell text-left font-medium">Status</th>
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
          {/* Certificates */}
          <div className="card">
            <h2 className="text-headline-lg font-semibold text-text-primary mb-4">Certifications</h2>
            {isCertsLoading ? (
              <div className="animate-pulse h-16 bg-white/5 rounded-xl"></div>
            ) : certificates.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-white/10 rounded-xl bg-white/5">
                <span className="material-symbols-outlined text-3xl text-emerald mb-2">workspace_premium</span>
                <p className="text-sm text-text-muted">Complete exams to earn certificates.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {certificates.map((cert) => (
                  <div key={cert.id} className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-text-primary truncate max-w-[150px]">{cert.examTitle}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">Score: {cert.score}%</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedCert(cert)}
                        className="px-2 py-1 rounded bg-white/5 border border-white/10 text-text-primary text-[10px] font-semibold hover:bg-white/10 transition-colors flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-xs">visibility</span>
                        View
                      </button>
                      <a
                        href={certificateApi.getDownloadUrl(cert.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded bg-emerald text-white text-[10px] font-semibold hover:bg-emerald-dark transition-colors flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-xs">download</span>
                        PDF
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Privacy & DSAR */}
          <div className="card">
            <h2 className="text-headline-lg font-semibold text-text-primary mb-4">Privacy & Data</h2>
            <p className="text-sm text-text-secondary mb-4">
              You have the right to request access to your personal data or ask for it to be deleted under data protection laws.
            </p>
            <button
              onClick={() => router.push('/dashboard/dsar')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors text-sm font-medium text-text-primary"
            >
              <span className="material-symbols-outlined text-base">privacy_tip</span>
              Submit Data Request
            </button>
          </div>
        </div>
      </div>

      {/* Certificate Viewer Modal */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-card border border-border rounded-2xl w-full max-w-[900px] overflow-hidden shadow-2xl relative flex flex-col md:flex-row">
            {/* Close Button */}
            <button
              onClick={() => setSelectedCert(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors z-10"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>

            {/* Certificate Template Layout */}
            {/* Certificate Template Layout */}
            <div className="flex-1 p-12 bg-white flex flex-col justify-between text-left select-none min-h-[550px] relative overflow-hidden font-sans border border-slate-200">
              
              {/* SVG Right waves matching the image */}
              <svg className="absolute top-0 right-0 h-full w-[38%] pointer-events-none select-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M 30 0 C 60 25, 60 75, 10 100 L 100 100 L 100 0 Z" fill="#FFCA58" />
                <path d="M 55 0 C 80 25, 80 75, 30 100 L 100 100 L 100 0 Z" fill="#0A346C" />
              </svg>

              {/* Gold seal matching the image placed on top of the blue wave */}
              <div className="absolute bottom-16 right-16 w-24 h-24 pointer-events-none select-none z-10">
                <svg className="w-full h-full drop-shadow-lg" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="url(#goldGrad)" stroke="#FFE082" strokeWidth="2" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#FFF9C4" strokeWidth="1" strokeDasharray="3,3" />
                  <circle cx="50" cy="50" r="30" fill="url(#goldGradInner)" stroke="#FFD54F" strokeWidth="1.5" />
                  <circle cx="50" cy="50" r="14" fill="none" stroke="#FFF9C4" strokeWidth="2" />
                  <circle cx="50" cy="50" r="23" fill="none" stroke="#FFE082" strokeWidth="1" strokeDasharray="1,5" />
                  
                  <defs>
                    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFF9C4" />
                      <stop offset="50%" stopColor="#FFCA58" />
                      <stop offset="100%" stopColor="#D4AF37" />
                    </linearGradient>
                    <linearGradient id="goldGradInner" x1="100%" y1="100%" x2="0%" y2="0%">
                      <stop offset="0%" stopColor="#FFF9C4" />
                      <stop offset="50%" stopColor="#FFD54F" />
                      <stop offset="100%" stopColor="#B8860B" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[7px] text-[#5C4033] font-bold text-center uppercase tracking-tighter leading-none pointer-events-none select-none">
                  <div className="scale-[0.8] rotate-[-12deg]">
                    XE-HQ<br/>VERIFIED
                  </div>
                </div>
              </div>

              {/* Left border accent lines */}
              <div className="absolute top-8 left-8 w-[50%] h-28 border-t-2 border-l-2 border-slate-700 pointer-events-none z-10" />
              <div className="absolute bottom-8 left-8 w-[40%] h-28 border-b-2 border-l-2 border-slate-700 pointer-events-none z-10" />

              {/* Main Content Areas */}
              <div className="z-10 pl-10 pr-24 pt-8 space-y-8 flex-1 flex flex-col justify-between">
                
                {/* Header Titles */}
                <div className="space-y-1">
                  <h1 className="text-4xl md:text-5xl font-extrabold tracking-[0.18em] text-[#0A346C] uppercase font-sans">
                    Certificate
                  </h1>
                  <h3 className="text-xs font-bold tracking-[0.3em] text-[#7F8C8D] uppercase pl-1">
                    of achievement
                  </h3>
                </div>

                {/* Recipient Name in handwriting font */}
                <div className="py-2">
                  <h2 
                    className="text-4xl md:text-5xl text-slate-800 font-normal pl-1"
                    style={{ fontFamily: "'Alex Brush', 'Great Vibes', 'Pinyon Script', cursive" }}
                  >
                    {selectedCert.candidateName}
                  </h2>
                </div>

                {/* Description Paragraph */}
                <div className="max-w-[70%] text-xs text-slate-500 leading-relaxed pl-1 font-serif">
                  For successfully meeting all the criteria and passing the professional assessment examination for <strong className="text-slate-800 font-semibold">{selectedCert.examTitle}</strong> with an outstanding score of <strong className="text-slate-800 font-semibold">{selectedCert.score.toFixed(1)}%</strong>. Issued by {selectedCert.issuingOrg === 'Xebia Assessment Platform' || selectedCert.issuingOrg === 'Xebia Global Academy' ? 'Xe-Recruits' : selectedCert.issuingOrg} and recorded securely.
                </div>

                {/* Bottom Row: Date, Signature, Verification QR */}
                <div className="flex items-end justify-between pl-1 pt-6 w-[75%] gap-6">
                  {/* Date Column */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A346C]">Date</span>
                    <p className="text-xs font-semibold text-slate-700 mt-2 font-mono">
                      {new Date(selectedCert.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </p>
                  </div>

                  {/* Signature Column */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0A346C]">Signature</span>
                    <div className="h-10 flex items-center justify-center mt-1">
                      <svg className="w-24 h-8 text-slate-600 opacity-80" viewBox="0 0 100 30" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M10,15 Q25,5 35,20 T60,10 T85,15 Q95,5 90,25" />
                        <path d="M40,12 L70,12" strokeWidth="1" />
                      </svg>
                    </div>
                  </div>

                  {/* Verification QR */}
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-14 bg-white flex items-center justify-center p-0.5 border border-slate-200 shadow-sm rounded-lg shrink-0">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getVerifyUrl(selectedCert.id))}`} 
                        alt="Verification QR" 
                        className="w-full h-full" 
                      />
                    </div>
                    <div className="text-[7.5px] text-slate-500 font-mono leading-tight max-w-[140px] break-all">
                      <p className="font-bold text-slate-700">ID: {selectedCert.id.slice(0, 16)}...</p>
                      <p className="text-blue-600 font-bold mt-0.5">Scan to verify credential:</p>
                      <a 
                        href={getVerifyUrl(selectedCert.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 font-semibold underline hover:text-blue-800 break-all"
                      >
                        {getVerifyUrl(selectedCert.id)}
                      </a>
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Toolbar */}
              <div className="mt-4 flex justify-end gap-2 z-10">
                <button
                  onClick={() => setSelectedCert(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs hover:bg-slate-50 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePrintCertificate(selectedCert)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs hover:bg-blue-700 font-semibold transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  Print / Save PDF
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
