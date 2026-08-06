'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { examApi, questionApi, codeExecutionApi } from '@/lib/api';
import { useToastStore } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { CardGridSkeleton } from '@/components/ui/LoadingSkeleton';
import { useProctoring } from '@/lib/hooks/useProctoring';
import { useTheme } from '@/components/theme/ThemeProvider';

interface Exam {
  id: string;
  title: string;
  description?: string;
  status: string;
  duration: number;
  totalMarks: number;
  passingScore: number;
  startTime?: string | null;
  endTime?: string | null;
  enableProctoring: boolean;
  maxAttempts: number;
  negativeMarking?: boolean;
  negativeMarkValue?: number;
  sections?: any[];
  assignments?: any[];
  createdAt: string;
}

const statusConfig: Record<string, { badge: string; label: string }> = {
  DRAFT: { badge: 'bg-gray-100 text-gray-600', label: 'Draft' },
  PUBLISHED: { badge: 'badge-primary', label: 'Published' },
  SCHEDULED: { badge: 'badge-cta', label: 'Scheduled' },
  IN_PROGRESS: { badge: 'bg-emerald/10 text-emerald font-medium', label: 'In Progress' },
  COMPLETED: { badge: 'badge-success', label: 'Completed' },
  ARCHIVED: { badge: 'bg-gray-100 text-gray-500', label: 'Archived' },
};

