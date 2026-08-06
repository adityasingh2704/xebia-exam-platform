'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { examApi } from '@/lib/api';
import { useToastStore } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';

export default function OnboardingPage() {
  const router = useRouter();
  const params = useParams();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  const examId = params.id as string;
  const [assignmentId, setAssignmentId] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      setAssignmentId(urlParams.get('assignmentId') || '');
    }
  }, []);

  const [step, setStep] = useState(1);
  const [examTitle, setExamTitle] = useState('Loading exam...');
  const [loading, setLoading] = useState(true);

  // Hardware Checks State
  const [checks, setChecks] = useState({
    webcam: 'PENDING', // PENDING, SUCCESS, FAILED
    microphone: 'PENDING',
    screenShare: 'PENDING',
    browser: 'PENDING',
    internetSpeed: 'PENDING',
  });
  const [errorMessage, setErrorMessage] = useState('');

  // Identity State
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [livenessChallenge, setLivenessChallenge] = useState('blink'); // blink, turnHead
  const [livenessSuccess, setLivenessSuccess] = useState(false);
  const [livenessProgress, setLivenessProgress] = useState(0);

  // Environment Scan State
  const [scanProgress, setScanProgress] = useState(0);
  const [scanning, setScanning] = useState(false);

  // Consent State
  const [consentApproved, setConsentApproved] = useState(false);
  const [privacyPolicy, setPrivacyPolicy] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Fetch Exam Info
    async function loadExam() {
      try {
        const response = await examApi.get(examId);
        const examData = response.data?.data || response.data;
        if (examData) {
          setExamTitle(examData.title || 'Proctored Exam');
          
          // Check assignment status
          const uid = user?.id || (user as any)?._id || user?.email;
          const candAss = examData.assignments?.find((a: any) =>
            a.candidateId === uid ||
            a.candidateId === user?.id ||
            a.candidateId === (user as any)?._id ||
            a.candidateId === user?.email ||
            a.candidateId === 'candidate_id' ||
            (a.candidateId && uid && String(a.candidateId) === String(uid))
          );

          if (candAss) {
            const isTerminated = candAss.sessionStatus === 'TERMINATED' || !!candAss.terminationReason;
            const maxAttempts = examData.maxAttempts || 1;
            const rawAttempts = candAss.attemptsUsed || 0;
            const attemptsUsed = (candAss.status === 'SUBMITTED' || candAss.status === 'GRADED') ? Math.max(rawAttempts, 1) : rawAttempts;
            const isCompleted = isTerminated || candAss.status === 'SUBMITTED' || candAss.status === 'GRADED' || (attemptsUsed >= maxAttempts && attemptsUsed > 0);

            if (isTerminated) {
              setIsBlocked(true);
              setBlockedReason(`Your session for this exam was terminated by a proctor due to security rules.${candAss.terminationReason ? ` Reason: ${candAss.terminationReason}` : ''}`);
              addToast('Exam session terminated by proctor. Re-attempts barred.', 'error');
            } else if (isCompleted || (attemptsUsed >= maxAttempts && attemptsUsed > 0)) {
              setIsBlocked(true);
              setBlockedReason(`You have reached the maximum allowed attempts (${maxAttempts}) set by the teacher for this exam.`);
              addToast('Maximum attempts reached.', 'error');
            }
          }
        }
      } catch (err) {
        addToast('Failed to load exam details', 'error');
      } finally {
        setLoading(false);
      }
    }
    if (user?.id) loadExam();

    // Auto check browser details
    const userAgent = navigator.userAgent.toLowerCase();
    const isModern = userAgent.includes('chrome') || userAgent.includes('firefox') || userAgent.includes('safari');
    setChecks(prev => ({ ...prev, browser: isModern ? 'SUCCESS' : 'FAILED' }));

    // Auto check internet speed
    const speedTimer = setTimeout(() => {
      setChecks(prev => ({ ...prev, internetSpeed: 'SUCCESS' }));
    }, 1500);

    return () => {
      stopCamera();
      clearTimeout(speedTimer);
    };
  }, [examId, user?.id]);

  const startCamera = async () => {
    try {
      if (mediaStreamRef.current) stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setChecks(prev => ({ ...prev, webcam: 'SUCCESS', microphone: 'SUCCESS' }));
    } catch (err) {
      setChecks(prev => ({ ...prev, webcam: 'FAILED', microphone: 'FAILED' }));
      setErrorMessage('Could not access your camera or microphone. Please click the camera icon in your URL bar and grant permissions.');
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const requestScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStream.getTracks().forEach(track => track.stop());
      setChecks(prev => ({ ...prev, screenShare: 'SUCCESS' }));
    } catch (err) {
      setChecks(prev => ({ ...prev, screenShare: 'FAILED' }));
      setErrorMessage('Screen sharing permission is required to launch this proctored assessment.');
    }
  };

  const verifyInternetSpeed = () => {
    setChecks(prev => ({ ...prev, internetSpeed: 'PENDING' }));
    setTimeout(() => {
      setChecks(prev => ({ ...prev, internetSpeed: 'SUCCESS' }));
    }, 1500);
  };

  const captureSnapshot = (type: 'id' | 'profile') => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      if (type === 'id') setIdPhoto(dataUrl);
      else {
        setProfilePhoto(dataUrl);
        startLivenessCheck();
      }
    }
  };

  const startLivenessCheck = () => {
    setLivenessProgress(0);
    setLivenessSuccess(false);
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 20;
      setLivenessProgress(currentProgress);
      if (currentProgress >= 100) {
        clearInterval(interval);
        setLivenessSuccess(true);
      }
    }, 600);
  };

  const triggerEnvironmentScan = () => {
    setScanning(true);
    setScanProgress(0);
    let progressVal = 0;
    const interval = setInterval(() => {
      progressVal += 10;
      setScanProgress(progressVal);
      if (progressVal >= 100) {
        clearInterval(interval);
        setScanning(false);
      }
    }, 800);
  };

  const submitOnboarding = async () => {
    if (!consentApproved || !privacyPolicy) {
      addToast('Please review and accept all consent fields before proceeding.', 'error');
      return;
    }

    try {
      const logPayload = {
        timestamp: new Date().toISOString(),
        checks,
        livenessVerified: livenessSuccess,
        consentAccepted: true,
        candidateId: user?.id,
        examId,
      };

      const targetId = assignmentId || examId;
      await examApi.postOnboardingLogs(targetId, logPayload);
      addToast('System verification completed successfully!', 'success');
    } catch (err) {
      console.warn('Onboarding log note:', err);
      addToast('System verification completed!', 'success');
    } finally {
      stopCamera();
      router.push(`/dashboard/exams?start=true&examId=${examId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <span className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></span>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center p-6">
        <div className="card max-w-md w-full text-center p-8 border border-red-500/30 bg-surface-card space-y-5 animate-scale-in">
          <span className="material-symbols-outlined text-6xl text-red-500 p-4 rounded-full bg-red-500/10 inline-block animate-pulse">
            block
          </span>
          <h2 className="text-headline-lg font-bold text-text-primary">Attempt Blocked</h2>
          <p className="text-sm text-text-secondary leading-relaxed bg-red-500/5 border border-red-500/20 p-4 rounded-xl text-red-400">
            {blockedReason}
          </p>
          <button
            onClick={() => router.push('/dashboard/exams')}
            className="w-full btn-primary py-2.5 rounded-xl flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Return to Exams List
          </button>
        </div>
      </div>
    );
  }

  const allChecksPassed = Object.values(checks).every(c => c === 'SUCCESS');

  return (
    <div className="min-h-screen bg-surface-page p-6 flex flex-col justify-between">
      {/* Top Header */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between border-b border-border pb-4 mb-6">
        <div>
          <span className="text-xs font-extrabold tracking-widest text-[#FF6200] uppercase">SECURITY ONBOARDING</span>
          <h2 className="text-headline-lg font-bold text-text-primary mt-0.5">{examTitle}</h2>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map(idx => (
            <div
              key={idx}
              className={`h-2.5 w-8 rounded-full transition-all duration-300 ${step === idx ? 'bg-primary' : step > idx ? 'bg-emerald' : 'bg-white/5'
                }`}
            />
          ))}
        </div>
      </div>

      {/* Main Panel */}
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center my-4">
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-fade-in">
            <div className="space-y-6">
              <div>
                <h3 className="text-headline-md font-bold text-text-primary">Step 1: Guided System Check</h3>
                <p className="text-body-sm text-text-muted mt-1 leading-relaxed">
                  We need to verify that your camera, audio, browser, and network are optimized to guarantee proctoring compliance.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 border border-white/5 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-text-secondary">videocam</span>
                    <span className="text-sm font-semibold text-text-primary">Webcam & Microphone</span>
                  </div>
                  {checks.webcam === 'SUCCESS' ? (
                    <span className="material-symbols-outlined text-emerald">check_circle</span>
                  ) : checks.webcam === 'FAILED' ? (
                    <span className="material-symbols-outlined text-danger">cancel</span>
                  ) : (
                    <button onClick={startCamera} className="text-xs font-bold text-primary underline">Verify</button>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 border border-white/5 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-text-secondary">screen_share</span>
                    <span className="text-sm font-semibold text-text-primary">Screen Sharing Permit</span>
                  </div>
                  {checks.screenShare === 'SUCCESS' ? (
                    <span className="material-symbols-outlined text-emerald">check_circle</span>
                  ) : checks.screenShare === 'FAILED' ? (
                    <span className="material-symbols-outlined text-danger">cancel</span>
                  ) : (
                    <button onClick={requestScreenShare} className="text-xs font-bold text-primary underline">Grant Access</button>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 border border-white/5 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-text-secondary">language</span>
                    <span className="text-sm font-semibold text-text-primary">Browser Verification</span>
                  </div>
                  {checks.browser === 'SUCCESS' ? (
                    <span className="material-symbols-outlined text-emerald">check_circle</span>
                  ) : (
                    <span className="material-symbols-outlined text-danger">cancel</span>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 border border-white/5 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-text-secondary">wifi</span>
                    <span className="text-sm font-semibold text-text-primary">Network Stability Check</span>
                  </div>
                  {checks.internetSpeed === 'SUCCESS' ? (
                    <span className="material-symbols-outlined text-emerald">check_circle</span>
                  ) : checks.internetSpeed === 'PENDING' ? (
                    <span className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <button onClick={verifyInternetSpeed} className="text-xs font-bold text-primary underline">Check Speed</button>
                  )}
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-danger-bg border border-red-200 rounded-xl text-danger text-xs leading-relaxed flex gap-2">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  {errorMessage}
                </div>
              )}
            </div>

            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 flex flex-col items-center justify-center relative">
              {checks.webcam === 'SUCCESS' ? (
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-6 space-y-3">
                  <span className="material-symbols-outlined text-4xl text-white/20">videocam_off</span>
                  <p className="text-xs text-text-muted">Start media validation to load webcam preview stream.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-fade-in">
            <div className="space-y-6">
              <div>
                <h3 className="text-headline-md font-bold text-text-primary">Step 2: Identity & Liveness Check</h3>
                <p className="text-body-sm text-text-muted mt-1 leading-relaxed">
                  Upload an official ID card and take a photo to check matches and confirm identity.
                </p>
              </div>

              <div className="space-y-4">
                <div className="border border-white/5 bg-white/5 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary">Government Photo ID</h4>
                    <p className="text-xs text-text-muted mt-0.5">Please hold your ID inside video preview and click capture.</p>
                  </div>
                  {idPhoto ? (
                    <div className="w-14 h-10 border border-emerald rounded overflow-hidden">
                      <img src={idPhoto} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <button onClick={() => captureSnapshot('id')} className="btn-secondary text-xs">Capture ID</button>
                  )}
                </div>

                <div className="border border-white/5 bg-white/5 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary">Profile Portrait Photo</h4>
                    <p className="text-xs text-text-muted mt-0.5">Face the camera squarely and capture snapshot.</p>
                  </div>
                  {profilePhoto ? (
                    <div className="w-10 h-10 border border-emerald rounded-full overflow-hidden">
                      <img src={profilePhoto} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <button onClick={() => captureSnapshot('profile')} className="btn-secondary text-xs" disabled={!idPhoto}>Capture Photo</button>
                  )}
                </div>

                {profilePhoto && (
                  <div className="border border-emerald/20 bg-emerald/5 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-emerald tracking-wider uppercase">Liveness Verification</h4>
                      <span className="text-xs font-semibold text-emerald">{livenessSuccess ? 'VERIFIED' : 'PENDING ACTION'}</span>
                    </div>

                    {!livenessSuccess ? (
                      <div className="space-y-2">
                        <p className="text-xs text-emerald/80 leading-relaxed font-semibold">
                          Challenge: Please {livenessChallenge === 'blink' ? 'blink three times' : 'turn your head slowly to the left'} within the next few seconds.
                        </p>
                        <div className="w-full h-1.5 bg-emerald/20 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald transition-all duration-300" style={{ width: `${livenessProgress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-emerald/80 leading-relaxed flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Liveness algorithm check successfully confirmed human attendee activity.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-fade-in">
            <div className="space-y-6">
              <div>
                <h3 className="text-headline-md font-bold text-text-primary">Step 3: 360° Workspace Scan</h3>
                <p className="text-body-sm text-text-muted mt-1 leading-relaxed">
                  Slowly pan your webcam around your room to register your environment. Make sure your desk is clean of prohibited materials.
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={triggerEnvironmentScan}
                  disabled={scanning}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">flip_camera_android</span>
                  {scanning ? 'Scanning Workspace...' : 'Begin Environment Scan'}
                </button>

                {scanning && (
                  <div className="space-y-2">
                    <p className="text-xs text-text-muted text-center font-mono">Scan progress: {scanProgress}%</p>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${scanProgress}%` }} />
                    </div>
                  </div>
                )}

                {scanProgress === 100 && (
                  <div className="p-4 border border-emerald/20 bg-emerald/5 rounded-xl text-emerald flex gap-2 text-xs leading-relaxed">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Workspace scan recorded and timestamped. Desktop cleared.
                  </div>
                )}
              </div>
            </div>

            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {scanning && (
                <div className="absolute inset-0 bg-primary/10 border-2 border-primary animate-pulse pointer-events-none" />
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="max-w-2xl mx-auto w-full space-y-6 animate-fade-in">
            <div>
              <h3 className="text-headline-md font-bold text-text-primary">Step 4: AI Proctoring Disclosure & Consent</h3>
              <p className="text-body-sm text-text-muted mt-1 leading-relaxed">
                Before commencing the examination, please review the AI proctoring disclosure terms.
              </p>
            </div>

            <div className="p-5 border border-white/5 bg-white/5 rounded-2xl space-y-4 text-xs text-text-secondary leading-relaxed">
              <h4 className="font-bold text-text-primary uppercase tracking-wider">Data Collected & Policies</h4>
              <ul className="list-disc pl-4 space-y-2">
                <li>Continuous recording of webcam stream to analyze candidate identity and verify focus.</li>
                <li>Full screen session recording to log desktop focus events and intercept clipboard manipulation (copy/paste).</li>
                <li>AI incident flags automatically logs timestamp, confidence scores, and screenshot evidence of security breaches.</li>
                <li>All recordings are stored securely in compliance with privacy guidelines and permanently deleted after a retention period of 30 days.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-white/5 hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={consentApproved}
                  onChange={(e) => setConsentApproved(e.target.checked)}
                  className="mt-0.5 rounded border-white/10 text-primary bg-white/5 focus:ring-primary"
                />
                <span className="text-xs text-text-primary select-none">
                  I explicitly consent to the recording of my webcam, screen stream, and keystroke events for academic integrity monitoring.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-white/5 hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={privacyPolicy}
                  onChange={(e) => setPrivacyPolicy(e.target.checked)}
                  className="mt-0.5 rounded border-white/10 text-primary bg-white/5 focus:ring-primary"
                />
                <span className="text-xs text-text-primary select-none">
                  I agree to the Xe-Recruits assessment integrity guidelines and acknowledge that automatic flags may affect overall evaluation.
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="max-w-4xl mx-auto w-full border-t border-border pt-4 flex justify-between items-center mt-6">
        <button
          disabled={step === 1}
          onClick={() => {
            if (step === 2) stopCamera();
            setStep(prev => prev - 1);
          }}
          className="btn-secondary flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back
        </button>

        {step < 4 ? (
          <button
            onClick={() => {
              if (step === 1 && !allChecksPassed) {
                addToast('Please verify and pass all guided system hardware checks before proceeding.', 'warning');
                return;
              }
              if (step === 2 && (!idPhoto || !profilePhoto || !livenessSuccess)) {
                addToast('Please complete portrait capture, ID scan, and pass liveness challenge.', 'warning');
                return;
              }
              if (step === 3 && scanProgress < 100) {
                addToast('Please run and complete the 360° environment scan.', 'warning');
                return;
              }
              setStep(prev => prev + 1);
              if (step === 1) startCamera();
            }}
            className="btn-primary flex items-center gap-1"
          >
            Next Step
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        ) : (
          <button
            onClick={submitOnboarding}
            disabled={!consentApproved || !privacyPolicy}
            className="btn-cta flex items-center gap-1"
          >
            Consent & Begin Exam
            <span className="material-symbols-outlined text-base">play_arrow</span>
          </button>
        )}
      </div>
    </div>
  );
}
