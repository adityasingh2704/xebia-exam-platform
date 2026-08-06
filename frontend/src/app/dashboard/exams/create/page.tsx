'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { examApi, userApi, questionApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/components/ui/Toast';

export default function CreateExamPage() {
  const router = useRouter();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const tenantId = user?.tenantId;

  // Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [duration, setDuration] = useState(60);
  const [totalMarks, setTotalMarks] = useState(100);
  const [passingScore, setPassingScore] = useState(60);

  // Settings
  const [navigationRule, setNavigationRule] = useState('FREE');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [enableProctoring, setEnableProctoring] = useState(true);
  const [proctoringMode, setProctoringMode] = useState('AI_ONLY');
  const [proctoringFlags, setProctoringFlags] = useState<string[]>([
    'FACE_ABSENCE', 'MULTIPLE_FACES', 'GAZE_AWAY', 'MOBILE_PHONE', 'TAB_SWITCH', 'CLIPBOARD'
  ]);
  const [recordingConfig, setRecordingConfig] = useState('WEBCAM_ONLY');
  const [sensitivityWarningLimit, setSensitivityWarningLimit] = useState(3);
  const [sensitivityTerminationLimit, setSensitivityTerminationLimit] = useState(10);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [negativeMarkValue, setNegativeMarkValue] = useState(0.25);
  const [certificateIssuance, setCertificateIssuance] = useState(false);

  // Questions selection
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fetch available questions on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoadingQuestions(true);
      try {
        const activeTenantId = tenantId || user?.tenantId;
        const params: Record<string, unknown> = { limit: 100 };
        if (activeTenantId) params.tenantId = activeTenantId;

        const response = await questionApi.list(params);
        const resData = response.data;
        let qList: any[] = [];
        if (Array.isArray(resData)) {
          qList = resData;
        } else if (Array.isArray(resData?.data?.data)) {
          qList = resData.data.data;
        } else if (Array.isArray(resData?.data?.items)) {
          qList = resData.data.items;
        } else if (Array.isArray(resData?.data?.questions)) {
          qList = resData.data.questions;
        } else if (Array.isArray(resData?.data)) {
          qList = resData.data;
        } else if (Array.isArray(resData?.items)) {
          qList = resData.items;
        } else if (Array.isArray(resData?.questions)) {
          qList = resData.questions;
        }
        setAvailableQuestions(qList);
      } catch (err: any) {
        console.warn('Failed to load questions from Question Bank:', err?.message || err);
        addToast('Failed to load questions from Question Bank', 'error');
      } finally {
        setIsLoadingQuestions(false);
      }
    };
    fetchQuestions();
  }, [tenantId, user?.tenantId]);

  const handleToggleQuestion = (qId: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const handleSelectAllFiltered = (filteredIds: string[]) => {
    setSelectedQuestionIds((prev) => {
      const allSelected = filteredIds.every(id => prev.includes(id));
      if (allSelected) {
        // Uncheck all filtered
        return prev.filter(id => !filteredIds.includes(id));
      } else {
        // Check all filtered (avoid duplicates)
        const union = new Set([...prev, ...filteredIds]);
        return Array.from(union);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedQuestionIds.length === 0) {
      addToast('Please select at least one question to include in the exam.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Create the exam
      const response = await examApi.create({
        tenantId,
        createdBy: user?.id || 'usr_teacher_001',
        status: 'PUBLISHED',
        title,
        description,
        instructions,
        duration,
        totalMarks,
        passingScore,
        navigationRule,
        shuffleQuestions,
        shuffleOptions,
        showResults,
        enableProctoring,
        proctoringMode,
        proctoringFlags,
        recordingConfig,
        sensitivityWarningLimit,
        sensitivityTerminationLimit,
        maxAttempts,
        negativeMarking,
        negativeMarkValue: negativeMarking ? negativeMarkValue : 0.0,
        certificateIssuance,
        sections: [],
      });
      
      const newExam = response.data?.data || response.data;
      if (!newExam?.id) {
        throw new Error('Failed to retrieve new exam details.');
      }

      // 2. Add a default section to contain the questions
      const sectionRes = await examApi.addSection(newExam.id, {
        title: 'General Assessment',
        description: 'Primary assessment questions for this examination.',
        order: 1,
      });

      const section = sectionRes.data?.data || sectionRes.data;
      if (!section?.id) {
        throw new Error('Failed to create general exam section.');
      }

      // 3. Associate selected questions to the general section
      await examApi.addQuestion(newExam.id, section.id, {
        questionIds: selectedQuestionIds,
      });

      // 4. Auto-assign to all candidates in the tenant
      if (tenantId) {
        try {
          const usersRes = await userApi.list({ role: 'CANDIDATE', tenantId });
          const uData = usersRes.data;
          let candidates: any[] = [];
          if (Array.isArray(uData)) candidates = uData;
          else if (Array.isArray(uData?.data)) candidates = uData.data;
          else if (Array.isArray(uData?.data?.items)) candidates = uData.data.items;
          else if (Array.isArray(uData?.items)) candidates = uData.items;

          if (candidates.length > 0) {
            const candidateIds = candidates.map(c => c.id);
            await examApi.assign(newExam.id, { candidateIds });
          }
          
          // Auto-publish so candidates can see it immediately
          await examApi.publish(newExam.id);
        } catch (assignErr) {
          console.error('Failed to auto-assign/publish candidates:', assignErr);
        }
      }

      setSuccess(true);
      addToast('Exam created with questions, published, and assigned!', 'success');
      setTimeout(() => {
        router.push('/dashboard/exams');
      }, 1500);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create exam';
      addToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter questions by search query
  const filteredQuestions = availableQuestions.filter((q) =>
    q.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.body?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSelectedPoints = selectedQuestionIds.reduce((sum, qId) => {
    const q = availableQuestions.find(a => a.id === qId);
    return sum + (q?.points || 0);
  }, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-surface-container transition-colors text-text-muted hover:text-text-primary"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
        </button>
        <div>
          <h1 className="text-headline-xl font-bold text-text-primary">Create New Exam</h1>
          <p className="text-body-sm text-text-muted">Configure basic details, proctoring, and add questions from the question bank.</p>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-success-bg border border-emerald/20 text-emerald font-semibold animate-slide-up">
          Exam created successfully! Redirecting back to Exams list...
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Basic Info */}
        <div className="card space-y-4">
          <h3 className="text-headline-lg font-semibold text-text-primary">1. Basic Details</h3>
          <div className="space-y-4">
            <div>
              <label className="input-label">Exam Title</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Data Structures & Algorithms — Final Exam"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="input-label">Short Description</label>
              <input
                type="text"
                className="input"
                placeholder="Provide a brief summary of the exam goals or syllabus."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">Instructions for Candidates</label>
              <textarea
                className="input min-h-[100px]"
                placeholder="Explain instructions (system requirements, forbidden materials, calculator policies, etc.)"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Step 2: Scoring & Timing */}
        <div className="card space-y-4">
          <h3 className="text-headline-lg font-semibold text-text-primary">2. Scoring & Timing</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="input-label">Duration (minutes)</label>
              <input
                type="number"
                className="input"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                min={1}
                required
              />
            </div>
            <div>
              <label className="input-label">Total Marks</label>
              <input
                type="number"
                className="input"
                value={totalMarks}
                onChange={(e) => setTotalMarks(parseInt(e.target.value) || 0)}
                min={1}
                required
              />
            </div>
            <div>
              <label className="input-label">Passing Score (%)</label>
              <input
                type="number"
                className="input"
                value={passingScore}
                onChange={(e) => setPassingScore(parseInt(e.target.value) || 0)}
                min={1}
                max={100}
                required
              />
            </div>
          </div>

          {/* Negative Marking Setup */}
          <div className="pt-4 border-t border-white/5 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="negativeMarking"
                checked={negativeMarking}
                onChange={(e) => setNegativeMarking(e.target.checked)}
                className="w-4 h-4 text-cta border-border focus:ring-cta rounded bg-transparent"
              />
              <label htmlFor="negativeMarking" className="text-sm font-semibold text-text-primary cursor-pointer select-none">
                Enable Negative Marking
              </label>
            </div>
            
            {negativeMarking && (
              <div className="flex items-center gap-3 animate-slide-up">
                <label className="text-sm text-text-secondary">Deduction per incorrect MCQ answer:</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.01"
                  max="10"
                  className="input !w-24 text-center font-bold"
                  value={negativeMarkValue}
                  onChange={(e) => setNegativeMarkValue(parseFloat(e.target.value) || 0)}
                  required
                />
                <span className="text-xs text-text-muted">points</span>
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Exam Rules & Settings */}
        <div className="card space-y-5">
          <h3 className="text-headline-lg font-semibold text-text-primary">3. Security & Rules</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="input-label">Navigation Control</label>
              <select
                className="input"
                value={navigationRule}
                onChange={(e) => setNavigationRule(e.target.value)}
              >
                <option value="FREE">Free Navigation (Move anywhere)</option>
                <option value="LINEAR">Linear Navigation (No back-tracking)</option>
                <option value="SECTION_LOCKED">Section Locked (Finish section first)</option>
              </select>
            </div>
            <div>
              <label className="input-label">Max Attempts Allowed</label>
              <input
                type="number"
                className="input"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 1)}
                min={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
            <div className="flex flex-col gap-3 p-3 border border-border rounded-xl col-span-1 md:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">AI Proctoring Suite</p>
                  <p className="text-caption-xs text-text-muted">Require camera, screen share, liveness check, and integrity scoring</p>
                </div>
                <input
                  type="checkbox"
                  checked={enableProctoring}
                  onChange={(e) => setEnableProctoring(e.target.checked)}
                  className="w-4 h-4 text-cta border-border focus:ring-cta"
                />
              </div>

              {enableProctoring && (
                <div className="mt-3 pt-3 border-t border-border space-y-4 animate-fade-in text-sm text-text-primary">
                  {/* Select parameters */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="input-label text-xs">Proctoring Mode</label>
                      <select
                        className="input text-xs py-1"
                        value={proctoringMode}
                        onChange={(e) => setProctoringMode(e.target.value)}
                      >
                        <option value="AI_ONLY">AI Only (Auto-flags & Scoring)</option>
                        <option value="AI_HUMAN_REVIEW">AI + Human Review (Proctor dashboard audits)</option>
                        <option value="HUMAN_ONLY">Human Only (Live webcam streams only)</option>
                        <option value="NO_PROCTORING">No Proctoring</option>
                      </select>
                    </div>

                    <div>
                      <label className="input-label text-xs">Recording Configuration</label>
                      <select
                        className="input text-xs py-1"
                        value={recordingConfig}
                        onChange={(e) => setRecordingConfig(e.target.value)}
                      >
                        <option value="WEBCAM_ONLY">Webcam stream only</option>
                        <option value="SCREEN_ONLY">Screen capture recording only</option>
                        <option value="WEBCAM_SCREEN">Webcam + Screen recording</option>
                        <option value="NEITHER">No storage / Real-time feed only</option>
                      </select>
                    </div>
                  </div>

                  {/* AI Flags Selection */}
                  <div>
                    <span className="input-label text-xs font-semibold block mb-2">Enable AI Proctoring Flags</span>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { key: 'FACE_ABSENCE', label: 'Face Absence Detection' },
                        { key: 'MULTIPLE_FACES', label: 'Multiple Faces Detection' },
                        { key: 'GAZE_AWAY', label: 'Gaze Away Tracking' },
                        { key: 'MOBILE_PHONE', label: 'Mobile Device Detection' },
                        { key: 'TAB_SWITCH', label: 'Tab Switch Flagging' },
                        { key: 'CLIPBOARD', label: 'Copy & Paste Restriction' },
                      ].map((flag) => {
                        const isChecked = proctoringFlags.includes(flag.key);
                        return (
                          <label key={flag.key} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setProctoringFlags(prev =>
                                  isChecked ? prev.filter(f => f !== flag.key) : [...prev, flag.key]
                                );
                              }}
                              className="rounded text-primary border-border focus:ring-primary w-3.5 h-3.5"
                            />
                            {flag.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sensitivity Limits */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="input-label text-xs">Sensitivity Warning Threshold ({sensitivityWarningLimit} flags)</label>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={sensitivityWarningLimit}
                        onChange={(e) => setSensitivityWarningLimit(parseInt(e.target.value))}
                        className="w-full accent-primary bg-white/10"
                      />
                      <span className="text-[10px] text-text-muted">Triggers warning notification to candidate screen.</span>
                    </div>

                    <div>
                      <label className="input-label text-xs">Auto-termination Limit ({sensitivityTerminationLimit} flags)</label>
                      <input
                        type="range"
                        min={5}
                        max={20}
                        value={sensitivityTerminationLimit}
                        onChange={(e) => setSensitivityTerminationLimit(parseInt(e.target.value))}
                        className="w-full accent-primary bg-white/10"
                      />
                      <span className="text-[10px] text-text-muted">Automatically locks & submits exam upon limit breach.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-3 border border-border rounded-xl">
              <div>
                <p className="text-sm font-semibold text-text-primary">Shuffle Questions</p>
                <p className="text-caption-xs text-text-muted">Display questions in a random order per student</p>
              </div>
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="w-4 h-4 text-cta border-border focus:ring-cta"
              />
            </div>

            <div className="flex items-center justify-between p-3 border border-border rounded-xl">
              <div>
                <p className="text-sm font-semibold text-text-primary">Shuffle Options</p>
                <p className="text-caption-xs text-text-muted">Randomize choices/options for multiple choice</p>
              </div>
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="w-4 h-4 text-cta border-border focus:ring-cta"
              />
            </div>

            <div className="flex items-center justify-between p-3 border border-border rounded-xl">
              <div>
                <p className="text-sm font-semibold text-text-primary">Show Results Immediately</p>
                <p className="text-caption-xs text-text-muted">Allow students to see score after submission</p>
              </div>
              <input
                type="checkbox"
                checked={showResults}
                onChange={(e) => setShowResults(e.target.checked)}
                className="w-4 h-4 text-cta border-border focus:ring-cta"
              />
            </div>

            <div className="flex items-center justify-between p-3 border border-border rounded-xl">
              <div>
                <p className="text-sm font-semibold text-text-primary">Certificate Issuance</p>
                <p className="text-caption-xs text-text-muted">Generate a certificate for candidates who pass the exam</p>
              </div>
              <input
                type="checkbox"
                checked={certificateIssuance}
                onChange={(e) => setCertificateIssuance(e.target.checked)}
                className="w-4 h-4 text-cta border-border focus:ring-cta"
              />
            </div>
          </div>
        </div>

        {/* Step 4: Add Questions from Question Bank */}
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
            <div>
              <h3 className="text-headline-lg font-semibold text-text-primary">4. Add Questions</h3>
              <p className="text-caption-xs text-text-muted mt-0.5">Select questions from the Question Bank to link to this exam.</p>
            </div>
            <div className="text-right">
              <span className="text-sm text-text-secondary font-medium">Selected: {selectedQuestionIds.length} questions</span>
              <span className="text-xs text-text-muted block">Total selected points: {totalSelectedPoints}</span>
            </div>
          </div>

          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-muted">search</span>
            <input
              type="text"
              placeholder="Search questions by title or text..."
              className="input pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {isLoadingQuestions ? (
            <div className="py-12 text-center text-sm text-text-muted">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-3"></div>
              Loading Question Bank questions...
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted border border-dashed border-white/10 rounded-xl">
              <span className="material-symbols-outlined text-3xl mb-2 text-text-muted">help</span>
              No matching questions found in the bank.
            </div>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg mb-2">
                <span className="text-xs font-semibold text-text-secondary">Available Questions ({filteredQuestions.length})</span>
                <button
                  type="button"
                  onClick={() => handleSelectAllFiltered(filteredQuestions.map(q => q.id))}
                  className="text-xs text-cta hover:text-cta-hover font-medium"
                >
                  {filteredQuestions.every(q => selectedQuestionIds.includes(q.id)) ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  onClick={() => handleToggleQuestion(q.id)}
                  className={clsx(
                    "p-3.5 border rounded-xl flex items-center justify-between gap-4 cursor-pointer transition-all hover:bg-white/5",
                    selectedQuestionIds.includes(q.id) ? "border-primary bg-primary/5" : "border-white/5"
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedQuestionIds.includes(q.id)}
                      readOnly
                      className="w-4 h-4 text-primary border-border focus:ring-primary rounded mt-1"
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-text-primary truncate">{q.title}</h4>
                      <p className="text-xs text-text-muted truncate mt-0.5">{q.body}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="badge text-xs bg-white/10 text-text-secondary uppercase">{q.type}</span>
                    <span className="text-xs text-primary font-bold">{q.points || 10} pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex justify-end gap-3 pt-6 border-t border-border">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="btn-cta"
          >
            {isLoading ? 'Creating Exam...' : 'Create & Publish Exam'}
          </button>
        </div>
      </form>
    </div>
  );
}
