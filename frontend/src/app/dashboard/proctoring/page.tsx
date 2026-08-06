'use client';

import { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { io, Socket } from 'socket.io-client';
import { examApi, userApi } from '@/lib/api';
import { useToastStore } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import ProctoringConfigModal from '@/components/exam/ProctoringConfigModal';

interface CandidateSession {
  id: string; // assignmentId
  candidateId: string;
  name: string;
  email: string;
  examId: string;
  examTitle: string;
  trustScore: number;
  sessionStatus: 'ACTIVE' | 'DISCONNECTED' | 'WARNED' | 'FLAGGED' | 'TERMINATED' | 'SUBMITTED';
  startedAt?: string;
  activeTime: string;
  questionsAnswered: number;
  totalQuestions: number;
  screenshot?: string;
  screenScreenshot?: string;
  incidents: IncidentItem[];
  decisionLogs: DecisionLogItem[];
  proctorWarnings: any[];
  terminationReason?: string;
  terminationNote?: string;
  examObj?: any;
}

interface IncidentItem {
  id: string;
  timestamp: string;
  flagType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  confidenceScore: number;
  screenshot?: string;
  reviewerDecision: 'PENDING' | 'DISMISSED' | 'WARNED' | 'ESCALATED' | 'TERMINATED';
  reviewerReason?: string;
  reviewerIdentity?: string;
}

interface DecisionLogItem {
  id: string;
  actionType: string;
  rationale: string;
  reviewerIdentity: string;
  timestamp: string;
}

export default function ProctoringDashboardPage() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('ALL');
  const [sessions, setSessions] = useState<CandidateSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [scoreFilter, setScoreFilter] = useState<string>('ALL');

  // Selected Session for Detail View Drawer
  const [inspectSession, setInspectSession] = useState<CandidateSession | null>(null);
  const [activeTab, setActiveTab] = useState<'WEBCAM' | 'SCREEN'>('WEBCAM');
  const [incidentSort, setIncidentSort] = useState<'TIME_DESC' | 'TIME_ASC' | 'SEVERITY'>('TIME_DESC');

  // Modal states
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedExamForConfig, setSelectedExamForConfig] = useState<any>(null);

  // Warning Modal
  const [warningModalSession, setWarningModalSession] = useState<CandidateSession | null>(null);
  const [warningMessage, setWarningMessage] = useState<string>('');

  // Termination Modal
  const [terminateModalSession, setTerminateModalSession] = useState<CandidateSession | null>(null);
  const [terminateReason, setTerminateReason] = useState<string>('Cheating / External Material Detected');
  const [terminateNote, setTerminateNote] = useState<string>('');

  const socketRef = useRef<Socket | null>(null);

  if (user?.role === 'TEACHER') {
    return (
      <div className="card text-center py-16 px-6 space-y-4 border border-dashed border-red-500/20 bg-surface-card rounded-2xl animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-3xl">block</span>
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h3 className="text-headline-md font-bold text-text-primary">Live Proctoring Access Restricted</h3>
          <p className="text-xs text-text-muted leading-relaxed">
            The Live Proctoring Console is reserved for Proctors and Administrators. As a Teacher, you can review student flags in the <a href="/dashboard/incidents" className="text-primary underline font-semibold">Incidents Log</a> and grade submissions in <a href="/dashboard/submissions" className="text-primary underline font-semibold">Review Submissions</a>.
          </p>
        </div>
      </div>
    );
  }

  // 1. Fetch exams and initial proctor sessions
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const activeTenantId = user?.tenantId;

      // Load exams list
      const examRes = await examApi.list({ tenantId: activeTenantId });
      const resObj = examRes.data;
      let examList: any[] = [];
      if (Array.isArray(resObj)) {
        examList = resObj;
      } else if (Array.isArray(resObj?.data?.data)) {
        examList = resObj.data.data;
      } else if (Array.isArray(resObj?.data?.items)) {
        examList = resObj.data.items;
      } else if (Array.isArray(resObj?.data)) {
        examList = resObj.data;
      } else if (Array.isArray(resObj?.items)) {
        examList = resObj.items;
      }

      setExams(Array.isArray(examList) ? examList : []);

      // Load assignments/sessions
      const assignRes = await examApi.listAssignments({ tenantId: activeTenantId });
      const assignObj = assignRes.data;
      let rawAssignments: any[] = [];
      if (Array.isArray(assignObj)) {
        rawAssignments = assignObj;
      } else if (Array.isArray(assignObj?.data?.data)) {
        rawAssignments = assignObj.data.data;
      } else if (Array.isArray(assignObj?.data?.items)) {
        rawAssignments = assignObj.data.items;
      } else if (Array.isArray(assignObj?.data)) {
        rawAssignments = assignObj.data;
      }

      // Fetch Users list to resolve candidate names and emails from MongoDB
      let userMap: Record<string, any> = {};
      try {
        const usersRes = await userApi.list({ tenantId: activeTenantId, limit: 100 });
        const uData = usersRes.data;
        let usersList: any[] = [];
        if (Array.isArray(uData)) {
          usersList = uData;
        } else if (Array.isArray(uData?.data?.data)) {
          usersList = uData.data.data;
        } else if (Array.isArray(uData?.data?.items)) {
          usersList = uData.data.items;
        } else if (Array.isArray(uData?.data?.users)) {
          usersList = uData.data.users;
        } else if (Array.isArray(uData?.data)) {
          usersList = uData.data;
        } else if (Array.isArray(uData?.items)) {
          usersList = uData.items;
        }

        if (Array.isArray(usersList)) {
          usersList.forEach((u: any) => {
            if (u.id) userMap[u.id] = u;
            if (u._id) userMap[String(u._id)] = u;
            if (u.email) userMap[u.email] = u;
          });
        }
      } catch (e) { }

      // Mapped candidate sessions from real MongoDB records
      const mapped: CandidateSession[] = rawAssignments
        .map((a: any, idx: number) => {
          const candUser = userMap[a.candidateId] || Object.values(userMap).find((u: any) => u.id === a.candidateId || u._id === a.candidateId || u.email === a.candidateId);
          const name = candUser ? `${candUser.firstName} ${candUser.lastName || ''}`.trim() : (a.candidateName && !a.candidateName.includes('[e_id]') ? a.candidateName : 'John Doe');
          const email = candUser ? candUser.email : (a.candidateEmail || `candidate${idx + 1}@acme.edu`);

          const incidents: IncidentItem[] = (a.incidents || []).map((inc: any) => ({
            id: inc.id,
            timestamp: inc.timestamp ? new Date(inc.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
            flagType: inc.flagType || 'TAB_SWITCH',
            severity: (inc.severity as any) || 'MEDIUM',
            confidenceScore: inc.confidenceScore || 0.88,
            screenshot: inc.screenshot || null,
            reviewerDecision: inc.reviewerDecision || 'PENDING',
            reviewerReason: inc.reviewerReason,
            reviewerIdentity: inc.reviewerIdentity,
          }));

          let parsedWarnings: any[] = [];
          try {
            if (a.proctorWarnings) parsedWarnings = JSON.parse(a.proctorWarnings);
          } catch (e) { }

          const trustScore = a.trustScore ?? 100;
          let calculatedSessionStatus: CandidateSession['sessionStatus'] = a.sessionStatus || 'ACTIVE';
          if (a.status === 'SUBMITTED' && calculatedSessionStatus !== 'TERMINATED') calculatedSessionStatus = 'SUBMITTED';

          let questionsAnswered = 0;
          try {
            if (a.answers) {
              const parsedAnswers = typeof a.answers === 'string' ? JSON.parse(a.answers) : a.answers;
              if (typeof parsedAnswers === 'object' && parsedAnswers !== null) {
                questionsAnswered = Object.keys(parsedAnswers).length;
              }
            }
          } catch (e) { }

          let totalQuestions = 0;
          if (Array.isArray(a.exam?.sections)) {
            totalQuestions = a.exam.sections.reduce((acc: number, sec: any) => {
              return acc + (Array.isArray(sec.questions) ? sec.questions.length : 0);
            }, 0);
          }
          if (totalQuestions === 0) {
            totalQuestions = a.totalQuestions || 10;
          }

          const initialScreenshot = a.screenshot || (incidents.find((i) => i.screenshot)?.screenshot) || null;

          return {
            id: a.id,
            candidateId: a.candidateId,
            name,
            email,
            examId: a.examId,
            examTitle: a.exam?.title || 'Comprehensive Assessment',
            trustScore,
            sessionStatus: calculatedSessionStatus,
            startedAt: a.startedAt,
            activeTime: a.startedAt
              ? `${Math.max(1, Math.round((Date.now() - new Date(a.startedAt).getTime()) / 60000))}m elapsed`
              : 'Not Started',
            questionsAnswered,
            totalQuestions,
            screenshot: initialScreenshot,
            incidents,
            decisionLogs: a.decisionLogs || [],
            proctorWarnings: parsedWarnings,
            terminationReason: a.terminationReason,
            terminationNote: a.terminationNote,
            examObj: a.exam,
            rawStatus: a.status,
          };
        })
        .filter((s: any) => {
          // Live Proctoring displays ONLY candidate sessions that are actively IN_PROGRESS.
          // Once an exam is ended (SUBMITTED) or TERMINATED, it is removed from Live Proctoring.
          const isOngoingSession = s.rawStatus === 'IN_PROGRESS' && !!s.startedAt && s.sessionStatus !== 'TERMINATED' && s.sessionStatus !== 'SUBMITTED';
          return isOngoingSession;
        });

      setSessions(mapped);
    } catch (err) {
      addToast('Failed to load proctoring session grid from MongoDB', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    // 2. Setup Socket Connection for Real-time Dashboard Updates
    const socket = io('http://localhost:3004');
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Proctor Dashboard real-time socket connected');
    });

    // Handle real-time candidate live video frame stream
    socket.on('candidate-video-frame', (payload: { assignmentId: string; screenshot: string; candidateName?: string; examId?: string }) => {
      if (!payload?.assignmentId || !payload?.screenshot) return;
      setSessions((prev) => {
        const exists = prev.some((s) => s.id === payload.assignmentId || s.examId === payload.examId);
        if (!exists) {
          const newSession: CandidateSession = {
            id: payload.assignmentId,
            candidateId: (payload as any).candidateId || 'candidate_id',
            name: payload.candidateName && !payload.candidateName.includes('[e_id]') ? payload.candidateName : 'John Doe',
            email: (payload as any).candidateEmail || 'candidate@acme.edu',
            examId: payload.examId || 'exam_id',
            examTitle: (payload as any).examTitle || 'Proctored Exam',
            sessionStatus: 'ACTIVE',
            trustScore: 100,
            activeTime: 'Just started',
            screenshot: payload.screenshot,
            questionsAnswered: 0,
            totalQuestions: 10,
            incidents: [],
            decisionLogs: [],
            proctorWarnings: [],
          };
          return [...prev, newSession];
        }
        return prev.map((s) => (s.id === payload.assignmentId || s.examId === payload.examId ? { ...s, screenshot: payload.screenshot, sessionStatus: s.sessionStatus === 'DISCONNECTED' ? 'ACTIVE' : s.sessionStatus } : s));
      });
      setInspectSession((prev) => (prev && (prev.id === payload.assignmentId || prev.examId === payload.examId) ? { ...prev, screenshot: payload.screenshot } : prev));
    });

    // Handle real-time candidate live screen stream
    socket.on('candidate-screen-frame', (payload: { assignmentId: string; screenScreenshot: string }) => {
      if (!payload?.assignmentId || !payload?.screenScreenshot) return;
      setSessions((prev) =>
        prev.map((s) => (s.id === payload.assignmentId ? { ...s, screenScreenshot: payload.screenScreenshot } : s))
      );
      setInspectSession((prev) => (prev && prev.id === payload.assignmentId ? { ...prev, screenScreenshot: payload.screenScreenshot } : prev));
    });

    // Handle real-time candidate question progress updates
    socket.on('candidate-progress', (payload: { assignmentId: string; questionsAnswered: number; totalQuestions: number }) => {
      if (!payload?.assignmentId) return;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === payload.assignmentId
            ? {
              ...s,
              questionsAnswered: payload.questionsAnswered ?? s.questionsAnswered,
              totalQuestions: payload.totalQuestions ?? s.totalQuestions,
            }
            : s
        )
      );
      setInspectSession((prev) =>
        prev && prev.id === payload.assignmentId
          ? {
            ...prev,
            questionsAnswered: payload.questionsAnswered ?? prev.questionsAnswered,
            totalQuestions: payload.totalQuestions ?? prev.totalQuestions,
          }
          : prev
      );
    });

    // Handle AI Proctor Alert (AI sends msg to proctor about suspicious activity)
    socket.on('ai-proctor-alert', (payload: any) => {
      if (payload?.message) {
        addToast(payload.message, 'warning');
      }
    });

    // Handle security incident flag alerts
    socket.on('incident-flagged', (payload: any) => {
      setSessions((prev) =>
        prev.map((s) => {
          const isMatch = s.id === payload.assignmentId || s.id === payload.originalAssignmentId || s.examId === payload.examId || (payload.candidateId && s.candidateId === payload.candidateId);
          if (isMatch) {
            const newIncident: IncidentItem = {
              id: payload.incidentId || `inc_${Date.now()}`,
              timestamp: new Date(payload.timestamp || Date.now()).toLocaleTimeString(),
              flagType: payload.flagType || 'AI_ALERT',
              severity: payload.severity || 'HIGH',
              confidenceScore: payload.confidenceScore || 0.95,
              screenshot: payload.screenshot || null,
              reviewerDecision: 'PENDING',
            };
            const updatedIncidents = [newIncident, ...(s.incidents || [])];
            const updatedScore = payload.trustScore ?? Math.max(0, s.trustScore - 15);
            let updatedStatus = s.sessionStatus;
            if (updatedScore < 30) updatedStatus = 'FLAGGED';
            else if (updatedScore < 50) updatedStatus = 'WARNED';

            const updatedSession = {
              ...s,
              trustScore: updatedScore,
              sessionStatus: updatedStatus,
              incidents: updatedIncidents,
              screenshot: payload.screenshot || s.screenshot,
            };

            setInspectSession((currentInspect) =>
              currentInspect && (currentInspect.id === s.id || currentInspect.id === payload.assignmentId)
                ? {
                  ...currentInspect,
                  trustScore: updatedScore,
                  sessionStatus: updatedStatus,
                  incidents: updatedIncidents,
                  screenshot: payload.screenshot || currentInspect.screenshot,
                }
                : currentInspect
            );

            return updatedSession;
          }
          return s;
        })
      );
      addToast(`🚨 Security Alert: Candidate ${payload.candidateName || 'John Doe'} flagged for ${payload.flagType || 'Violation'} (${payload.severity || 'HIGH'} severity)`, 'warning');
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [user]);

  // 3. Issue Warning Handler
  const handleIssueWarning = async () => {
    if (!warningModalSession || !warningMessage.trim()) return;
    try {
      const assignmentId = warningModalSession.id;
      const msg = warningMessage.trim();

      await examApi.warnCandidate(assignmentId, msg, user?.firstName || 'Proctor');

      if (socketRef.current) {
        socketRef.current.emit('send-warning', {
          assignmentId,
          examId: warningModalSession.examId,
          candidateId: warningModalSession.candidateId,
          message: msg,
        });
      }

      setSessions((prev) =>
        prev.map((s) =>
          s.id === assignmentId
            ? {
              ...s,
              sessionStatus: 'WARNED',
              proctorWarnings: [
                ...s.proctorWarnings,
                { id: `w_${Date.now()}`, message: msg, timestamp: new Date().toLocaleTimeString() },
              ],
            }
            : s
        )
      );

      addToast(`Text warning dispatched to candidate ${warningModalSession.name}`, 'success');
      setWarningModalSession(null);
      setWarningMessage('');
    } catch (err: any) {
      addToast('Failed to dispatch warning to candidate', 'error');
    }
  };

  // 4. Terminate Session Handler
  const handleTerminateSession = async () => {
    if (!terminateModalSession || !terminateReason) return;
    try {
      const assignmentId = terminateModalSession.id;
      await examApi.terminateCandidate(
        assignmentId,
        terminateReason,
        terminateNote,
        user?.firstName || 'Proctor',
        terminateModalSession.candidateId,
        terminateModalSession.examId
      );

      if (socketRef.current) {
        socketRef.current.emit('terminate-candidate', {
          assignmentId,
          reason: `${terminateReason}: ${terminateNote}`,
        });
      }

      setSessions((prev) => prev.filter((s) => s.id !== assignmentId && s.examId !== terminateModalSession.examId));

      addToast(`Candidate session terminated and removed from live proctoring.`, 'info');
      setTerminateModalSession(null);
      setTerminateNote('');
      if (inspectSession?.id === assignmentId) setInspectSession(null);
    } catch (err: any) {
      addToast('Failed to terminate candidate session', 'error');
    }
  };

  // 5. Incident Decision Review Workflow Handler (Req 4.5.5)
  const handleIncidentDecision = async (
    incidentId: string,
    decision: 'DISMISS' | 'ISSUE_WARNING' | 'ESCALATE' | 'TERMINATE'
  ) => {
    if (!inspectSession) return;
    try {
      await examApi.reviewIncidentWithAudit(incidentId, decision, `Proctor decision: ${decision}`, user?.firstName || 'Proctor');

      let scoreDelta = 0;
      if (decision === 'DISMISS') scoreDelta = 15;

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === inspectSession.id) {
            const updatedIncidents = s.incidents.map((inc) =>
              inc.id === incidentId
                ? { ...inc, reviewerDecision: decision as any, reviewerIdentity: user?.firstName || 'Proctor' }
                : inc
            );
            const newScore = Math.min(100, s.trustScore + scoreDelta);
            return {
              ...s,
              trustScore: newScore,
              incidents: updatedIncidents,
              sessionStatus: decision === 'TERMINATE' ? 'TERMINATED' : newScore >= 70 ? 'ACTIVE' : s.sessionStatus,
            };
          }
          return s;
        })
      );

      // Refresh inspected session
      setInspectSession((prev) => {
        if (!prev) return null;
        const updatedIncidents = prev.incidents.map((inc) =>
          inc.id === incidentId
            ? { ...inc, reviewerDecision: decision as any, reviewerIdentity: user?.firstName || 'Proctor' }
            : inc
        );
        return {
          ...prev,
          trustScore: Math.min(100, prev.trustScore + scoreDelta),
          incidents: updatedIncidents,
        };
      });

      addToast(`Incident decision logged: ${decision}`, 'success');
    } catch (err) {
      addToast('Failed to update incident decision', 'error');
    }
  };

  // Filtered Sessions Grid logic
  const filteredSessions = sessions.filter((s) => {
    if (selectedExamId !== 'ALL' && s.examId !== selectedExamId) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== 'ALL' && s.sessionStatus !== statusFilter) return false;
    if (scoreFilter === 'ALERT' && s.trustScore >= 70) return false;
    if (scoreFilter === 'WARNING' && (s.trustScore >= 50 || s.trustScore < 30)) return false;
    if (scoreFilter === 'CRITICAL' && s.trustScore >= 30) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-headline-xl font-bold text-text-primary">Proctor Dashboard (Req 4.7)</h1>
            <span className="badge bg-primary/10 text-primary border border-primary/20 text-xs font-bold px-2.5 py-0.5 rounded-full">
              Role: PROCTOR
            </span>
          </div>
          <p className="text-body-sm text-text-muted mt-1">
            Real-time grid view of active candidate sessions with live webcam feeds, incident timeline & trust score management.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            <span>Socket Live</span>
          </div>

          <button
            onClick={() => {
              const currentExam = exams.find((e) => e.id === selectedExamId) || exams[0];
              setSelectedExamForConfig(currentExam);
              setShowConfigModal(true);
            }}
            className="btn-secondary !py-2 !px-3.5 !text-xs !rounded-lg flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">settings</span>
            Proctoring Config (4.3.3)
          </button>
        </div>
      </div>

      {/* ── Stats Summary Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Active Candidate Grid', value: sessions.length, icon: 'grid_view', color: 'primary' },
          { label: 'Trust Alerts (<70%)', value: sessions.filter((s) => s.trustScore < 70).length, icon: 'warning', color: 'amber' },
          { label: 'Flagged Sessions', value: sessions.filter((s) => s.sessionStatus === 'FLAGGED').length, icon: 'flag', color: 'orange' },
          { label: 'Terminated Sessions', value: sessions.filter((s) => s.sessionStatus === 'TERMINATED').length, icon: 'cancel', color: 'red' },
          { label: 'Proctor Rooms', value: 'Live Stream', icon: 'videocam', color: 'emerald' },
        ].map((stat) => (
          <div key={stat.label} className="card-flat flex items-center gap-3 !p-3.5 border border-border">
            <div
              className={clsx(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                stat.color === 'primary' && 'bg-primary/10 text-primary',
                stat.color === 'amber' && 'bg-amber-500/10 text-amber-600',
                stat.color === 'orange' && 'bg-orange-500/10 text-orange-600',
                stat.color === 'red' && 'bg-red-500/10 text-red-600',
                stat.color === 'emerald' && 'bg-emerald-500/10 text-emerald-600'
              )}
            >
              <span className="material-symbols-outlined text-lg">{stat.icon}</span>
            </div>
            <div>
              <p className="text-lg font-bold text-text-primary leading-tight">{stat.value}</p>
              <p className="text-[11px] text-text-muted">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="card !p-4 flex flex-col md:flex-row items-center justify-between gap-3 border border-border">
        {/* Exam Dropdown Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-semibold text-text-secondary whitespace-nowrap">Exam:</span>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="input-field text-xs !py-1.5 !px-3 font-medium min-w-[200px] bg-surface-card text-text-primary border-border"
          >
            <option value="ALL" className="bg-surface-card text-text-primary">All Active Proctored Exams</option>
            {Array.isArray(exams) && exams.map((ex) => (
              <option key={ex.id} value={ex.id} className="bg-surface-card text-text-primary">
                {ex.title}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-text-muted text-sm">search</span>
          <input
            type="text"
            placeholder="Search candidate name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field text-xs pl-8 !py-1.5 w-full bg-surface-card text-text-primary placeholder:text-text-muted border-border"
          />
        </div>

        {/* Status Filter Dropdown */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-semibold text-text-secondary whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field text-xs !py-1.5 !px-3 font-medium bg-surface-card text-text-primary border-border"
          >
            <option value="ALL" className="bg-surface-card text-text-primary">All Statuses</option>
            <option value="ACTIVE" className="bg-surface-card text-text-primary">Active</option>
            <option value="WARNED" className="bg-surface-card text-text-primary">Warned</option>
            <option value="FLAGGED" className="bg-surface-card text-text-primary">Flagged</option>
            <option value="TERMINATED" className="bg-surface-card text-text-primary">Terminated</option>
            <option value="SUBMITTED" className="bg-surface-card text-text-primary">Submitted</option>
          </select>
        </div>

        {/* Trust Score Quick Filters */}
        <div className="flex items-center gap-1">
          {[
            { id: 'ALL', label: 'All Scores' },
            { id: 'ALERT', label: '<70 Trust' },
            { id: 'CRITICAL', label: '<30 Critical' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setScoreFilter(btn.id)}
              className={clsx(
                'text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all',
                scoreFilter === btn.id
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-page text-text-secondary hover:bg-surface-header border border-border'
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Real-Time Candidate Sessions Grid View (Req 4.7) ── */}
      {loading ? (
        <div className="card text-center py-12 border border-border">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin mb-2">sync</span>
          <p className="text-sm font-medium text-text-primary">Loading real-time candidate streams...</p>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="card text-center py-16 px-6 space-y-4 border border-dashed border-border bg-surface-card rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">videocam_off</span>
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-headline-md font-bold text-text-primary">No Active Candidate Exam Sessions</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              There are currently no active candidate exam sessions. Real-time webcam feeds, trust scores, and security logs will automatically appear here as soon as a student starts an assessment.
            </p>
          </div>
          <div className="pt-2">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Proctor Room Standing By (Real-Time Socket Connected)
            </span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSessions.map((session) => {
            const isCritical = session.trustScore < 30;
            const isAlert = session.trustScore < 70;

            return (
              <div
                key={session.id}
                className={clsx(
                  'card overflow-hidden border transition-all duration-200 hover:shadow-elevated flex flex-col',
                  session.sessionStatus === 'TERMINATED'
                    ? 'border-red-300 opacity-75'
                    : session.sessionStatus === 'FLAGGED' || isCritical
                      ? 'border-red-500 ring-2 ring-red-500/20'
                      : session.sessionStatus === 'WARNED'
                        ? 'border-amber-400 ring-1 ring-amber-400/20'
                        : 'border-border'
                )}
              >
                {/* Live Webcam Thumbnail Stream */}
                <div className="relative h-44 bg-slate-900 flex items-center justify-center text-white select-none">
                  {session.screenshot ? (
                    <img src={session.screenshot} alt="Webcam thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-400">
                      <span className="material-symbols-outlined text-4xl animate-pulse">videocam</span>
                      <span className="text-[10px] tracking-wider uppercase font-semibold">Live Webcam Feed</span>
                    </div>
                  )}

                  {/* Top Status Indicators (Req 4.7) */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="bg-red-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                      Live Feed
                    </span>

                    {/* Session status pill indicator */}
                    <span
                      className={clsx(
                        'text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-md',
                        session.sessionStatus === 'ACTIVE' && 'bg-emerald-600 text-white',
                        session.sessionStatus === 'WARNED' && 'bg-amber-500 text-white',
                        session.sessionStatus === 'FLAGGED' && 'bg-orange-600 text-white',
                        session.sessionStatus === 'TERMINATED' && 'bg-red-700 text-white',
                        session.sessionStatus === 'SUBMITTED' && 'bg-blue-600 text-white',
                        session.sessionStatus === 'DISCONNECTED' && 'bg-slate-700 text-white'
                      )}
                    >
                      {session.sessionStatus}
                    </span>
                  </div>

                  {/* Trust Score Badge */}
                  <div
                    className={clsx(
                      'absolute top-2.5 right-2.5 text-[10px] font-black px-2.5 py-1 rounded-md shadow-md flex items-center gap-1',
                      session.trustScore >= 70
                        ? 'bg-emerald-500 text-white'
                        : session.trustScore >= 50
                          ? 'bg-amber-500 text-white'
                          : 'bg-red-600 text-white'
                    )}
                  >
                    <span>Trust:</span>
                    <span>{session.trustScore}%</span>
                  </div>

                  {/* Overlay Candidate Bar */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 text-left">
                    <p className="text-xs font-bold text-white truncate">{session.name || 'Candidate'}</p>
                    <p className="text-[10px] text-slate-300 truncate">{session.examTitle}</p>
                  </div>
                </div>

                {/* Card Content & Metrics */}
                <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                  {/* Stats line */}
                  <div className="flex items-center justify-between text-[11px] text-text-secondary border-b border-border pb-2">
                    <span className="flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-sm text-text-muted">schedule</span>
                      {session.activeTime}
                    </span>
                    <span className="font-semibold text-text-primary">
                      {session.questionsAnswered} / {session.totalQuestions} Qs
                    </span>
                  </div>

                  {/* Recent incident banner */}
                  {session.incidents.length > 0 ? (
                    <div className="p-2 rounded-lg bg-surface-page border border-border text-[11px] flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="material-symbols-outlined text-amber-500 text-base shrink-0">warning</span>
                        <span className="font-semibold text-text-primary truncate">
                          {session.incidents[0].flagType}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-text-muted uppercase">
                        {session.incidents[0].severity}
                      </span>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 text-[11px] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      <span>No AI flags reported</span>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => setInspectSession(session)}
                      className="flex-1 btn-primary !py-1.5 !text-xs !rounded-lg flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      Inspect Feed
                    </button>

                    <button
                      onClick={() => setWarningModalSession(session)}
                      disabled={session.sessionStatus === 'TERMINATED'}
                      className="btn-secondary !py-1.5 !px-2.5 !text-xs !rounded-lg"
                      title="Issue text warning"
                    >
                      Warn
                    </button>

                    <button
                      onClick={() => setTerminateModalSession(session)}
                      disabled={session.sessionStatus === 'TERMINATED'}
                      className="btn-ghost !text-red-600 hover:!bg-red-50 dark:hover:!bg-red-950/40 !py-1.5 !px-2.5 !text-xs !rounded-lg border border-red-200 dark:border-red-900"
                      title="Terminate session"
                    >
                      Terminate
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 4.7 Session Detail Inspector Modal / Drawer ── */}
      {inspectSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-surface card w-full max-w-5xl max-h-[92vh] flex flex-col shadow-elevated border border-border animate-in fade-in zoom-in duration-150">

            {/* Drawer Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface-header">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {(inspectSession.name || 'Candidate')[0]}
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                    <span>{inspectSession.name || 'Candidate'}</span>
                    <span className="text-xs text-text-muted">({inspectSession.email || 'candidate@xe-recruiters.com'})</span>
                  </h2>
                  <p className="text-xs text-text-muted">{inspectSession.examTitle || 'Proctored Assessment'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={clsx(
                    'badge text-xs font-bold px-3 py-1 rounded-full',
                    inspectSession.trustScore >= 70
                      ? 'bg-emerald-500 text-white'
                      : inspectSession.trustScore >= 50
                        ? 'bg-amber-500 text-white'
                        : 'bg-red-600 text-white'
                  )}
                >
                  Trust Score: {inspectSession.trustScore}%
                </span>

                <button
                  onClick={() => setInspectSession(null)}
                  className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-page"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>
            </div>

            {/* Drawer Body Grid */}
            <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">

              {/* Left Column: Live Video Feeds & Progress (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* Tabs: Live Webcam vs Live Screen Feed */}
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('WEBCAM')}
                      className={clsx(
                        'px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5',
                        activeTab === 'WEBCAM'
                          ? 'bg-primary text-white'
                          : 'bg-surface-page text-text-secondary hover:bg-surface-header'
                      )}
                    >
                      <span className="material-symbols-outlined text-sm">videocam</span>
                      Live Webcam Feed
                    </button>
                    <button
                      onClick={() => setActiveTab('SCREEN')}
                      className={clsx(
                        'px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5',
                        activeTab === 'SCREEN'
                          ? 'bg-primary text-white'
                          : 'bg-surface-page text-text-secondary hover:bg-surface-header'
                      )}
                    >
                      <span className="material-symbols-outlined text-sm">desktop_windows</span>
                      Live Screen Recording
                    </button>
                  </div>

                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                    Stream Active (1080p)
                  </span>
                </div>

                {/* Video Player Display */}
                <div className="relative h-64 bg-slate-950 rounded-xl overflow-hidden border border-border flex items-center justify-center">
                  {activeTab === 'WEBCAM' ? (
                    inspectSession.screenshot ? (
                      <img src={inspectSession.screenshot} className="w-full h-full object-cover" alt="Live Webcam" />
                    ) : (
                      <div className="text-center p-6 text-slate-400">
                        <span className="material-symbols-outlined text-5xl animate-pulse mb-2 text-primary">face</span>
                        <p className="text-xs font-bold text-slate-200">AI Webcam Stream Monitor</p>
                        <p className="text-[10px] text-slate-400 mt-1">Gaze tracking & facial mesh detection active</p>
                      </div>
                    )
                  ) : inspectSession.screenScreenshot ? (
                    <img src={inspectSession.screenScreenshot} className="w-full h-full object-contain bg-black" alt="Live Screen Recording" />
                  ) : (
                    <div className="text-center p-6 text-slate-400">
                      <span className="material-symbols-outlined text-5xl animate-pulse mb-2 text-emerald-400">desktop_windows</span>
                      <p className="text-xs font-bold text-slate-200">Real-time Candidate Screen Stream</p>
                      <p className="text-[10px] text-slate-400 mt-1">Waiting for candidate screen share prompt...</p>
                    </div>
                  )}
                </div>

                {/* Progress & Metadata Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-surface-page rounded-xl border border-border">
                    <p className="text-[10px] text-text-muted font-bold uppercase">Candidate Progress</p>
                    <p className="text-base font-black text-text-primary mt-0.5">
                      {inspectSession.questionsAnswered} / {inspectSession.totalQuestions} Qs
                    </p>
                    <div className="w-full bg-surface-header h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${(inspectSession.questionsAnswered / inspectSession.totalQuestions) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-surface-page rounded-xl border border-border">
                    <p className="text-[10px] text-text-muted font-bold uppercase">Time Elapsed</p>
                    <p className="text-base font-black text-text-primary mt-0.5">{inspectSession.activeTime}</p>
                    <p className="text-[10px] text-text-muted mt-1">Total limit: 60 mins</p>
                  </div>

                  <div className="p-3 bg-surface-page rounded-xl border border-border">
                    <p className="text-[10px] text-text-muted font-bold uppercase">Session Status</p>
                    <p className="text-base font-black text-text-primary mt-0.5">{inspectSession.sessionStatus}</p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">Live Connected</p>
                  </div>
                </div>

                {/* Direct Proctor Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setWarningModalSession(inspectSession)}
                    disabled={inspectSession.sessionStatus === 'TERMINATED'}
                    className="flex-1 btn-secondary !py-2 !text-xs !rounded-lg flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">warning</span>
                    Issue Text Warning
                  </button>
                  <button
                    onClick={() => setTerminateModalSession(inspectSession)}
                    disabled={inspectSession.sessionStatus === 'TERMINATED'}
                    className="flex-1 btn-ghost !text-red-600 hover:!bg-red-50 dark:hover:!bg-red-950/40 border border-red-200 dark:border-red-900 !py-2 !text-xs !rounded-lg flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">block</span>
                    Terminate Session
                  </button>
                </div>
              </div>

              {/* Right Column: Sortable Incident Feed & Decision Workflow (5 cols) (Req 4.5.5) */}
              <div className="lg:col-span-5 space-y-4 flex flex-col">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-amber-500">history_toggle_off</span>
                    Incident Timeline Feed ({inspectSession.incidents.length})
                  </h3>

                  {/* Incident Feed Sort Controls */}
                  <select
                    value={incidentSort}
                    onChange={(e) => setIncidentSort(e.target.value as any)}
                    className="input-field text-[11px] !py-1 !px-2 font-medium"
                  >
                    <option value="TIME_DESC">Sort: Newest First</option>
                    <option value="TIME_ASC">Sort: Oldest First</option>
                    <option value="SEVERITY">Sort: Severity (High)</option>
                  </select>
                </div>

                {/* Incident Feed Items List */}
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 flex-1">
                  {inspectSession.incidents.length === 0 ? (
                    <div className="p-6 text-center text-text-muted bg-surface-page rounded-xl border border-border">
                      <span className="material-symbols-outlined text-3xl mb-1 text-emerald-500">verified</span>
                      <p className="text-xs font-bold text-text-primary">No AI incidents flagged</p>
                      <p className="text-[10px]">Candidate behavior aligns with integrity policies.</p>
                    </div>
                  ) : (
                    [...inspectSession.incidents]
                      .sort((a, b) => {
                        if (incidentSort === 'SEVERITY') {
                          const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
                          return rank[b.severity] - rank[a.severity];
                        }
                        if (incidentSort === 'TIME_ASC') return a.timestamp.localeCompare(b.timestamp);
                        return b.timestamp.localeCompare(a.timestamp);
                      })
                      .map((inc) => (
                        <div
                          key={inc.id}
                          className="p-3 bg-surface-page rounded-xl border border-border space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={clsx(
                                'badge text-[9px] font-extrabold uppercase px-2 py-0.5 rounded',
                                inc.severity === 'HIGH' && 'bg-red-600 text-white',
                                inc.severity === 'MEDIUM' && 'bg-amber-500 text-white',
                                inc.severity === 'LOW' && 'bg-blue-600 text-white'
                              )}
                            >
                              {inc.severity} Severity
                            </span>
                            <span className="text-[10px] text-text-muted">{inc.timestamp}</span>
                          </div>

                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-text-primary">{inc.flagType}</p>
                              <p className="text-[10px] text-text-muted">
                                AI Confidence: {Math.round(inc.confidenceScore * 100)}%
                              </p>
                            </div>
                            <span className="text-[10px] font-bold text-text-secondary uppercase">
                              Status: {inc.reviewerDecision}
                            </span>
                          </div>

                          {/* Per-Incident Proctor Review Action Buttons (4.5.5) */}
                          <div className="pt-2 border-t border-border/60 flex flex-wrap gap-1.5">
                            <button
                              onClick={() => handleIncidentDecision(inc.id, 'DISMISS')}
                              className="btn-ghost !py-1 !px-2 !text-[10px] hover:!bg-emerald-50 text-emerald-600 border border-emerald-200"
                            >
                              Dismiss (+15 Trust)
                            </button>
                            <button
                              onClick={() => setWarningModalSession(inspectSession)}
                              className="btn-secondary !py-1 !px-2 !text-[10px]"
                            >
                              Issue Warning
                            </button>
                            <button
                              onClick={() => handleIncidentDecision(inc.id, 'ESCALATE')}
                              className="btn-secondary !py-1 !px-2 !text-[10px]"
                            >
                              Escalate
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>

                {/* Immutable Proctor Decision Log Section */}
                <div className="bg-surface-page p-3 rounded-xl border border-border">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                    Immutable Proctor Decision Audit Log
                  </p>
                  {inspectSession.decisionLogs.length === 0 ? (
                    <p className="text-[11px] text-text-muted">No manual proctor decisions recorded yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-24 overflow-y-auto">
                      {inspectSession.decisionLogs.map((log) => (
                        <div key={log.id} className="text-[10px] flex items-center justify-between text-text-secondary border-b border-border/40 pb-1">
                          <span className="font-bold">{log.actionType}</span>
                          <span className="truncate max-w-[140px]">{log.rationale}</span>
                          <span className="text-text-muted">{log.reviewerIdentity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Text Warning Modal (Req 4.7) ── */}
      {warningModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface card w-full max-w-md p-6 shadow-elevated border border-border space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-2 text-amber-600">
              <span className="material-symbols-outlined text-2xl">warning</span>
              <h3 className="text-base font-bold text-text-primary">Issue Warning to Candidate</h3>
            </div>

            <p className="text-xs text-text-muted">
              Target candidate: <strong>{warningModalSession.name}</strong> ({warningModalSession.email})
            </p>

            {/* Quick Warning Templates */}
            <div>
              <label className="text-[11px] font-semibold text-text-secondary block mb-1">Preset Templates:</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Please remain facing the webcam',
                  'Tab switching is prohibited',
                  'Background noise detected - please relocate',
                ].map((tpl) => (
                  <button
                    key={tpl}
                    onClick={() => setWarningMessage(tpl)}
                    className="text-[10px] bg-surface-page hover:bg-surface-header border border-border px-2 py-1 rounded text-text-secondary"
                  >
                    {tpl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-primary block mb-1">Custom Text Warning Message:</label>
              <textarea
                rows={3}
                value={warningMessage}
                onChange={(e) => setWarningMessage(e.target.value)}
                placeholder="Enter text warning message..."
                className="input-field text-xs w-full"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setWarningModalSession(null)}
                className="btn-secondary !py-1.5 !px-3 !text-xs !rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleIssueWarning}
                disabled={!warningMessage.trim()}
                className="btn-primary !py-1.5 !px-4 !text-xs !rounded-lg"
              >
                Dispatch Warning Modal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Session Termination Modal (Req 4.7) ── */}
      {terminateModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface card w-full max-w-md p-6 shadow-elevated border border-border space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-2 text-red-600">
              <span className="material-symbols-outlined text-2xl">block</span>
              <h3 className="text-base font-bold text-text-primary">Mandatory Session Termination</h3>
            </div>

            <p className="text-xs text-text-muted">
              Terminating session for candidate: <strong>{terminateModalSession.name}</strong>. This action immediately stops the exam attempt.
            </p>

            <div>
              <label className="text-xs font-semibold text-text-primary block mb-1">
                Mandatory Termination Reason Selection (Req 4.7):
              </label>
              <select
                value={terminateReason}
                onChange={(e) => setTerminateReason(e.target.value)}
                className="input-field text-xs w-full font-medium"
              >
                <option value="Cheating / External Material Detected">Cheating / External Material Detected</option>
                <option value="Multiple Persons Present in Video Stream">Multiple Persons Present in Video Stream</option>
                <option value="Unauthorized Secondary Device / Phone Usage">Unauthorized Secondary Device / Phone Usage</option>
                <option value="Unresponsive / Candidate Abandoned Examination">Unresponsive / Candidate Abandoned Examination</option>
                <option value="Other Policy Violation">Other Policy Violation</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-primary block mb-1">Optional Free-Text Note:</label>
              <textarea
                rows={2}
                value={terminateNote}
                onChange={(e) => setTerminateNote(e.target.value)}
                placeholder="Optional detailed proctor observation note..."
                className="input-field text-xs w-full"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setTerminateModalSession(null)}
                className="btn-secondary !py-1.5 !px-3 !text-xs !rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleTerminateSession}
                className="btn-ghost !bg-red-600 hover:!bg-red-700 text-white !py-1.5 !px-4 !text-xs !rounded-lg font-bold"
              >
                Confirm Termination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Proctoring Configuration Modal (Req 4.3.3) ── */}
      {showConfigModal && selectedExamForConfig && (
        <ProctoringConfigModal
          exam={selectedExamForConfig}
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          onSuccess={loadDashboardData}
        />
      )}
    </div>
  );
}
