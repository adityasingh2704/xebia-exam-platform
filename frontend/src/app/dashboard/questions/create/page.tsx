'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { questionApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/components/ui/Toast';

export default function CreateQuestionPage() {
  const router = useRouter();
  const { addToast } = useToastStore();

  const [type, setType] = useState('MCQ');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [points, setPoints] = useState(5);
  const [explanation, setExplanation] = useState('');
  const [tags, setTags] = useState('');

  // Options for MCQ / MRQ
  const [options, setOptions] = useState([
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);

  // Programming specific states
  const [programmingLanguage, setProgrammingLanguage] = useState('71'); // Default Python (71)
  const [templateCode, setTemplateCode] = useState('');
  const [solutionCode, setSolutionCode] = useState('');
  const [testCases, setTestCases] = useState<Array<{ input: string; expected_output: string }>>([
    { input: '', expected_output: '' }
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { user } = useAuthStore();
  const tenantId = user?.tenantId;

  const handleOptionChange = (idx: number, field: 'text' | 'isCorrect', val: any) => {
    setOptions((prev) =>
      prev.map((opt, i) => {
        if (i !== idx) {
          // If MCQ, make sure only one is correct
          if (type === 'MCQ' && field === 'isCorrect' && val === true) {
            return { ...opt, isCorrect: false };
          }
          return opt;
        }
        return { ...opt, [field]: val };
      }),
    );
  };

  const handleAddOption = () => {
    setOptions((prev) => [...prev, { text: '', isCorrect: false }]);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length > 2) {
      setOptions((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
      
      const payload: any = {
        type,
        title,
        body,
        difficulty,
        points,
        explanation,
        tenantId,
        createdBy: user?.id || 'usr_teacher_001',
        tags: parsedTags,
      };

      if (type === 'MCQ' || type === 'MRQ') {
        payload.options = options;
      } else if (type === 'PROGRAMMING') {
        payload.programmingLanguage = programmingLanguage;
        payload.templateCode = templateCode;
        payload.solutionCode = solutionCode;
        // Filter out empty test cases
        payload.testCases = JSON.stringify(
          testCases.filter((tc) => tc.input.trim() || tc.expected_output.trim())
        );
      }

      await questionApi.create(payload);
      setSuccess(true);
      addToast('Question created successfully!', 'success');
      setTimeout(() => {
        router.push('/dashboard/questions');
      }, 1500);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create question';
      addToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

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
          <h1 className="text-headline-xl font-bold text-text-primary">Create New Question</h1>
          <p className="text-body-sm text-text-muted">Create a question to add to your question repository</p>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-success-bg border border-emerald/20 text-emerald font-semibold animate-slide-up">
          Question created successfully! Redirecting back to Question Bank...
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="card space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Question Type */}
          <div>
            <label className="input-label">Question Type</label>
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="MCQ">Multiple Choice Question (MCQ)</option>
              <option value="MRQ">Multiple Response Question (MRQ)</option>
              <option value="TRUE_FALSE">True / False</option>
              <option value="PROGRAMMING">Programming Assessment</option>
              <option value="ESSAY">Essay / Descriptive</option>
            </select>
          </div>

          {/* Difficulty */}
          <div>
            <label className="input-label">Difficulty Level</label>
            <select
              className="input"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
              <option value="EXPERT">Expert</option>
            </select>
          </div>

          {/* Points */}
          <div>
            <label className="input-label">Default Points</label>
            <input
              type="number"
              className="input"
              value={points}
              onChange={(e) => setPoints(parseInt(e.target.value))}
              min={1}
            />
          </div>
        </div>

        {/* Question Title */}
        <div>
          <label className="input-label">Question Title</label>
          <input
            type="text"
            className="input"
            placeholder="e.g. Binary Search Time Complexity"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        {/* Question Body */}
        <div>
          <label className="input-label">Question Body / Prompt</label>
          <textarea
            className="input min-h-[140px]"
            placeholder="Describe the question details. Supports Markdown formatting."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
          />
        </div>

        {/* Options Section (only MCQ / MRQ) */}
        {(type === 'MCQ' || type === 'MRQ') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Answer Options</h3>
              <button
                type="button"
                onClick={handleAddOption}
                className="text-xs text-cta hover:text-cta-hover font-semibold flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add</span> Add Option
              </button>
            </div>

            <div className="space-y-3">
              {options.map((option, idx) => (
                <div
                  key={idx}
                  className={clsx(
                    "flex items-center gap-3 p-3 border rounded-xl transition-all",
                    option.isCorrect ? "border-emerald/30 bg-emerald/5" : "border-white/5 bg-white/5"
                  )}
                >
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type={type === 'MCQ' ? 'radio' : 'checkbox'}
                      name="correct-option"
                      checked={option.isCorrect}
                      onChange={(e) => handleOptionChange(idx, 'isCorrect', e.target.checked)}
                      className="w-4 h-4 text-emerald border-border focus:ring-emerald rounded"
                    />
                    <span className={clsx(
                      "text-xs font-semibold px-2 py-0.5 rounded",
                      option.isCorrect ? "bg-emerald/10 text-emerald" : "bg-white/5 text-text-muted"
                    )}>
                      {option.isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </label>
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder={`Option ${idx + 1}`}
                    value={option.text}
                    onChange={(e) => handleOptionChange(idx, 'text', e.target.value)}
                    required
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 text-text-muted hover:text-danger rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Programming Options */}
        {type === 'PROGRAMMING' && (
          <div className="space-y-5 border-t border-white/5 pt-6 animate-fade-in">
            <h3 className="text-sm font-semibold text-text-primary">Programming Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Programming Language</label>
                <select
                  className="input"
                  value={programmingLanguage}
                  onChange={(e) => setProgrammingLanguage(e.target.value)}
                >
                  <option value="71">Python (3.8.1)</option>
                  <option value="62">Java (OpenJDK 13.0.1)</option>
                  <option value="54">C++ (GCC 9.2.0)</option>
                  <option value="63">JavaScript (Node.js 12.14.0)</option>
                  <option value="74">TypeScript (3.7.4)</option>
                  <option value="50">C (GCC 9.2.0)</option>
                  <option value="60">Go (1.13.5)</option>
                  <option value="73">Rust (1.40.0)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="input-label">Starter / Template Code (Given to Student)</label>
              <textarea
                className="input min-h-[120px] font-mono text-xs"
                placeholder="e.g. def solve():&#10;    # Write your code here"
                value={templateCode}
                onChange={(e) => setTemplateCode(e.target.value)}
              />
            </div>

            <div>
              <label className="input-label">Model Solution Code (For Student Review after Exam)</label>
              <textarea
                className="input min-h-[120px] font-mono text-xs"
                placeholder="e.g. def solve():&#10;    print('Hello World')"
                value={solutionCode}
                onChange={(e) => setSolutionCode(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="input-label mb-0">Test Cases (Inputs & Expected Outputs)</label>
                <button
                  type="button"
                  onClick={() => setTestCases(prev => [...prev, { input: '', expected_output: '' }])}
                  className="text-xs text-cta hover:text-cta-hover font-semibold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">add</span> Add Test Case
                </button>
              </div>

              <div className="space-y-3">
                {testCases.map((tc, idx) => (
                  <div key={idx} className="flex gap-3 items-start border border-white/5 p-3 rounded-xl bg-white/5">
                    <div className="flex-1 space-y-2">
                      <span className="text-[10px] font-bold text-text-muted uppercase">Test Case {idx + 1}</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-text-muted block">Stdin Input</label>
                          <textarea
                            className="input min-h-[50px] text-xs font-mono py-1 px-2"
                            placeholder="Input value (e.g. 5)"
                            value={tc.input}
                            onChange={(e) => {
                              const updated = [...testCases];
                              updated[idx].input = e.target.value;
                              setTestCases(updated);
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-text-muted block">Expected Stdout Output</label>
                          <textarea
                            className="input min-h-[50px] text-xs font-mono py-1 px-2"
                            placeholder="Expected output (e.g. 10)"
                            value={tc.expected_output}
                            onChange={(e) => {
                              const updated = [...testCases];
                              updated[idx].expected_output = e.target.value;
                              setTestCases(updated);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    {testCases.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setTestCases(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-text-muted hover:text-danger rounded-lg mt-5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Explanation */}
        <div>
          <label className="input-label">Answer Explanation (Optional)</label>
          <textarea
            className="input min-h-[80px]"
            placeholder="Provide a detailed explanation of the correct answer."
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
        </div>

        {/* Tags */}
        <div>
          <label className="input-label">Tags (comma separated)</label>
          <input
            type="text"
            className="input"
            placeholder="e.g. data-structures, sorting, java"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
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
            {isLoading ? 'Creating Question...' : 'Save Question'}
          </button>
        </div>
      </form>
    </div>
  );
}
