'use client';

import { useState } from 'react';
import { examApi } from '@/lib/api';
import { useToastStore } from '@/components/ui/Toast';

interface ProctoringConfigModalProps {
  exam: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ProctoringConfigModal({
  exam,
  isOpen,
  onClose,
  onSuccess,
}: ProctoringConfigModalProps) {
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(false);

  const isLocked = Boolean(exam?.proctoringSettingsLocked);

  const [proctoringMode, setProctoringMode] = useState<string>(
    exam?.proctoringMode || 'AI_ONLY'
  );
  const [recordingConfig, setRecordingConfig] = useState<string>(
    exam?.recordingConfig || 'WEBCAM_ONLY'
  );

  const defaultFlags = [
    { id: 'MULTIPLE_FACES', label: 'Multiple Faces Detected', desc: 'Flag when additional people enter video frame' },
    { id: 'NO_FACE', label: 'No Face Present', desc: 'Flag when candidate leaves the camera view' },
    { id: 'TAB_SWITCH', label: 'Tab & Application Switch', desc: 'Flag when candidate navigates away from browser' },
    { id: 'AUDIO_DETECTED', label: 'Background Speech & Noise', desc: 'Flag secondary voices or ambient speech' },
    { id: 'CAMERA_DISCONNECTED', label: 'Camera Feed Interrupted', desc: 'Flag webcam disconnection or cover' },
    { id: 'DEVTOOLS_OPEN', label: 'Developer Tools & Inspection', desc: 'Flag opening browser console or devtools' },
  ];

  const initialEnabledFlags = exam?.proctoringFlags || [
    'MULTIPLE_FACES',
    'NO_FACE',
    'TAB_SWITCH',
    'AUDIO_DETECTED',
    'CAMERA_DISCONNECTED',
  ];

  const [selectedFlags, setSelectedFlags] = useState<string[]>(initialEnabledFlags);

  const [sensitivityNotifyLimit, setSensitivityNotifyLimit] = useState<number>(
    exam?.sensitivityNotifyLimit ?? 70
  );
  const [sensitivityWarningLimit, setSensitivityWarningLimit] = useState<number>(
    exam?.sensitivityWarningLimit ?? 50
  );
  const [sensitivityTerminationLimit, setSensitivityTerminationLimit] = useState<number>(
    exam?.sensitivityTerminationLimit ?? 30
  );

  if (!isOpen) return null;

  const toggleFlag = (flagId: string) => {
    if (isLocked) return;
    setSelectedFlags((prev) =>
      prev.includes(flagId) ? prev.filter((f) => f !== flagId) : [...prev, flagId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      addToast('Proctoring configuration is locked because an assessment session has already begun.', 'error');
      return;
    }

    setLoading(true);
    try {
      await examApi.updateProctoringConfig(exam.id, {
        proctoringMode,
        proctoringFlags: selectedFlags,
        recordingConfig,
        sensitivityNotifyLimit,
        sensitivityWarningLimit,
        sensitivityTerminationLimit,
      });

      addToast('Proctoring configuration updated successfully!', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to update proctoring configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-surface card w-full max-w-2xl max-h-[90vh] flex flex-col shadow-elevated border border-border animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-surface-header">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-2xl">shield</span>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Proctoring Configuration (Req 4.3.3)</h2>
              <p className="text-xs text-text-muted">Configure AI sensitivity, rules, and live recording modes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-page transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Lock Banner */}
          {isLocked && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3 text-amber-700 dark:text-amber-300">
              <span className="material-symbols-outlined text-amber-500 text-xl">lock</span>
              <p className="text-xs font-medium">
                <strong>Configuration Locked:</strong> Candidate session has started for this exam. Proctoring settings can no longer be modified.
              </p>
            </div>
          )}

          {/* 1. Proctoring Level */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Proctoring Mode & Enforcement Level
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'NO_PROCTORING', label: 'No Proctoring', desc: 'Standard unmonitored exam' },
                { id: 'AI_ONLY', label: 'AI Automated Only', desc: 'Automated AI flag detection' },
                { id: 'AI_HUMAN_REVIEW', label: 'AI + Human Review', desc: 'AI detection with live proctor oversight' },
                { id: 'HUMAN_ONLY', label: 'Human Only', desc: 'Live proctor monitoring without AI flags' },
              ].map((mode) => (
                <button
                  type="button"
                  key={mode.id}
                  disabled={isLocked}
                  onClick={() => setProctoringMode(mode.id)}
                  className={`p-3 text-left rounded-xl border transition-all ${
                    proctoringMode === mode.id
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border hover:border-text-muted bg-surface-card'
                  } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <p className="text-xs font-bold text-text-primary">{mode.label}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{mode.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Recording Options */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Session Recording Options
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'WEBCAM_ONLY', label: 'Webcam Only', icon: 'videocam' },
                { id: 'SCREEN_ONLY', label: 'Screen Only', icon: 'desktop_windows' },
                { id: 'BOTH', label: 'Both Streams', icon: 'dual_screen' },
                { id: 'NEITHER', label: 'Neither', icon: 'videocam_off' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  disabled={isLocked}
                  onClick={() => setRecordingConfig(opt.id)}
                  className={`p-2.5 flex flex-col items-center justify-center text-center rounded-xl border text-xs font-medium transition-all ${
                    recordingConfig === opt.id
                      ? 'border-primary bg-primary/10 text-primary font-bold'
                      : 'border-border text-text-secondary hover:bg-surface-page'
                  } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <span className="material-symbols-outlined text-lg mb-1">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. AI Flag Detector Toggles */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Individual AI Flag Detectors
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {defaultFlags.map((flag) => {
                const checked = selectedFlags.includes(flag.id);
                return (
                  <div
                    key={flag.id}
                    onClick={() => toggleFlag(flag.id)}
                    className={`p-3 rounded-xl border flex items-start justify-between cursor-pointer transition-all ${
                      checked
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-border bg-surface-card hover:border-text-muted'
                    } ${isLocked ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <div>
                      <p className="text-xs font-bold text-text-primary">{flag.label}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{flag.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}}
                      className="mt-1 h-4 w-4 rounded text-primary focus:ring-primary border-border"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Trust Score & Sensitivity Thresholds */}
          <div className="bg-surface-page p-4 rounded-xl border border-border space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-primary">tune</span>
              Trust Score Sensitivity Thresholds (4.5.5)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-medium text-text-secondary block mb-1">
                  Proctor Notify Threshold (&lt; Trust Score)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="100"
                    disabled={isLocked}
                    value={sensitivityNotifyLimit}
                    onChange={(e) => setSensitivityNotifyLimit(parseInt(e.target.value) || 70)}
                    className="w-full input-field text-xs text-center !py-1.5 font-bold"
                  />
                  <span className="text-xs text-text-muted font-bold">%</span>
                </div>
                <span className="text-[9px] text-text-muted">Notifies proctor on grid</span>
              </div>

              <div>
                <label className="text-[11px] font-medium text-text-secondary block mb-1">
                  Candidate Warning Threshold (&lt; Trust Score)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="10"
                    max="100"
                    disabled={isLocked}
                    value={sensitivityWarningLimit}
                    onChange={(e) => setSensitivityWarningLimit(parseInt(e.target.value) || 50)}
                    className="w-full input-field text-xs text-center !py-1.5 font-bold text-amber-600"
                  />
                  <span className="text-xs text-text-muted font-bold">%</span>
                </div>
                <span className="text-[9px] text-text-muted">Auto-warns candidate</span>
              </div>

              <div>
                <label className="text-[11px] font-medium text-text-secondary block mb-1">
                  Auto-Termination Threshold (&lt; Trust Score)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={isLocked}
                    value={sensitivityTerminationLimit}
                    onChange={(e) => setSensitivityTerminationLimit(parseInt(e.target.value) || 30)}
                    className="w-full input-field text-xs text-center !py-1.5 font-bold text-red-600"
                  />
                  <span className="text-xs text-text-muted font-bold">%</span>
                </div>
                <span className="text-[9px] text-text-muted">Auto-terminates session</span>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-border flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary !py-2 !px-4 !text-xs !rounded-lg"
            >
              Cancel
            </button>
            {!isLocked && (
              <button
                type="submit"
                disabled={loading}
                className="btn-primary !py-2 !px-5 !text-xs !rounded-lg flex items-center gap-1.5"
              >
                {loading ? 'Saving Settings...' : 'Save Proctoring Config'}
              </button>
            )}
          </div>
        </form>

      </div>
    </div>
  );
}
