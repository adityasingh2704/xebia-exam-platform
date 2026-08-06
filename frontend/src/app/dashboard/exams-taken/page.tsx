'use client';

import { useState, useEffect } from 'react';
import { examApi, questionApi, certificateApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/components/ui/Toast';
import { CardGridSkeleton } from '@/components/ui/LoadingSkeleton';
import { clsx } from 'clsx';

export default function ExamsTakenPage() {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Review Modal States
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [questionsMap, setQuestionsMap] = useState<Record<string, any>>({});
  const [parsedAnswers, setParsedAnswers] = useState<Record<string, string>>({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    const fetchTakenExams = async () => {
      if (!user?.id || !user?.tenantId) return;
      try {
        const response = await examApi.listAssignments({
          candidateId: user.id,
          tenantId: user.tenantId,
        });
        const data = response.data.data || response.data;
        // Filter assignments that are either SUBMITTED or GRADED
        if (Array.isArray(data)) {
          const taken = data.filter(a => a.status === 'SUBMITTED' || a.status === 'GRADED');
          setAssignments(taken);
        }
      } catch (err) {
        addToast('Failed to load completed examinations', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTakenExams();
  }, [user]);

  const handleOpenReview = async (assignment: any) => {
    setSelectedAssignment(assignment);
    setIsLoadingDetails(true);
    setQuestionsMap({});

    try {
      let answers: Record<string, string> = {};
      try {
        if (assignment.answers) {
          answers = JSON.parse(assignment.answers);
        }
      } catch {
        console.error('Failed to parse candidate answers JSON string.');
      }
      setParsedAnswers(answers);

      const examRes = await examApi.getById(assignment.examId);
      const examData = examRes.data.data || examRes.data;

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
      }
    } catch (err) {
      addToast('Failed to load review components', 'error');
    } finally {
      setIsLoadingDetails(false);
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

  const totalTaken = assignments.length;
  const gradedCount = assignments.filter(a => a.status === 'GRADED').length;
  const pendingCount = totalTaken - gradedCount;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-headline-xl font-bold text-text-primary">Exams Taken</h1>
        <p className="text-body-sm text-text-muted mt-1">Review the evaluation status and results of your completed examinations.</p>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <span className="material-symbols-outlined text-2xl">history</span>
          </div>
          <div>
            <p className="text-caption-xs font-semibold text-text-muted uppercase">Exams Attempted</p>
            <h3 className="text-headline-xl font-bold text-text-primary mt-0.5">{totalTaken}</h3>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="p-3 bg-warning/10 text-warning rounded-xl">
            <span className="material-symbols-outlined text-2xl">pending_actions</span>
          </div>
          <div>
            <p className="text-caption-xs font-semibold text-text-muted uppercase">Pending Evaluation</p>
            <h3 className="text-headline-xl font-bold text-text-primary mt-0.5">{pendingCount}</h3>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="p-3 bg-emerald/10 text-emerald rounded-xl">
            <span className="material-symbols-outlined text-2xl">verified</span>
          </div>
          <div>
            <p className="text-caption-xs font-semibold text-text-muted uppercase">Graded & Released</p>
            <h3 className="text-headline-xl font-bold text-text-primary mt-0.5">{gradedCount}</h3>
          </div>
        </div>
      </div>

      {/* Attempts Table list */}
      <div className="card">
        <h3 className="text-headline-lg font-semibold text-text-primary mb-5">History List</h3>

        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-white/5 rounded"></div>
            <div className="h-10 bg-white/5 rounded"></div>
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-5xl text-text-muted mb-3">quiz</span>
            <p className="text-sm text-text-muted">You have not taken or submitted any exams yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="table-cell text-left font-medium">Exam Title</th>
                  <th className="table-cell text-left font-medium">Status</th>
                  <th className="table-cell text-left font-medium">Date Submitted</th>
                  <th className="table-cell text-right font-medium">Result Score</th>
                  <th className="table-cell text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id} className="table-row">
                    <td className="table-cell font-medium text-text-primary">
                      {assignment.exam?.title || 'Unknown Exam'}
                    </td>
                    <td className="table-cell">
                      <div className="flex flex-col gap-1 items-start">
                        {assignment.sessionStatus === 'TERMINATED' || assignment.terminationReason ? (
                          <span className="badge text-xs bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 font-bold">
                            <span className="material-symbols-outlined text-xs">block</span>
                            Terminated by Proctor
                          </span>
                        ) : (
                          <span className={clsx(
                            "badge text-xs",
                            assignment.status === 'GRADED' ? "badge-success" : "badge-warning animate-pulse"
                          )}>
                            {assignment.status === 'GRADED' ? 'Graded' : 'Pending Evaluation'}
                          </span>
                        )}
                        {assignment.exam?.enableProctoring && assignment.trustScore < 50 && !(assignment.sessionStatus === 'TERMINATED' || assignment.terminationReason) && (
                          <span className="badge badge-danger text-[10px] font-bold animate-pulse">
                            ⚠️ Integrity Flagged
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell text-text-muted text-sm">
                      {formatDate(assignment.submittedAt)}
                    </td>
                    <td className="table-cell text-right font-bold">
                      {assignment.status === 'GRADED' ? (
                        <span className="text-emerald text-sm">
                          {assignment.score} / {assignment.totalMarks || 100}
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs font-semibold">Under Review</span>
                      )}
                    </td>
                     <td className="table-cell text-right">
                      <div className="flex justify-end items-center gap-2">
                        {assignment.status === 'GRADED' &&
                          assignment.exam?.certificateIssuance &&
                          assignment.score >= assignment.exam?.passingScore && (
                            <a
                              href={certificateApi.getDownloadUrlByAssignment(assignment.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary !py-1 !px-2.5 !text-[11px] flex items-center gap-1 shrink-0 rounded border border-border text-text-secondary hover:text-emerald hover:border-emerald transition-colors"
                              title="Download PDF Certificate"
                            >
                              <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                              Certificate
                            </a>
                        )}
                        <button
                          onClick={() => handleOpenReview(assignment)}
                          className="btn-primary py-1 px-3 rounded-lg text-xs"
                        >
                          Review Answers
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── STUDENT REVIEW MODAL ────────────────────── */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto relative animate-scale-in flex flex-col p-0">
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-primary tracking-wide uppercase">Attempt Review</span>
                <h3 className="text-headline-lg font-bold text-text-primary mt-0.5">
                  {selectedAssignment.exam?.title || 'Exam Review'}
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Submitted on: {formatDate(selectedAssignment.submittedAt)}
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
                  Loading attempt answers & solutions...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Proctor Termination Disclosure Banner */}
                  {(selectedAssignment.sessionStatus === 'TERMINATED' || selectedAssignment.terminationReason) && (
                    <div className="p-4 border border-red-500/30 rounded-xl bg-red-500/10 text-red-400 flex items-start gap-3">
                      <span className="material-symbols-outlined text-2xl text-red-500 shrink-0 mt-0.5">block</span>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <h5 className="text-sm font-bold text-red-400">EXAM TERMINATED BY PROCTOR</h5>
                          <span className="text-xs font-mono font-bold bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/30">
                            TERMINATED
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          Your examination session was terminated by the proctor due to a security violation or proctor policy. The teacher will evaluate your submitted answers and decide your final score.
                        </p>
                        {selectedAssignment.terminationReason && (
                          <div className="mt-2 text-xs bg-black/40 p-2.5 rounded border border-red-500/20 font-mono text-slate-200">
                            <span className="font-bold text-red-400">Reason:</span> {selectedAssignment.terminationReason}
                            {selectedAssignment.terminationNote && (
                              <span className="block mt-1 text-slate-400"><span className="font-bold">Proctor Note:</span> {selectedAssignment.terminationNote}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Proctoring Flag Notification */}
                  {selectedAssignment.exam?.enableProctoring && selectedAssignment.trustScore < 50 && !(selectedAssignment.sessionStatus === 'TERMINATED' || selectedAssignment.terminationReason) && (
                    <div className="p-4 border border-red-500/20 rounded-xl bg-red-500/5 text-red-400 flex items-start gap-3 animate-pulse">
                      <span className="material-symbols-outlined mt-0.5">gavel</span>
                      <div>
                        <h5 className="text-sm font-semibold">Integrity Review Alert</h5>
                        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                          This assessment attempt has been flagged by the system AI Proctoring engine due to security warnings. It is currently undergoing integrity auditing.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-5">
                    {Object.keys(questionsMap).length === 0 ? (
                      <p className="text-sm text-text-muted">No answers found or compiled.</p>
                    ) : (
                      Object.keys(questionsMap).map((qId, idx) => {
                        const q = questionsMap[qId];
                        const answer = parsedAnswers[qId];
                        const isMCQ = q.type === 'MCQ';
                        const isProgramming = q.type === 'PROGRAMMING';
                        const correctOpt = q.options?.find((o: any) => o.isCorrect)?.text;
                        const isCorrect = isMCQ && answer === correctOpt;

                        return (
                          <div key={qId} className="p-5 border border-white/5 bg-white/5 rounded-xl space-y-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <span className="text-xs font-bold text-primary">QUESTION {idx + 1} ({q.type})</span>
                                <h5 className="text-sm font-semibold text-text-primary mt-0.5">{q.title}</h5>
                              </div>
                              <span className="text-xs badge-primary">{q.points || 10} pts</span>
                            </div>

                            <p className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">{q.body}</p>

                            {/* Candidate Answer */}
                            <div className="pt-3 border-t border-white/5">
                              <span className="text-[10px] font-bold text-text-muted block uppercase">Your Response:</span>
                              {answer ? (
                                <div className={clsx(
                                  "p-3 rounded-lg text-sm mt-1 font-medium",
                                  isMCQ 
                                    ? isCorrect 
                                      ? "bg-emerald/10 text-emerald border border-emerald/20" 
                                      : "bg-danger-bg/50 text-danger border border-danger/20"
                                    : "bg-white/5 text-text-primary font-mono whitespace-pre-wrap"
                                )}>
                                  {answer}
                                </div>
                              ) : (
                                <div className="text-xs italic text-text-muted mt-1 p-2 bg-white/5 rounded">
                                  No response provided.
                                </div>
                              )}
                            </div>

                            {/* MCQ Correct Choice */}
                            {isMCQ && (
                              <div className="text-xs text-text-muted flex items-center gap-1.5 mt-1 bg-white/5 p-2 rounded-lg">
                                <span className="material-symbols-outlined text-sm text-emerald">check_circle</span>
                                Correct Answer: <span className="text-emerald font-semibold">{correctOpt || 'None configured'}</span>
                              </div>
                            )}

                            {/* Programming Reference Solution */}
                            {isProgramming && q.solutionCode && (
                              <div className="pt-3 border-t border-white/5 bg-emerald/5 border border-emerald/10 p-3 rounded-lg">
                                <span className="text-[10px] font-bold text-emerald block uppercase">Model Reference Solution:</span>
                                <pre className="text-xs text-emerald font-mono whitespace-pre-wrap bg-black/40 p-2.5 rounded mt-1.5 max-h-[250px] overflow-y-auto">
                                  {q.solutionCode}
                                </pre>
                              </div>
                            )}

                            {/* Explanation */}
                            {q.explanation && (
                              <div className="text-xs text-text-secondary mt-2 bg-white/5 p-3 rounded-lg leading-relaxed">
                                <strong className="text-text-primary">Explanation:</strong> {q.explanation}
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

            {/* Modal Footer */}
            <div className="p-6 border-t border-border bg-white/5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAssignment(null)}
                className="btn-primary text-xs py-2 px-4"
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
