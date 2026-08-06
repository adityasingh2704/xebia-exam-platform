'use client';

import { useState, useEffect } from 'react';
import { examApi, questionApi, userApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/components/ui/Toast';
import { CardGridSkeleton } from '@/components/ui/LoadingSkeleton';
import { clsx } from 'clsx';

export default function SubmissionsPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Grading Modal States
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [detailedExam, setDetailedExam] = useState<any | null>(null);
  const [questionsMap, setQuestionsMap] = useState<Record<string, any>>({});
  const [parsedAnswers, setParsedAnswers] = useState<Record<string, string>>({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [teacherScore, setTeacherScore] = useState<number>(0);
  const [isSavingGrade, setIsSavingGrade] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'submissions' | 'cohort_analytics'>('submissions');
  const [selectedCohortExamId, setSelectedCohortExamId] = useState<string>('');

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!user?.tenantId) return;
      setIsLoading(true);
      try {
        // 1. Fetch all assignments
        const assignmentsRes = await examApi.listAssignments({
          tenantId: user.tenantId,
        });
        const allAss = assignmentsRes.data.data || assignmentsRes.data;
        if (Array.isArray(allAss)) {
          // Show submitted and graded assignments
          const submissions = allAss.filter(a => a.status === 'SUBMITTED' || a.status === 'GRADED' || a.sessionStatus === 'TERMINATED' || !!a.terminationReason);
          setAssignments(submissions);
        }

        // 2. Fetch all users to map candidate IDs to names/emails
        const usersRes = await userApi.list({ limit: 1000 });
        const uData = usersRes.data;
        let usersData: any[] = [];
        if (Array.isArray(uData)) usersData = uData;
        else if (Array.isArray(uData?.data?.data)) usersData = uData.data.data;
        else if (Array.isArray(uData?.data?.items)) usersData = uData.data.items;
        else if (Array.isArray(uData?.data?.users)) usersData = uData.data.users;
        else if (Array.isArray(uData?.data)) usersData = uData.data;
        else if (Array.isArray(uData?.items)) usersData = uData.items;

        const uMap: Record<string, any> = {};
        if (Array.isArray(usersData)) {
          usersData.forEach((u: any) => {
            if (u.id) uMap[u.id] = u;
            if (u._id) uMap[String(u._id)] = u;
            if (u.email) uMap[u.email] = u;
          });
        }
        setUsersMap(uMap);
      } catch (err) {
        addToast('Failed to load candidate submissions', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSubmissions();
  }, [user]);

  const handleOpenEvaluation = async (assignment: any) => {
    setSelectedAssignment(assignment);
    setIsLoadingDetails(true);
    setQuestionsMap({});
    setDetailedExam(null);
    setTeacherScore(assignment.score || 0);

    try {
      // Parse answers JSON
      let answers: Record<string, string> = {};
      try {
        if (assignment.answers) {
          answers = JSON.parse(assignment.answers);
        }
      } catch {
        console.error('Failed to parse candidate answers JSON string.');
      }
      setParsedAnswers(answers);

      // Fetch exam details to get sections and question IDs
      const examRes = await examApi.getById(assignment.examId);
      const examData = examRes.data.data || examRes.data;
      setDetailedExam(examData);

      // Fetch details of each question
      const questionIds: string[] = (examData.sections || [])
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

        // Auto-calculate MCQ score to help the teacher
        let calculatedScore = 0;
        const negMarking = examData?.negativeMarking;
        const negMarkVal = examData?.negativeMarkValue || 0;

        questionIds.forEach((qId) => {
          const q = qMap[qId];
          const studentAns = answers[qId];
          if (q && q.type === 'MCQ') {
            const correctOpt = q.options?.find((o: any) => o.isCorrect);
            if (correctOpt) {
              if (studentAns) {
                if (studentAns === correctOpt.text) {
                  calculatedScore += (q.points || 10);
                } else {
                  if (negMarking) {
                    calculatedScore -= negMarkVal;
                  }
                }
              }
            }
          }
        });
        calculatedScore = Math.max(0, calculatedScore);
        // If not graded yet, suggest the auto-calculated score
        if (assignment.status === 'SUBMITTED') {
          setTeacherScore(calculatedScore);
        }
      }
    } catch (err) {
      addToast('Failed to load submission components', 'error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleAnnounceResult = async () => {
    if (!selectedAssignment) return;
    setIsSavingGrade(true);
    try {
      await examApi.gradeAttempt(selectedAssignment.id, teacherScore, 'GRADED');
      addToast('Result announced and grade released successfully!', 'success');
      setSelectedAssignment(null);
      // Refresh list
      const assignmentsRes = await examApi.listAssignments({
        tenantId: user?.tenantId,
      });
      const allAss = assignmentsRes.data.data || assignmentsRes.data;
      if (Array.isArray(allAss)) {
        setAssignments(allAss.filter(a => a.status === 'SUBMITTED' || a.status === 'GRADED' || a.sessionStatus === 'TERMINATED' || !!a.terminationReason));
      }
    } catch (err) {
      addToast('Failed to release score result', 'error');
    } finally {
      setIsSavingGrade(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    } catch { return dateStr; }
  };

  const getCandidateInfo = (ass: any) => {
    if (ass?.candidateName) return ass.candidateName;
    const cId = typeof ass === 'string' ? ass : ass?.candidateId;
    const candidate = usersMap[cId];
    if (candidate) {
      const fullName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
      return fullName || candidate.email || 'Candidate User';
    }
    if (ass?.candidateEmail) return ass.candidateEmail;
    return 'John Doe';
  };

  // ── Cohort Analytics Calculations ──────────────────
  const examsWithSubmissions = Array.from(
    new Map(
      assignments
        .filter((a) => a.exam)
        .map((a) => [a.exam.id, a.exam])
    ).values()
  );

  // Initialize selected exam ID if empty and exams exist
  if (selectedCohortExamId === '' && examsWithSubmissions.length > 0) {
    setSelectedCohortExamId(examsWithSubmissions[0].id);
  }

  const selectedExamDetails = examsWithSubmissions.find(e => e.id === selectedCohortExamId);
  const cohortAssignments = assignments.filter(a => a.examId === selectedCohortExamId);
  const totalSubmissionsCount = cohortAssignments.length;
  
  const gradedCohort = cohortAssignments.filter(a => a.status === 'GRADED' && typeof a.score === 'number');
  const gradedCount = gradedCohort.length;

  let averageScore = 0;
  let medianScore = 0;
  let highestScore = 0;
  let lowestScore = 0;
  let passedCount = 0;
  let passRate = 0;

  if (gradedCount > 0 && selectedExamDetails) {
    const scores = gradedCohort.map(a => a.score).sort((a, b) => a - b);
    averageScore = gradedCohort.reduce((sum, a) => sum + a.score, 0) / gradedCount;
    
    // Median calculation
    const mid = Math.floor(gradedCount / 2);
    medianScore = gradedCount % 2 !== 0 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;
    
    highestScore = scores[scores.length - 1];
    lowestScore = scores[0];

    // Pass rate threshold percent
    const passingPct = selectedExamDetails.passingScore;
    gradedCohort.forEach(a => {
      const totalM = a.totalMarks || selectedExamDetails.totalMarks || 100;
      const pct = (a.score / totalM) * 100;
      if (pct >= passingPct) {
        passedCount++;
      }
    });
    passRate = (passedCount / gradedCount) * 100;
  }

  const getPercentile = (pct: number) => {
    if (gradedCount === 0) return 0;
    const scores = gradedCohort.map(a => a.score).sort((a, b) => a - b);
    const idx = Math.ceil((pct / 100) * scores.length) - 1;
    return scores[Math.max(0, idx)];
  };

  const histogramBins = [
    { label: '0-20%', count: 0 },
    { label: '21-40%', count: 0 },
    { label: '41-60%', count: 0 },
    { label: '61-80%', count: 0 },
    { label: '81-100%', count: 0 },
  ];

  if (gradedCount > 0 && selectedExamDetails) {
    gradedCohort.forEach(a => {
      const totalM = a.totalMarks || selectedExamDetails.totalMarks || 100;
      const pct = (a.score / totalM) * 100;
      if (pct <= 20) histogramBins[0].count++;
      else if (pct <= 40) histogramBins[1].count++;
      else if (pct <= 60) histogramBins[2].count++;
      else if (pct <= 80) histogramBins[3].count++;
      else histogramBins[4].count++;
    });
  }

  const maxBinCount = Math.max(...histogramBins.map(b => b.count), 1);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-headline-xl font-bold text-text-primary">Review Submissions</h1>
        <p className="text-body-sm text-text-muted mt-1">Review candidate answers, calculate proctoring trust scores, and release final evaluation marks.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => setActiveSubTab('submissions')}
          className={clsx(activeSubTab === 'submissions' ? 'tab-active' : 'tab')}
        >
          Submissions List
        </button>
        <button
          onClick={() => setActiveSubTab('cohort_analytics')}
          className={clsx(activeSubTab === 'cohort_analytics' ? 'tab-active' : 'tab')}
        >
          Cohort Performance Insights
        </button>
      </div>

      {/* Submissions List Tab Content */}
      {activeSubTab === 'submissions' && (
        <div className="card animate-slide-up">
          <h3 className="text-headline-lg font-semibold text-text-primary mb-5">Pending & Graded Attempts</h3>

          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-10 bg-white/5 rounded"></div>
              <div className="h-10 bg-white/5 rounded"></div>
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-5xl text-text-muted mb-3">grading</span>
              <p className="text-sm text-text-muted">No completed exam submissions found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="table-cell text-left font-medium">Candidate</th>
                    <th className="table-cell text-left font-medium">Exam Name</th>
                    <th className="table-cell text-left font-medium">Status</th>
                    <th className="table-cell text-left font-medium">Integrity (AI)</th>
                    <th className="table-cell text-left font-medium">Date Submitted</th>
                    <th className="table-cell text-right font-medium">Score</th>
                    <th className="table-cell text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((ass) => (
                    <tr key={ass.id} className="table-row">
                      <td className="table-cell font-medium text-text-primary">
                        {getCandidateInfo(ass)}
                      </td>
                      <td className="table-cell text-text-secondary">
                        {ass.exam?.title || 'Unknown Exam'}
                      </td>
                      <td className="table-cell">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={clsx(
                            "badge text-xs",
                            ass.sessionStatus === 'TERMINATED' || ass.terminationReason 
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : ass.status === 'GRADED' ? "badge-success" : "badge-warning animate-pulse"
                          )}>
                            {ass.sessionStatus === 'TERMINATED' || ass.terminationReason 
                              ? 'Disqualified' 
                              : ass.status === 'GRADED' ? 'Announced' : 'Under Review'}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell text-left">
                        {ass.sessionStatus === 'TERMINATED' || ass.terminationReason ? (
                          <span className="badge text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1 animate-pulse">
                            <span className="material-symbols-outlined text-xs">block</span>
                            Terminated by Proctor
                          </span>
                        ) : ass.exam?.enableProctoring ? (
                          <span className={clsx(
                            "badge text-xs font-bold font-mono",
                            ass.trustScore >= 80 
                              ? "bg-emerald/10 text-emerald border border-emerald/20" 
                              : ass.trustScore >= 50
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                                : "bg-red-500/10 text-red-400 border border-red-500/25 animate-pulse"
                          )}>
                            {ass.trustScore}% Trust {ass.trustScore < 50 ? '⚠️ Suspicious' : '✅ Clear'}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs font-medium">No Proctoring</span>
                        )}
                      </td>
                      <td className="table-cell text-text-muted text-sm">
                        {formatDate(ass.submittedAt)}
                      </td>
                      <td className="table-cell text-right font-bold text-text-primary">
                        {ass.status === 'GRADED' ? (
                          <span>{ass.score} / {ass.totalMarks || 100}</span>
                        ) : (
                          <span className="text-text-muted text-xs font-normal">Pending Grade</span>
                        )}
                      </td>
                      <td className="table-cell text-right flex items-center justify-end gap-2">
                        {ass.status === 'GRADED' && (
                          <button
                            onClick={async () => {
                              const candidateUser = usersMap[ass.candidateId];
                              const candidateName = candidateUser ? `${candidateUser.firstName} ${candidateUser.lastName}` : 'Candidate';
                              try {
                                await examApi.issueCertificate(ass.id, candidateName, 'Xebia Global Academy');
                                addToast('Certificate issued successfully!', 'success');
                              } catch (err) {
                                addToast('Failed to issue certificate', 'error');
                              }
                            }}
                            className="btn-secondary !py-1 !px-2.5 rounded-lg text-xs flex items-center gap-1 border border-white/10 hover:bg-white/5 transition-colors text-text-primary"
                          >
                            <span className="material-symbols-outlined text-xs text-emerald">workspace_premium</span>
                            Issue Cert
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEvaluation(ass)}
                          className="btn-primary py-1 px-3 rounded-lg text-xs"
                        >
                          {ass.status === 'GRADED' ? 'View Grade' : 'Grade Response'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cohort Analytics Tab Content */}
      {activeSubTab === 'cohort_analytics' && (
        <div className="space-y-6 animate-slide-up">
          {/* Exam Selector */}
          <div className="card flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-headline-lg font-semibold text-text-primary">Cohort Analytics Console</h3>
              <p className="text-caption-xs text-text-muted mt-0.5 font-medium">Select an exam to view cohort statistics and distribution metrics.</p>
            </div>
            <div>
              <select
                value={selectedCohortExamId}
                onChange={(e) => setSelectedCohortExamId(e.target.value)}
                className="input !w-auto pr-8 font-semibold text-text-primary bg-surface-container"
              >
                {examsWithSubmissions.map((exam) => (
                  <option key={exam.id} value={exam.id} className="bg-surface-card text-text-primary">{exam.title}</option>
                ))}
              </select>
            </div>
          </div>

          {examsWithSubmissions.length === 0 ? (
            <div className="card text-center py-16">
              <span className="material-symbols-outlined text-5xl text-text-muted mb-3">analytics</span>
              <p className="text-sm text-text-muted">No exams with candidate submissions found in this tenant.</p>
            </div>
          ) : gradedCount === 0 ? (
            <div className="card text-center py-16 space-y-3">
              <span className="material-symbols-outlined text-5xl text-warning">pending_actions</span>
              <h4 className="text-base font-semibold text-text-primary">No Graded Submissions Yet</h4>
              <p className="text-sm text-text-muted max-w-md mx-auto">
                There are {totalSubmissionsCount} submission(s) pending evaluation for this exam. Please grade the responses and release the results to compile cohort analytics.
              </p>
            </div>
          ) : (
            <>
              {/* KPI Cards Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card bg-gradient-to-br from-primary/10 via-transparent to-transparent border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-caption-xs font-semibold text-text-muted uppercase tracking-wider">Cohort Average</span>
                    <span className="material-symbols-outlined text-primary text-base">functions</span>
                  </div>
                  <p className="text-3xl font-extrabold text-primary font-mono">{averageScore.toFixed(1)}</p>
                  <p className="text-caption-xs text-text-muted mt-1 font-medium">out of {selectedExamDetails?.totalMarks || 100} marks ({(averageScore / (selectedExamDetails?.totalMarks || 100) * 100).toFixed(1)}%)</p>
                </div>

                <div className="card bg-gradient-to-br from-emerald/10 via-transparent to-transparent border border-emerald/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-caption-xs font-semibold text-text-muted uppercase tracking-wider">Median Score</span>
                    <span className="material-symbols-outlined text-emerald text-base">leaderboard</span>
                  </div>
                  <p className="text-3xl font-extrabold text-emerald font-mono">{medianScore.toFixed(1)}</p>
                  <p className="text-caption-xs text-text-muted mt-1 font-medium">50th percentile mark</p>
                </div>

                <div className="card bg-gradient-to-br from-cta/10 via-transparent to-transparent border border-cta/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-caption-xs font-semibold text-text-muted uppercase tracking-wider">Cohort Pass Rate</span>
                    <span className="material-symbols-outlined text-cta text-base">verified</span>
                  </div>
                  <p className="text-3xl font-extrabold text-cta font-mono">{passRate.toFixed(1)}%</p>
                  <p className="text-caption-xs text-text-muted mt-1 font-medium">{passedCount} of {gradedCount} passed (Threshold: {selectedExamDetails?.passingScore}%)</p>
                </div>

                <div className="card bg-gradient-to-br from-amber-500/10 via-transparent to-transparent border border-amber-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-caption-xs font-semibold text-text-muted uppercase tracking-wider">High / Low Score</span>
                    <span className="material-symbols-outlined text-amber-400 text-base">swap_vert</span>
                  </div>
                  <p className="text-2xl font-extrabold text-text-primary font-mono">
                    <span className="text-emerald">{highestScore}</span>
                    <span className="text-text-muted text-sm mx-1">/</span>
                    <span className="text-red-400">{lowestScore}</span>
                  </p>
                  <p className="text-caption-xs text-text-muted mt-2 font-medium">Highest vs lowest grades</p>
                </div>
              </div>

              {/* Score Distribution Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Score Histogram */}
                <div className="lg:col-span-2 card space-y-6">
                  <div>
                    <h4 className="text-base font-bold text-text-primary">Score Distribution Histogram</h4>
                    <p className="text-xs text-text-muted mt-0.5 font-medium">Distribution of candidate percentage scores across five bands.</p>
                  </div>
                  <div className="h-60 flex items-end gap-4 border-b border-white/5 pb-4 px-2">
                    {histogramBins.map((bin) => {
                      const heightPercent = (bin.count / maxBinCount) * 100;
                      return (
                        <div key={bin.label} className="flex-1 flex flex-col items-center gap-2 group relative">
                          {/* Value Tooltip */}
                          <span className="absolute -top-7 text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-mono duration-200 pointer-events-none">
                            {bin.count} {bin.count === 1 ? 'candidate' : 'candidates'}
                          </span>
                          {/* Bar */}
                          <div className="w-full bg-white/5 rounded-t-lg overflow-hidden h-full flex items-end">
                            <div
                              className="w-full rounded-t bg-gradient-to-t from-primary to-primary-bright transition-all duration-500 group-hover:opacity-90"
                              style={{ height: `${heightPercent || 2}%` }}
                            />
                          </div>
                          <span className="text-caption-xs text-text-muted font-semibold">{bin.label}</span>
                          <span className="text-[10px] font-bold text-text-primary font-mono">{bin.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pass Fail & Percentile bands */}
                <div className="flex flex-col gap-6">
                  {/* Pass Fail card */}
                  <div className="card space-y-4 flex-1">
                    <h4 className="text-base font-bold text-text-primary">Pass/Fail Distribution</h4>
                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald font-semibold flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald"></span>
                          Passed ({passedCount})
                        </span>
                        <span className="text-text-primary font-bold font-mono">{passRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-400 font-semibold flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                          Failed ({gradedCount - passedCount})
                        </span>
                        <span className="text-text-primary font-bold font-mono">{(100 - passRate).toFixed(1)}%</span>
                      </div>
                      
                      <div className="pt-2">
                        <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex">
                          <div className="bg-emerald h-full" style={{ width: `${passRate}%` }}></div>
                          <div className="bg-red-400 h-full" style={{ width: `${100 - passRate}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Percentile Bands card */}
                  <div className="card space-y-4 flex-1">
                    <h4 className="text-base font-bold text-text-primary">Cohort Percentile Bands</h4>
                    <div className="space-y-2.5 font-mono">
                      {[
                        { label: '90th Percentile (Excellent)', pct: 90, color: 'text-primary' },
                        { label: '75th Percentile (Above Avg)', pct: 75, color: 'text-emerald' },
                        { label: '50th Percentile (Median)', pct: 50, color: 'text-cta' },
                        { label: '25th Percentile (Below Avg)', pct: 25, color: 'text-text-muted' },
                      ].map((band) => {
                        const score = getPercentile(band.pct);
                        return (
                          <div key={band.pct} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
                            <span className="text-text-secondary">{band.label}</span>
                            <span className={clsx("font-bold text-sm", band.color)}>
                              {score.toFixed(1)} <span className="text-[10px] font-normal text-text-muted">marks</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── GRADING / EVALUATION MODAL ────────────────────── */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto relative animate-scale-in flex flex-col p-0">
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-primary tracking-wide uppercase">Evaluation Console</span>
                <h3 className="text-headline-lg font-bold text-text-primary mt-0.5">
                  {selectedAssignment.exam?.title || 'Exam Evaluation'}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Candidate: {getCandidateInfo(selectedAssignment.candidateId)}
                </p>
              </div>
              <button
                onClick={() => setSelectedAssignment(null)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {isLoadingDetails ? (
                <div className="py-12 text-center text-sm text-text-muted flex flex-col items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                  Loading attempt answers & components...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Proctor Termination Alert Header */}
                  {(selectedAssignment.sessionStatus === 'TERMINATED' || selectedAssignment.terminationReason) && (
                    <div className="p-4 border border-red-500/30 rounded-xl bg-red-500/10 text-red-400 flex items-start gap-3 animate-pulse">
                      <span className="material-symbols-outlined text-2xl text-red-500 shrink-0 mt-0.5">block</span>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <h5 className="text-sm font-bold text-red-400">EXAM TERMINATED BY PROCTOR (DISQUALIFIED)</h5>
                          <span className="text-xs font-mono font-bold bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/30">
                            DISQUALIFIED
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          This candidate's exam session was terminated by a proctor due to an integrity rule violation. As the teacher, you have full authority to inspect their partial answers below and assign their final evaluation score (e.g. 0 marks, partial credit, or standard score).
                        </p>
                        {selectedAssignment.terminationReason && (
                          <div className="mt-2 text-xs bg-black/40 p-2.5 rounded border border-red-500/20 font-mono text-slate-200">
                            <span className="font-bold text-red-400">Termination Reason:</span> {selectedAssignment.terminationReason}
                            {selectedAssignment.terminationNote && (
                              <span className="block mt-1 text-slate-400"><span className="font-bold">Proctor Note:</span> {selectedAssignment.terminationNote}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Proctoring Integrity Details */}
                  {selectedAssignment.exam?.enableProctoring && (
                    <div className={clsx(
                      "p-4 border rounded-xl flex items-start gap-3",
                      selectedAssignment.trustScore >= 80 
                        ? "border-emerald/20 bg-emerald/5 text-emerald"
                        : selectedAssignment.trustScore >= 50
                          ? "border-amber-500/20 bg-amber-500/5 text-amber-400"
                          : "border-red-500/20 bg-red-500/5 text-red-400 animate-pulse"
                    )}>
                      <span className="material-symbols-outlined mt-0.5">
                        {selectedAssignment.trustScore >= 80 ? 'verified_user' : 'warning_amber'}
                      </span>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <h5 className="text-sm font-semibold">AI Proctoring Integrity Report</h5>
                          <span className="font-mono font-bold text-sm bg-white/10 px-2 py-0.5 rounded">
                            Trust Score: {selectedAssignment.trustScore}%
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-1 leading-relaxed">
                          {selectedAssignment.trustScore >= 80 
                            ? "Excellent exam integrity. No significant suspicious behavior detected."
                            : selectedAssignment.trustScore >= 50
                              ? "Warning: AI proctoring flagged suspicious behaviors (e.g. tab switches, mobile phone, or gaze away). Please review carefully."
                              : "CRITICAL: HIGH PROBABILITY OF CHEATING DETECTED. System terminated or flagged this attempt due to multiple security violations."}
                        </p>
                      </div>
                    </div>
                  )}

                  {detailedExam?.negativeMarking && (
                    <div className="p-4 border border-red-500/20 rounded-xl bg-red-500/5 flex items-start gap-3">
                      <span className="material-symbols-outlined text-red-400 mt-0.5">warning</span>
                      <div>
                        <h5 className="text-sm font-semibold text-red-400">Negative Marking Enabled</h5>
                        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                          Incorrect MCQ responses will penalize the candidate by <strong>-{detailedExam.negativeMarkValue} pt</strong>. Skipped questions are not penalized.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* List each question and answer */}
                  <div className="space-y-5">
                    <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider">Candidate Answers</h4>

                    {Object.keys(questionsMap).length === 0 ? (
                      <p className="text-sm text-text-muted">No answers found or compiled.</p>
                    ) : (
                      Object.keys(questionsMap).map((qId, idx) => {
                        const q = questionsMap[qId];
                        const answer = parsedAnswers[qId];
                        const isMCQ = q.type === 'MCQ';
                        const correctOpt = q.options?.find((o: any) => o.isCorrect)?.text;
                        const isCorrect = isMCQ && answer === correctOpt;

                        return (
                          <div key={qId} className="p-4 border border-white/5 bg-white/5 rounded-xl space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <span className="text-xs font-bold text-primary">QUESTION {idx + 1} ({q.type})</span>
                                <h5 className="text-sm font-semibold text-text-primary mt-0.5">{q.title}</h5>
                              </div>
                              <span className="text-xs badge-primary">{q.points || 10} pts</span>
                            </div>

                            <p className="text-xs text-text-secondary whitespace-pre-wrap">{q.body}</p>

                            <div className="pt-2.5 border-t border-white/5">
                              <span className="text-[10px] font-bold text-text-muted block uppercase">Candidate Response:</span>
                              {answer ? (
                                <div className={clsx(
                                  "p-3 rounded-lg text-sm mt-1 font-medium flex items-center justify-between gap-4",
                                  isMCQ 
                                    ? isCorrect 
                                      ? "bg-emerald/10 text-emerald border border-emerald/20" 
                                      : "bg-danger-bg/50 text-danger border border-danger/20"
                                    : "bg-white/5 text-text-primary font-mono whitespace-pre-wrap"
                                )}>
                                  <span>{answer}</span>
                                  {isMCQ && (
                                    <span className={clsx(
                                      "text-xs px-2 py-0.5 rounded font-bold shrink-0",
                                      isCorrect
                                        ? "bg-emerald/20 text-emerald"
                                        : detailedExam?.negativeMarking
                                          ? "bg-red-500/25 text-red-400 border border-red-500/30"
                                          : "bg-white/10 text-text-muted"
                                    )}>
                                      {isCorrect 
                                        ? `+${q.points || 10} pts` 
                                        : detailedExam?.negativeMarking 
                                          ? `-${detailedExam.negativeMarkValue} pt penalty` 
                                          : '0 pts'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 text-xs italic text-text-muted mt-1">
                                  <span>No response provided.</span>
                                  {isMCQ && (
                                    <span className="text-xs px-2 py-0.5 rounded font-bold shrink-0 bg-white/10 text-text-muted">
                                      0 pts (Skipped)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {isMCQ && (
                              <div className="text-xs text-text-muted flex items-center gap-1.5 mt-1">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                Correct Choice Option: <span className="text-emerald font-semibold">{correctOpt || 'None configured'}</span>
                              </div>
                            )}

                            {q.type === 'PROGRAMMING' && q.solutionCode && (
                              <div className="pt-3 border-t border-white/5 bg-emerald/5 border border-emerald/10 p-3 rounded-lg">
                                <span className="text-[10px] font-bold text-emerald block uppercase">Model Reference Solution:</span>
                                <pre className="text-xs text-emerald font-mono whitespace-pre-wrap bg-black/40 p-2.5 rounded mt-1.5 max-h-[250px] overflow-y-auto">
                                  {q.solutionCode}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Grading Footer Panel */}
            <div className="p-6 border-t border-border bg-white/5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-bold text-text-primary">Final Evaluation Score:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={teacherScore}
                    onChange={(e) => setTeacherScore(parseFloat(e.target.value) || 0)}
                    min={0}
                    className="w-20 text-center font-bold font-mono text-sm py-1.5 rounded-lg border border-white/15 bg-white/5 text-text-primary"
                  />
                  <span className="text-sm text-text-muted">/ {selectedAssignment.totalMarks || 100} marks</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAssignment(null)}
                  className="btn-secondary text-xs py-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAnnounceResult}
                  disabled={isSavingGrade || isLoadingDetails}
                  className="btn-cta text-xs py-2 flex items-center gap-1"
                >
                  {isSavingGrade ? 'Releasing...' : 'Announce Result'}
                  <span className="material-symbols-outlined text-sm">campaign</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