export default function ExamsPage() {
  const router = useRouter();
  const { addToast } = useToastStore();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('All');
  const { user } = useAuthStore();
  const isCandidate = user?.role === 'CANDIDATE';

  // Modal & Attempt States
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [detailedExam, setDetailedExam] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [questionsMap, setQuestionsMap] = useState<Record<string, any>>({});
  const [isAttempting, setIsAttempting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [attemptAnswers, setAttemptAnswers] = useState<Record<string, string>>({});
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
  const [attemptFinished, setAttemptFinished] = useState(false);
  const [attemptScore, setAttemptScore] = useState(0);
  const [attemptPassed, setAttemptPassed] = useState(false);

  // Get active assignment ID for hook
  const activeAssignment = detailedExam?.assignments?.find(
    (a: any) => a.candidateId === user?.id
  );
  const assignmentId = activeAssignment?.id || detailedExam?.id || '';

  // Flattened active attempt questions
  const activeQuestionsList = detailedExam
    ? (detailedExam.sections || []).flatMap((s: any) => (s.questions || []).map((q: any) => q.questionId))
    : [];

  // AI Proctoring integration hook
  const { trustScore, warningMessage, clearWarning, sendProgressUpdate } = useProctoring({
    assignmentId,
    examId: detailedExam?.id || '',
    enableProctoring: !!detailedExam?.enableProctoring && isAttempting,
    candidateName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Candidate',
    onTerminate: (reason) => {
      setIsAttempting(false);
      setAttemptFinished(true);
      addToast(`Exam session terminated by proctor: ${reason}`, 'error');
      fetchExams();
    },
  });

  // Sync real-time question progress over sockets
  useEffect(() => {
    if (isAttempting && activeQuestionsList.length > 0 && sendProgressUpdate) {
      const answeredCount = Object.keys(attemptAnswers).filter((k) => !!attemptAnswers[k]).length;
      sendProgressUpdate(answeredCount, activeQuestionsList.length);
    }
  }, [attemptAnswers, isAttempting, activeQuestionsList.length, sendProgressUpdate]);

  if (user?.role === 'PROCTOR') {
    return (
      <div className="card text-center py-16 px-6 space-y-4 border border-dashed border-primary/20 bg-surface-card rounded-2xl animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-3xl">videocam</span>
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h3 className="text-headline-md font-bold text-text-primary">Exam Creation Reserved for Teachers</h3>
          <p className="text-xs text-text-muted leading-relaxed">
            Exam authoring, question bank management, and scheduling are managed by Teachers. As a Proctor, your primary focus is real-time monitoring in the <a href="/dashboard/proctoring" className="text-primary underline font-semibold">Live Proctoring Console</a> and investigating flagged events in the <a href="/dashboard/incidents" className="text-primary underline font-semibold">Incidents Log</a>.
          </p>
        </div>
      </div>
    );
  }

  const tabs = isCandidate 
    ? ['All', 'Scheduled', 'In Progress', 'Completed'] 
    : ['All', 'Draft', 'Published', 'Scheduled', 'In Progress', 'Completed'];

  const fetchExams = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('xe_access_token') : null;
    if (!token) return;

    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { tenantId: user?.tenantId };
      if (isCandidate) {
        params.candidateId = user?.id;
      }

      if (activeTab !== 'All') {
        const statusMap: Record<string, string> = {
          'Draft': 'DRAFT',
          'Published': 'PUBLISHED',
          'Scheduled': 'SCHEDULED',
          'In Progress': 'IN_PROGRESS',
          'Completed': 'COMPLETED',
        };
        params.status = statusMap[activeTab];
      }

      const response = await examApi.list(params);
      const resData = response.data;
      
      let examList: any[] = [];
      if (Array.isArray(resData)) {
        examList = resData;
      } else if (Array.isArray(resData?.data?.data)) {
        examList = resData.data.data;
      } else if (Array.isArray(resData?.data?.items)) {
        examList = resData.data.items;
      } else if (Array.isArray(resData?.data?.exams)) {
        examList = resData.data.exams;
      } else if (Array.isArray(resData?.data)) {
        examList = resData.data;
      } else if (Array.isArray(resData?.items)) {
        examList = resData.items;
      } else if (Array.isArray(resData?.exams)) {
        examList = resData.exams;
      }

      setExams(examList);
    } catch (err: any) {
      if (err.response?.status === 401 || err.message?.includes('Authorization header is missing')) {
        return;
      }
      const msg = err.response?.data?.message || 'Failed to load exams';
      setError(msg);
      setExams([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, user, isCandidate]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // Handle attempt timer
  useEffect(() => {
    if (!isAttempting || timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitAttempt(true); // Auto-submit when time expires
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isAttempting, timeRemaining]);

  // Auto-start proctored exam after onboarding redirection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const startFlag = urlParams.get('start');
    const examIdParam = urlParams.get('examId');
    if (startFlag === 'true' && examIdParam && user) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);

      const startExamObject = (targetExam: any) => {
        handleOpenExam(targetExam).then(() => {
          const candAss = targetExam.assignments?.find((a: any) => a.candidateId === user?.id);
          const isTerminated = candAss?.sessionStatus === 'TERMINATED' || !!candAss?.terminationReason;
          const attemptsUsed = candAss?.attemptsUsed || 0;
          const maxAttempts = targetExam.maxAttempts || 1;
          if (isTerminated || (attemptsUsed >= maxAttempts && attemptsUsed > 0)) {
            addToast(isTerminated ? 'Exam terminated by proctor. Retries barred.' : 'Maximum attempts reached for this exam.', 'error');
            return;
          }
          setIsAttempting(true);
          setTimeRemaining((targetExam.duration || 60) * 60);
          setAttemptAnswers({});
          setCurrentQuestionIndex(0);
          setAttemptFinished(false);
        });
      };

      const matched = exams.find((e) => e.id === examIdParam);
      if (matched) {
        startExamObject(matched);
      } else {
        examApi.getById(examIdParam).then((res) => {
          const examData = res.data?.data || res.data;
          if (examData) startExamObject(examData);
        }).catch((err) => {
          console.error('Failed to auto-start exam details:', err);
        });
      }
    }
  }, [exams, user]);

  const handleOpenExam = async (exam: Exam) => {
    setSelectedExam(exam);
    setIsLoadingDetails(true);
    setQuestionsMap({});
    try {
      const response = await examApi.getById(exam.id);
      const data = response.data.data || response.data;
      setDetailedExam(data);

      // Extract all question IDs from all sections
      const questionIds: string[] = (data.sections || [])
        .flatMap((s: any) => (s.questions || []).map((q: any) => q.questionId));

      if (questionIds.length > 0) {
        const qPromises = questionIds.map((id) =>
          questionApi.getById(id).then(res => res.data.data || res.data).catch(() => null)
        );
        const qResults = await Promise.all(qPromises);
        const qMap: Record<string, any> = {};
        qResults.forEach((q, index) => {
          if (q) {
            qMap[questionIds[index]] = q;
          }
        });
        setQuestionsMap(qMap);
      }
    } catch (err) {
      addToast('Failed to load exam details or questions', 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleStartAttempt = () => {
    if (!detailedExam) return;
    const { candAss, maxAttempts, attemptsUsed, isTerminated, isCompleted } = getCandidateStats(detailedExam);

    if (isTerminated) {
      addToast('Exam attempt blocked. Your session was terminated by a proctor due to security rules.', 'error');
      return;
    }

    if (isCompleted || (attemptsUsed >= maxAttempts && attemptsUsed > 0)) {
      addToast(`You have reached the maximum allowed attempts (${maxAttempts}) set by the teacher for this exam.`, 'error');
      return;
    }

    if (detailedExam.enableProctoring) {
      const assignmentId = candAss?.id || '';
      router.push(`/dashboard/exams/${detailedExam.id}/onboarding?assignmentId=${assignmentId}`);
      setSelectedExam(null);
    } else {
      setIsAttempting(true);
      setTimeRemaining(detailedExam.duration * 60);
      setAttemptAnswers({});
      setCurrentQuestionIndex(0);
      setAttemptFinished(false);
    }
  };

  const handleSubmitAttempt = async (auto = false) => {
    if (!detailedExam || !user) return;
    setSubmittingAttempt(true);

    try {
      // Send serialized answers to database
      const candidateId = user.id || (user as any)._id || 'cand_1';
      const serializedAnswers = JSON.stringify(attemptAnswers);
      await examApi.submitAttempt(detailedExam.id, candidateId, serializedAnswers, detailedExam.totalMarks);

      addToast(auto ? 'Exam time expired! Attempt auto-submitted.' : 'Exam attempt submitted successfully!', 'success');
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || 'Exam attempt concluded.';
      addToast(auto ? 'Exam attempt finished.' : errMsg, err?.response?.status === 400 ? 'warning' : 'info');
    } finally {
      setAttemptFinished(true);
      setIsAttempting(false);
      setSubmittingAttempt(false);
      fetchExams();
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (!window.confirm('Are you sure you want to delete this exam? This will remove all student assignments and records for this exam.')) {
      return;
    }
    try {
      await examApi.delete(examId);
      addToast('Exam deleted successfully', 'success');
      fetchExams();
    } catch (err) {
      addToast('Failed to delete exam', 'error');
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Not scheduled';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      });
    } catch { return dateStr; }
  };

  const getCandidateCount = (exam: any) => exam._count?.assignments ?? exam.assignments?.length ?? 0;

  const getCandidateAssignment = (exam: any) => {
    if (!exam || !exam.assignments || !Array.isArray(exam.assignments) || !user) return null;
    const uid = user.id || (user as any)._id || user.email;
    return exam.assignments.find((a: any) =>
      a.candidateId === uid ||
      a.candidateId === user.id ||
      a.candidateId === (user as any)._id ||
      a.candidateId === user.email ||
      a.candidateId === 'candidate_id' ||
      (a.candidateId && uid && String(a.candidateId) === String(uid))
    ) || null;
  };

  const getCandidateStats = (exam: any) => {
    const candAss = getCandidateAssignment(exam || detailedExam || selectedExam);
    const maxAttempts = exam?.maxAttempts || 1;
    const rawAttempts = candAss?.attemptsUsed || 0;
    const attemptsUsed = (candAss?.status === 'SUBMITTED' || candAss?.status === 'GRADED') ? Math.max(rawAttempts, 1) : rawAttempts;
    const isTerminated = candAss?.sessionStatus === 'TERMINATED' || !!candAss?.terminationReason;
    const isCompleted = isTerminated || (candAss && (candAss.status === 'SUBMITTED' || candAss.status === 'GRADED')) || (attemptsUsed >= maxAttempts && maxAttempts > 0 && attemptsUsed > 0);

    return { candAss, maxAttempts, attemptsUsed, isTerminated, isCompleted };
  };

  const displayedExams = exams.filter((exam) => {
    if (!isCandidate) return true;
    const { isCompleted } = getCandidateStats(exam);

    if (activeTab === 'Completed') {
      return isCompleted;
    } else {
      return !isCompleted;
    }
  });

  if (mounted && isAttempting && detailedExam) {
    return createPortal(
      /* ACTIVE EXAM ENGINE INTERFACE */
      <div className="fixed inset-0 z-[99999] bg-surface-page text-text-primary flex flex-col w-screen h-screen overflow-hidden animate-scale-in">
        {warningMessage && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="card max-w-md w-full text-center p-6 border border-warning/30 bg-surface-card space-y-4 shadow-2xl">
              <span className="material-symbols-outlined text-5xl text-warning animate-bounce">warning</span>
              <h3 className="text-headline-md font-bold text-text-primary">Security Alert</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{warningMessage}</p>
              <button onClick={clearWarning} className="btn-cta w-full py-3 rounded-xl font-bold text-sm">I Acknowledge & Return to Exam</button>
            </div>
          </div>
        )}

        {/* Dedicated Top Header Toolbar */}
        <div className="flex items-center justify-between px-8 py-3.5 bg-surface-card border-b border-border shadow-sm shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-primary-bright flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-white text-lg">shield</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-primary tracking-widest uppercase bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  Proctored Assessment
                </span>
              </div>
              <h2 className="text-base font-bold text-text-primary mt-0.5 line-clamp-1">{detailedExam.title}</h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Webcam simulated indicator */}
            {detailedExam.enableProctoring && (
              <div className="hidden md:flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-primary/20 bg-primary/5 text-xs font-bold text-primary font-mono">
                  <span className="material-symbols-outlined text-sm">gavel</span>
                  TRUST SCORE: {trustScore}%
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </div>
                  <span className="text-xs font-bold tracking-wide">LIVE PROCTOR FEED</span>
                </div>
              </div>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-border bg-surface-page hover:bg-surface-container text-text-primary transition-all flex items-center justify-center shadow-sm"
              title="Toggle Light / Dark Theme"
            >
              <span className="material-symbols-outlined text-lg">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Timer Badge */}
            <div className="flex items-center gap-2 text-cta font-mono text-xl font-bold bg-cta/10 border border-cta/30 px-5 py-1.5 rounded-2xl shadow-inner">
              <span className="material-symbols-outlined text-lg animate-pulse">timer</span>
              <span>{Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>
        </div>

        {/* Main Workspace Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 overflow-hidden min-h-0">
          {/* Question Panel */}
          <div className="lg:col-span-3 flex flex-col min-h-0 bg-surface-card border border-border rounded-2xl p-6 shadow-md overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4 shrink-0">
              <span className="text-xs text-text-muted font-bold tracking-wider uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-primary">help_outline</span>
                Question {currentQuestionIndex + 1} of {activeQuestionsList.length}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                {questionsMap[activeQuestionsList[currentQuestionIndex]]?.points || 10} MARKS
              </span>
            </div>

            {/* Question Details Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {questionsMap[activeQuestionsList[currentQuestionIndex]] ? (
                <div className="space-y-5">
                  <h4 className="text-lg font-bold text-text-primary leading-snug">
                    {questionsMap[activeQuestionsList[currentQuestionIndex]].title}
                  </h4>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
                    {questionsMap[activeQuestionsList[currentQuestionIndex]].body}
                  </p>

                  {/* MCQ Options Styling */}
                  {questionsMap[activeQuestionsList[currentQuestionIndex]].type === 'MCQ' ? (
                    <div className="space-y-3 mt-6">
                      {(questionsMap[activeQuestionsList[currentQuestionIndex]].options || []).map((opt: any, optIdx: number) => (
                        <label
                          key={opt.text}
                          className={clsx(
                            "flex items-center gap-4 p-4 border-2 rounded-2xl cursor-pointer transition-all",
                            attemptAnswers[activeQuestionsList[currentQuestionIndex]] === opt.text
                              ? "border-primary bg-primary/10 text-text-primary shadow-sm font-semibold"
                              : "border-border bg-surface-page text-text-secondary hover:bg-surface-container"
                          )}
                        >
                          <span className={clsx(
                            "w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs font-mono shrink-0 transition-all",
                            attemptAnswers[activeQuestionsList[currentQuestionIndex]] === opt.text
                              ? "bg-primary text-white"
                              : "bg-surface-card text-text-muted border border-border"
                          )}>
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <input
                            type="radio"
                            name={`question-${activeQuestionsList[currentQuestionIndex]}`}
                            value={opt.text}
                            checked={attemptAnswers[activeQuestionsList[currentQuestionIndex]] === opt.text}
                            onChange={(e) => setAttemptAnswers(prev => ({
                              ...prev,
                              [activeQuestionsList[currentQuestionIndex]]: e.target.value
                            }))}
                            className="hidden"
                          />
                          <span className="text-sm font-medium leading-relaxed">{opt.text}</span>
                        </label>
                      ))}
                    </div>
                  ) : questionsMap[activeQuestionsList[currentQuestionIndex]].type === 'ESSAY' ? (
                    /* Essay Answer Area */
                    <div className="mt-4">
                      <textarea
                        rows={10}
                        placeholder="Type your detailed response here..."
                        value={attemptAnswers[activeQuestionsList[currentQuestionIndex]] || ''}
                        onChange={(e) => setAttemptAnswers(prev => ({
                          ...prev,
                          [activeQuestionsList[currentQuestionIndex]]: e.target.value
                        }))}
                        className="w-full text-sm p-4 rounded-2xl border border-border bg-surface-page text-text-primary focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                      ></textarea>
                    </div>
                  ) : (
                    /* Code Workspace */
                    <ProgrammingWorkspace
                      question={questionsMap[activeQuestionsList[currentQuestionIndex]]}
                      value={attemptAnswers[activeQuestionsList[currentQuestionIndex]] || ''}
                      onChange={(codeVal) => setAttemptAnswers(prev => ({
                        ...prev,
                        [activeQuestionsList[currentQuestionIndex]]: codeVal
                      }))}
                    />
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-muted">Loading question data...</p>
              )}
            </div>

            {/* Foot Navigation Bar */}
            <div className="flex justify-between items-center pt-4 border-t border-border mt-4 shrink-0">
              <button
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                className="btn-secondary rounded-xl px-5 py-2.5 flex items-center gap-2 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Previous
              </button>

              {currentQuestionIndex < activeQuestionsList.length - 1 ? (
                <button
                  onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                  className="btn-primary rounded-xl px-5 py-2.5 flex items-center gap-2"
                >
                  Next
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              ) : (
                <button
                  onClick={() => handleSubmitAttempt(false)}
                  disabled={submittingAttempt}
                  className="btn-cta shadow-lg shadow-cta/25 rounded-xl px-6 py-2.5 text-sm font-bold flex items-center gap-2"
                >
                  {submittingAttempt ? 'Submitting...' : 'Finish & Submit Exam'}
                  <span className="material-symbols-outlined text-base">done_all</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Sidebar: Live Proctor View & Question Navigator */}
          <div className="flex flex-col gap-5 min-h-0 h-full">
            {/* Live Proctor View Card */}
            {detailedExam.enableProctoring && (
              <div className="border border-border rounded-2xl overflow-hidden relative bg-black aspect-video shrink-0 shadow-lg">
                <video
                  ref={(el) => {
                    if (el && isAttempting) {
                      navigator.mediaDevices.getUserMedia({ video: true }).then((s) => {
                        el.srcObject = s;
                      }).catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none z-10"></div>
                <span className="text-[10px] font-bold text-white z-20 absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/50 px-2.5 py-1 rounded-full border border-white/10 backdrop-blur-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                  LIVE CAMERA RECORDING
                </span>
              </div>
            )}

            {/* Question Navigator Card */}
            <div className="bg-surface-card border border-border rounded-2xl p-5 flex-1 flex flex-col min-h-0 shadow-md">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-border shrink-0">
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Question Navigator</h4>
                <span className="text-[10px] font-bold text-text-muted font-mono bg-surface-page px-2 py-0.5 rounded-full border border-border">
                  {Object.keys(attemptAnswers).length} / {activeQuestionsList.length} Answered
                </span>
              </div>

              <div className="flex-1 overflow-y-auto grid grid-cols-4 gap-2.5 pr-1">
                {activeQuestionsList.map((qId: string, idx: number) => (
                  <button
                    key={qId}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={clsx(
                      "h-10 rounded-xl text-xs font-bold flex items-center justify-center transition-all shadow-sm",
                      currentQuestionIndex === idx
                        ? "bg-primary text-white ring-2 ring-primary/40 scale-105"
                        : attemptAnswers[qId]
                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30"
                          : "bg-surface-page text-text-muted hover:bg-surface-container border border-border"
                    )}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-xl font-bold text-text-primary">{isCandidate ? 'My Exams' : 'Exams'}</h1>
          <p className="text-body-sm text-text-muted mt-1">
            {isCandidate ? 'View and launch your assigned examinations.' : 'Manage and monitor all examinations.'}
          </p>
        </div>
        {!isCandidate && (
          <button className="btn-cta" onClick={() => router.push('/dashboard/exams/create')}>
            <span className="material-symbols-outlined text-lg">add</span>
            Create Exam
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(activeTab === tab ? 'tab-active' : 'tab')}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-danger-bg border border-red-200 text-danger text-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
            <button onClick={fetchExams} className="ml-auto text-xs font-medium underline">Retry</button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : displayedExams.length === 0 ? (
        <div className="card text-center py-12">
          <span className="material-symbols-outlined text-5xl text-text-muted mb-4">quiz</span>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No exams found</h3>
          <p className="text-body-sm text-text-muted mb-6">
            {activeTab !== 'All'
              ? `No ${activeTab.toLowerCase()} exams. Try switching tabs.`
              : (isCandidate ? 'You have no assigned exams available to attempt.' : 'Get started by creating your first exam.')}
          </p>
          {!isCandidate && (
            <button className="btn-cta" onClick={() => router.push('/dashboard/exams/create')}>
              <span className="material-symbols-outlined text-lg">add</span>
              Create Exam
            </button>
          )}
        </div>
      ) : (
        /* Exam Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedExams.map((exam) => (
            <div key={exam.id} className="card group cursor-pointer hover:shadow-card-hover transition-all duration-200" onClick={() => handleOpenExam(exam)}>
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <span className={clsx('badge text-xs', statusConfig[exam.status]?.badge)}>
                  {statusConfig[exam.status]?.label || exam.status}
                </span>
                {exam.enableProctoring && (
                  <span className="flex items-center gap-1 text-emerald text-xs font-medium">
                    <span className="material-symbols-outlined text-sm">videocam</span>
                    Proctored
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-base font-semibold text-text-primary leading-snug mb-3 group-hover:text-primary transition-colors">
                {exam.title}
              </h3>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-text-muted text-base">timer</span>
                  <span className="text-sm text-text-secondary">{exam.duration} min</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-text-muted text-base">help_center</span>
                  <span className="text-sm text-text-secondary">{exam.sections?.length || 0} sections</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-text-muted text-base">school</span>
                  <span className="text-sm text-text-secondary">{getCandidateCount(exam)} candidates</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-text-muted text-base">grade</span>
                  <span className="text-sm text-text-secondary">{exam.totalMarks} marks</span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-caption-xs text-text-muted">
                  {formatDate(exam.startTime)}
                </span>
                <div className="flex items-center gap-2">
                  {!isCandidate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteExam(exam.id);
                      }}
                      className="p-1 rounded text-text-muted hover:text-danger hover:bg-white/5 transition-colors"
                      title="Delete Exam"
                    >
                      <span className="material-symbols-outlined text-lg leading-none">delete</span>
                    </button>
                  )}
                  <button className="text-cta hover:text-cta-hover text-sm font-medium transition-colors">
                    View →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── EXAM DETAIL / TAKE MODAL ───────────────────────── */}
      {selectedExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          {!isAttempting && !attemptFinished ? (
            /* PREVIEW / DETAILS WINDOW */
            <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-scale-in">
              <button onClick={() => setSelectedExam(null)} className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>

              <h2 className="text-headline-lg font-bold text-text-primary mb-2">{selectedExam.title}</h2>
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className={clsx('badge text-xs', statusConfig[selectedExam.status]?.badge)}>
                  {statusConfig[selectedExam.status]?.label || selectedExam.status}
                </span>
                <span className="text-sm text-text-muted">Passing Score: {selectedExam.passingScore}/{selectedExam.totalMarks}</span>
                <span className="text-sm text-text-muted">Time Limit: {selectedExam.duration} min</span>
                {selectedExam.negativeMarking && (
                  <span className="badge text-xs bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">warning</span>
                    Negative Marking: -{selectedExam.negativeMarkValue} pt
                  </span>
                )}
              </div>

              {isLoadingDetails ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                  <p className="text-sm text-text-muted">Fetching exam components & questions...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {detailedExam?.description && (
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary mb-2">Description</h4>
                      <p className="text-sm text-text-secondary leading-relaxed">{detailedExam.description}</p>
                    </div>
                  )}

                  {detailedExam?.instructions && (
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary mb-2">Instructions</h4>
                      <p className="text-sm text-text-secondary leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">{detailedExam.instructions}</p>
                    </div>
                  )}

                  {/* Sections list preview */}
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary mb-3">Sections & Questions</h4>
                    {(!detailedExam?.sections || detailedExam.sections.length === 0) ? (
                      <div className="p-4 border border-warning/20 rounded-xl bg-warning-bg/5 flex items-start gap-2.5 text-warning">
                        <span className="material-symbols-outlined text-lg">warning</span>
                        <div>
                          <h5 className="text-sm font-semibold">No questions configured</h5>
                          <p className="text-xs text-text-muted mt-0.5">
                            This exam does not have any questions or sections set up yet. It cannot be launched in this state.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {detailedExam.sections.map((sec: any, idx: number) => (
                          <div key={sec.id} className="p-3 border border-white/5 rounded-xl bg-white/5 flex items-center justify-between">
                            <div>
                              <span className="text-xs font-semibold text-primary">SECTION {idx + 1}</span>
                              <h5 className="text-sm font-semibold text-text-primary">{sec.title}</h5>
                              <p className="text-xs text-text-muted mt-0.5">{sec.description || 'No description provided'}</p>
                            </div>
                            <span className="badge-primary text-xs">{sec.questions?.length || 0} Questions</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedExam.enableProctoring && (
                    <div className="p-4 border border-emerald/20 rounded-xl bg-emerald/5 flex items-start gap-3">
                      <span className="material-symbols-outlined text-emerald mt-0.5">videocam</span>
                      <div>
                        <h5 className="text-sm font-semibold text-emerald">Webcam & AI Proctoring Enabled</h5>
                        <p className="text-xs text-emerald/80 mt-0.5 leading-relaxed">
                          Your web camera, screen status, and mouse movements will be tracked during the attempt to ensure examination integrity.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-3 pt-4 border-t border-border">
                    {isCandidate && (selectedExam.status === 'PUBLISHED' || selectedExam.status === 'IN_PROGRESS') && (() => {
                      const { candAss, isTerminated } = getCandidateStats(detailedExam || selectedExam);

                      if (isTerminated) {
                        return (
                          <div className="p-4 border border-red-500/30 bg-red-500/10 rounded-xl text-red-400 flex items-start gap-3 w-full">
                            <span className="material-symbols-outlined text-red-500 text-xl shrink-0 mt-0.5">block</span>
                            <div className="flex-1">
                              <h5 className="text-sm font-bold text-red-400">Exam Terminated by Proctor</h5>
                              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                                You are not allowed to re-attempt this examination because your previous session was terminated by a proctor due to security rules.
                              </p>
                              {candAss?.terminationReason && (
                                <p className="text-xs text-red-300 font-mono mt-2 bg-black/40 p-2 rounded border border-red-500/20">
                                  <strong>Reason:</strong> {candAss.terminationReason}
                                  {candAss.terminationNote && <span className="block text-slate-400 font-normal mt-0.5"><strong>Note:</strong> {candAss.terminationNote}</span>}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className="flex gap-3 justify-end items-center">
                      <button onClick={() => setSelectedExam(null)} className="btn-secondary">Close</button>
                      {isCandidate && (selectedExam.status === 'PUBLISHED' || selectedExam.status === 'IN_PROGRESS') && (() => {
                        const { candAss, maxAttempts, attemptsUsed, isTerminated, isCompleted } = getCandidateStats(detailedExam || selectedExam);

                        if (isTerminated) {
                          return (
                            <button disabled className="btn-secondary opacity-60 cursor-not-allowed flex items-center gap-2 text-danger border-danger/30">
                              <span className="material-symbols-outlined text-lg">block</span>
                              Attempt Blocked (Terminated by Proctor)
                            </button>
                          );
                        }

                        if (isCompleted || (attemptsUsed >= maxAttempts && attemptsUsed > 0)) {
                          return (
                            <button disabled className="btn-secondary opacity-60 cursor-not-allowed flex items-center gap-2">
                              <span className="material-symbols-outlined text-lg text-emerald">check_circle</span>
                              Maximum Attempts Reached ({attemptsUsed}/{maxAttempts})
                            </button>
                          );
                        }
                        return (
                          <button
                            onClick={handleStartAttempt}
                            disabled={activeQuestionsList.length === 0}
                            className={clsx(
                              "btn-cta flex items-center gap-2",
                              activeQuestionsList.length === 0 && "opacity-50 cursor-not-allowed"
                            )}
                            title={activeQuestionsList.length === 0 ? "This exam has no questions configured yet." : ""}
                          >
                            <span className="material-symbols-outlined text-lg">play_arrow</span>
                            {activeQuestionsList.length === 0 ? 'No Questions Linked' : 'Start Exam'}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ATTEMPT COMPLETED / TERMINATED SUMMARY */
            (() => {
              const terminatedAss = detailedExam?.assignments?.find((a: any) => a.candidateId === user?.id && (a.sessionStatus === 'TERMINATED' || a.terminationReason));
              const isTerminated = !!terminatedAss || detailedExam?.sessionStatus === 'TERMINATED';

              if (isTerminated) {
                return (
                  <div className="card w-full max-w-md text-center p-8 animate-scale-in border border-red-500/30 bg-surface-card space-y-4">
                    <span className="material-symbols-outlined text-6xl p-4 rounded-full bg-red-500/10 text-red-500 inline-block animate-bounce mx-auto">
                      gavel
                    </span>

                    <h2 className="text-headline-lg font-bold text-red-400">
                      Exam Terminated by Proctor
                    </h2>
                    <p className="text-xs text-slate-300 leading-relaxed bg-red-500/10 p-3.5 rounded-xl border border-red-500/20">
                      Your examination session was terminated by the proctor due to proctoring policy or security rules.
                      {terminatedAss?.terminationReason && (
                        <span className="block mt-1.5 font-mono text-xs text-red-300">
                          <strong>Reason:</strong> {terminatedAss.terminationReason}
                        </span>
                      )}
                    </p>

                    <div className="border border-white/10 rounded-xl bg-white/5 p-4 text-left space-y-1 text-xs">
                      <p className="text-text-muted"><strong>Evaluation Status:</strong> <span className="text-amber-400 font-bold">Pending Teacher Review & Marks</span></p>
                      <p className="text-text-muted mt-1 leading-relaxed">
                        The teacher will inspect your proctoring logs and partial responses, and decide the final evaluation marks for your attempt.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedExam(null);
                        setAttemptFinished(false);
                      }}
                      className="w-full btn-primary py-2.5 rounded-xl"
                    >
                      Return to Dashboard
                    </button>
                  </div>
                );
              }

              return (
                <div className="card w-full max-w-md text-center p-8 animate-scale-in">
                  <span className="material-symbols-outlined text-6xl mb-4 inline-block p-4 rounded-full bg-emerald/10 text-emerald animate-pulse">
                    pending_actions
                  </span>

                  <h2 className="text-headline-lg font-bold text-text-primary mb-2">
                    Exam Submitted successfully!
                  </h2>
                  <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                    Your answers have been uploaded and are currently under evaluation. Please wait for the teacher to review and announce the final results.
                  </p>

                  <div className="border border-white/5 rounded-xl bg-white/5 p-4 mb-6">
                    <p className="text-xs text-text-muted leading-relaxed">
                      You can monitor the evaluation status under the <strong>"Exams Taken"</strong> section in your sidebar.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedExam(null);
                      setAttemptFinished(false);
                    }}
                    className="w-full btn-primary py-2.5 rounded-xl"
                  >
                    Return to Dashboard
                  </button>
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// PROGRAMMING WORKSPACE COMPONENT
// ==========================================

const LANGUAGES = [
  { id: 71, name: 'Python (3.8.1)', short: 'Python' },
  { id: 62, name: 'Java (OpenJDK 13.0.1)', short: 'Java' },
  { id: 54, name: 'C++ (GCC 9.2.0)', short: 'C++' },
  { id: 63, name: 'JavaScript (Node.js 12.14.0)', short: 'JavaScript' },
  { id: 74, name: 'TypeScript (3.7.4)', short: 'TypeScript' },
  { id: 50, name: 'C (GCC 9.2.0)', short: 'C' },
  { id: 60, name: 'Go (1.13.5)', short: 'Go' },
  { id: 73, name: 'Rust (1.40.0)', short: 'Rust' },
];

const DEFAULT_CODE: Record<number, string> = {
  71: `# Python 3\ndef solve():\n    # Write your solution here\n    pass\n\nsolve()\n`,
  62: `// Java\nimport java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n    }\n}\n`,
  54: `// C++\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n`,
  63: `// JavaScript\nconst readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\n\nrl.on('line', (line) => {\n    // Write your solution here\n});\n`,
  74: `// TypeScript\nconst readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\n\nrl.on('line', (line: string) => {\n    // Write your solution here\n});\n`,
  50: `// C\n#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n`,
  60: `// Go\npackage main\nimport "fmt"\n\nfunc main() {\n    // Write your solution here\n}\n`,
};

function ProgrammingWorkspace({ question, value, onChange }: { question: any, value: string, onChange: (val: string) => void }) {
  const [selectedLanguage, setSelectedLanguage] = useState(
    question.programmingLanguage ? parseInt(question.programmingLanguage) : 71
  );

  // Set initial template code if value is empty
  useEffect(() => {
    if (!value) {
      if (question.templateCode) {
        onChange(question.templateCode);
      } else if (DEFAULT_CODE[selectedLanguage]) {
        onChange(DEFAULT_CODE[selectedLanguage]);
      }
    }
  }, [selectedLanguage, question, value]);

  const [stdin, setStdin] = useState('');
  const [activeTab, setActiveTab] = useState<'run' | 'testcases'>('testcases');
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<any | null>(null);
  const [testResults, setTestResults] = useState<any | null>(null);

  // Parse test cases
  let parsedTestCases: Array<{ input: string; expected_output: string }> = [];
  try {
    if (question.testCases) {
      parsedTestCases = JSON.parse(question.testCases);
    }
  } catch (err) {
    console.error('Failed to parse test cases:', err);
  }

  const handleRunCode = async () => {
    setIsRunning(true);
    setRunResult(null);
    setTestResults(null);
    setActiveTab('run');
    try {
      const res = await codeExecutionApi.submit({
        source_code: value,
        language_id: selectedLanguage,
        stdin: stdin,
      });
      setRunResult(res.data.data || res.data);
    } catch (err: any) {
      setRunResult({
        stderr: err.response?.data?.message || err.message || 'Service Error',
        status: { description: 'Error' }
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunTests = async () => {
    if (parsedTestCases.length === 0) {
      alert('No test cases defined for this question.');
      return;
    }
    setIsRunning(true);
    setRunResult(null);
    setTestResults(null);
    setActiveTab('testcases');
    try {
      const res = await codeExecutionApi.runTestCases({
        source_code: value,
        language_id: selectedLanguage,
        test_cases: parsedTestCases,
      });
      setTestResults(res.data.data || res.data);
    } catch (err: any) {
      alert('Test run failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4 mt-4 border border-border bg-surface-card rounded-2xl p-5 shadow-sm animate-fade-in">
      {/* IDE Top Control Bar */}
      <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-base text-primary">code</span>
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Language:</label>
          <select
            className="bg-surface-page border border-border text-text-primary rounded-xl px-3 py-1.5 text-xs font-bold focus:border-primary outline-none shadow-sm cursor-pointer"
            value={selectedLanguage}
            onChange={(e) => {
              const langId = parseInt(e.target.value);
              setSelectedLanguage(langId);
              if (DEFAULT_CODE[langId]) {
                onChange(DEFAULT_CODE[langId]);
              }
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id} className="bg-surface-card text-text-primary">{l.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={isRunning}
            onClick={handleRunCode}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">play_arrow</span> Run Code
          </button>
          <button
            type="button"
            disabled={isRunning || parsedTestCases.length === 0}
            onClick={handleRunTests}
            className="btn-cta px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-cta/20 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">task_alt</span> Run Test Cases
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor Area */}
        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-primary">terminal</span>
              Write Solution
            </label>
            <button
              type="button"
              onClick={() => DEFAULT_CODE[selectedLanguage] && onChange(DEFAULT_CODE[selectedLanguage])}
              className="text-[10px] text-text-muted hover:text-primary transition-colors flex items-center gap-1 font-mono"
            >
              <span className="material-symbols-outlined text-xs">restart_alt</span> Reset Template
            </button>
          </div>
          <textarea
            rows={13}
            className="w-full font-mono text-sm p-4 rounded-2xl border border-border bg-surface-page dark:bg-[#0B0414] text-text-primary focus:border-primary focus:ring-1 focus:ring-primary outline-none whitespace-pre leading-relaxed shadow-inner font-normal transition-all"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>

        {/* Console & Test Case Results Panel */}
        <div className="border border-border bg-surface-page rounded-2xl flex flex-col overflow-hidden min-h-[340px] shadow-sm">
          {/* Output Navigation Header */}
          <div className="flex border-b border-border bg-surface-card p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('testcases')}
              className={clsx(
                "px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5",
                activeTab === 'testcases' 
                  ? "bg-surface-page text-primary shadow-sm border border-border" 
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              <span className="material-symbols-outlined text-sm">fact_check</span>
              Test Cases ({testResults ? `${testResults.passed}/${testResults.total}` : `0/${parsedTestCases.length}`})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('run')}
              className={clsx(
                "px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5",
                activeTab === 'run' 
                  ? "bg-surface-page text-primary shadow-sm border border-border" 
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              <span className="material-symbols-outlined text-sm">wysiwyg</span>
              Console Output
            </button>
          </div>

          {/* Output Content Container */}
          <div className="p-4 flex-1 overflow-y-auto space-y-4 bg-surface-page">
            {isRunning ? (
              <div className="h-full flex flex-col justify-center items-center py-16 text-xs text-text-muted">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                Evaluating solution on Judge0 sandbox...
              </div>
            ) : activeTab === 'run' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-text-muted block font-bold uppercase tracking-wider mb-1">Standard Input (Stdin):</label>
                  <textarea
                    rows={2}
                    placeholder="Enter custom input here..."
                    className="w-full text-xs font-mono p-2.5 rounded-xl bg-surface-card border border-border text-text-primary outline-none focus:border-primary"
                    value={stdin}
                    onChange={(e) => setStdin(e.target.value)}
                  />
                </div>

                {runResult && (
                  <div className="space-y-2.5 border-t border-border pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-text-muted block font-bold uppercase tracking-wider">Status:</span>
                      <span className={clsx(
                        "text-xs font-bold px-2 py-0.5 rounded-full border",
                        runResult.status?.id === 3 
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30" 
                          : "bg-red-500/10 text-red-500 border-red-500/30"
                      )}>
                        {runResult.status?.description || 'Completed'}
                      </span>
                    </div>

                    {runResult.compile_output && (
                      <div>
                        <span className="text-[10px] text-red-500 block font-bold uppercase tracking-wider mb-1">Compilation Error:</span>
                        <pre className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 p-3 rounded-xl font-mono overflow-x-auto max-h-[150px] whitespace-pre-wrap">{runResult.compile_output}</pre>
                      </div>
                    )}

                    {runResult.stderr && (
                      <div>
                        <span className="text-[10px] text-red-500 block font-bold uppercase tracking-wider mb-1">Runtime Error:</span>
                        <pre className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 p-3 rounded-xl font-mono overflow-x-auto max-h-[150px] whitespace-pre-wrap">{runResult.stderr}</pre>
                      </div>
                    )}

                    {runResult.stdout !== undefined && (
                      <div>
                        <span className="text-[10px] text-text-muted block font-bold uppercase tracking-wider mb-1">Standard Output (Stdout):</span>
                        <pre className="text-xs text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl font-mono overflow-x-auto max-h-[150px] whitespace-pre-wrap">{runResult.stdout || '(no output)'}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Test Cases View */
              <div className="space-y-3">
                {parsedTestCases.length === 0 ? (
                  <p className="text-xs text-text-muted italic text-center py-8">No test cases configured for this question.</p>
                ) : testResults?.results ? (
                  testResults.results.map((tr: any) => (
                    <div key={tr.testCase} className="p-3.5 border border-border bg-surface-card rounded-2xl space-y-2.5 shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-text-primary">Test Case {tr.testCase}</span>
                        <span className={clsx(
                          "text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
                          tr.passed 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30" 
                            : "bg-red-500/10 text-red-500 border-red-500/30"
                        )}>
                          {tr.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-text-muted block font-semibold mb-0.5">Input:</span>
                          <pre className="bg-surface-page border border-border text-text-primary p-2 rounded-xl font-mono truncate">{tr.input}</pre>
                        </div>
                        <div>
                          <span className="text-text-muted block font-semibold mb-0.5">Expected:</span>
                          <pre className="bg-surface-page border border-border text-text-primary p-2 rounded-xl font-mono truncate">{tr.expectedOutput}</pre>
                        </div>
                      </div>
                      {!tr.passed && tr.actualOutput && (
                        <div className="text-[10px]">
                          <span className="text-red-500 block font-semibold mb-0.5">Actual Output:</span>
                          <pre className="bg-red-500/10 border border-red-500/20 p-2 rounded-xl font-mono text-red-500 truncate">{tr.actualOutput}</pre>
                        </div>
                      )}
                      {!tr.passed && tr.error && (
                        <div className="text-[10px]">
                          <span className="text-red-500 block font-semibold mb-0.5">Error:</span>
                          <pre className="bg-red-500/10 border border-red-500/20 p-2 rounded-xl font-mono text-red-500 whitespace-pre-wrap">{tr.error}</pre>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  parsedTestCases.map((tc, idx) => (
                    <div key={idx} className="p-3.5 border border-border bg-surface-card rounded-2xl space-y-2.5 shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-text-primary">Test Case {idx + 1}</span>
                        <span className="text-[10px] font-bold text-text-muted bg-surface-page px-2 py-0.5 rounded-full border border-border">Not Run</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-text-muted block font-semibold mb-0.5">Input:</span>
                          <pre className="bg-surface-page border border-border text-text-primary p-2 rounded-xl font-mono truncate">{tc.input}</pre>
                        </div>
                        <div>
                          <span className="text-text-muted block font-semibold mb-0.5">Expected:</span>
                          <pre className="bg-surface-page border border-border text-text-primary p-2 rounded-xl font-mono truncate">{tc.expected_output}</pre>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
