'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { questionApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { TableSkeleton, StatCardSkeleton } from '@/components/ui/LoadingSkeleton';

interface Question {
  id: string;
  title: string;
  type: string;
  difficulty: string;
  tags: { tag: string }[] | string[];
  category?: { name: string } | null;
  points: number;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
}

const difficultyColors: Record<string, string> = {
  EASY: 'badge-success',
  MEDIUM: 'badge-cta',
  HARD: 'badge-warning',
  EXPERT: 'badge-danger',
};

const typeColors: Record<string, string> = {
  MCQ: 'badge-primary',
  MRQ: 'badge-primary',
  TRUE_FALSE: 'badge-primary',
  PROGRAMMING: 'bg-blue-50 text-blue-700',
  SHORT_ANSWER: 'badge-primary',
  ESSAY: 'bg-purple-50 text-purple-700',
};

export default function QuestionBankPage() {
  const router = useRouter();
  const { addToast } = useToastStore();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  
  const { user } = useAuthStore();
  const effectiveUser = (user as any)?.user || user;
  const tenantId = effectiveUser?.tenantId;

  // Delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);

  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const activeTenantId = tenantId || effectiveUser?.tenantId;
      const params: Record<string, unknown> = { page, limit };
      if (activeTenantId && activeTenantId !== 'undefined' && activeTenantId !== 'null' && activeTenantId !== 'all') {
        params.tenantId = activeTenantId;
      }
      if (searchQuery) params.search = searchQuery;
      if (selectedType !== 'All') params.type = selectedType;
      if (selectedDifficulty !== 'All') params.difficulty = selectedDifficulty;

      const response = await questionApi.list(params);
      const resObj = response.data;
      let list: any[] = [];
      let total = 0;

      if (Array.isArray(resObj)) {
        list = resObj;
      } else if (Array.isArray(resObj?.data?.data)) {
        list = resObj.data.data;
      } else if (Array.isArray(resObj?.data?.items)) {
        list = resObj.data.items;
      } else if (Array.isArray(resObj?.data?.questions)) {
        list = resObj.data.questions;
      } else if (Array.isArray(resObj?.data)) {
        list = resObj.data;
      } else if (Array.isArray(resObj?.items)) {
        list = resObj.items;
      } else if (Array.isArray(resObj?.questions)) {
        list = resObj.questions;
      }

      total = resObj?.data?.meta?.total ?? resObj?.meta?.total ?? list.length;

      // If tenant returned 0 questions and tenantId was specified, fallback query without tenant filter
      if (list.length === 0 && params.tenantId) {
        try {
          const fallbackRes = await questionApi.list({ page, limit, ...(searchQuery && { search: searchQuery }) });
          const fbObj = fallbackRes.data;
          let fbList: any[] = [];
          if (Array.isArray(fbObj)) fbList = fbObj;
          else if (Array.isArray(fbObj?.data?.data)) fbList = fbObj.data.data;
          else if (Array.isArray(fbObj?.data?.items)) fbList = fbObj.data.items;
          else if (Array.isArray(fbObj?.data?.questions)) fbList = fbObj.data.questions;
          else if (Array.isArray(fbObj?.data)) fbList = fbObj.data;
          else if (Array.isArray(fbObj?.items)) fbList = fbObj.items;
          else if (Array.isArray(fbObj?.questions)) fbList = fbObj.questions;
          if (fbList.length > 0) {
            list = fbList;
            total = fbObj?.data?.meta?.total ?? fbObj?.meta?.total ?? fbList.length;
          }
        } catch {
          // ignore fallback
        }
      }

      setQuestions(list);
      setTotalCount(total);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to load questions';
      setError(msg);
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, tenantId, effectiveUser?.tenantId, searchQuery, selectedType, selectedDifficulty]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Debounced search
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout>>();
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => setPage(1), 400));
  };

  const toggleSelect = (id: string) => {
    setSelectedQuestions((prev) =>
      prev.includes(id) ? prev.filter((q) => q !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedQuestions.length === questions.length) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions(questions.map((q) => q.id));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await questionApi.delete(deleteTarget.id);
      addToast('Question deleted successfully', 'success');
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      fetchQuestions();
    } catch {
      addToast('Failed to delete question', 'error');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedQuestions.map((id) => questionApi.delete(id)));
      addToast(`${selectedQuestions.length} questions deleted`, 'success');
      setSelectedQuestions([]);
      fetchQuestions();
    } catch {
      addToast('Failed to delete some questions', 'error');
    }
  };

  const getTags = (q: Question): string[] => {
    if (!q.tags) return [];
    return q.tags.map((t: any) => (typeof t === 'string' ? t : t.tag));
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return dateStr; }
  };

  // Stats
  const mcqCount = questions.filter((q) => q.type === 'MCQ' || q.type === 'MRQ').length;
  const progCount = questions.filter((q) => q.type === 'PROGRAMMING').length;
  const categories = new Set(questions.map((q) => q.category?.name).filter(Boolean));

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-xl font-bold text-text-primary">Question Bank</h1>
          <p className="text-body-sm text-text-muted mt-1">
            Manage your examination questions across all categories.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="btn-secondary cursor-pointer">
            <span className="material-symbols-outlined text-lg">upload_file</span>
            Import
            <input type="file" className="hidden" accept=".csv" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              addToast('Importing questions CSV...', 'info');
              // Mock success for CSV import
              setTimeout(() => {
                addToast('Import completed successfully', 'success');
                fetchQuestions();
              }, 1500);
            }} />
          </label>
          <button className="btn-cta" onClick={() => router.push('/dashboard/questions/create')}>
            <span className="material-symbols-outlined text-lg">add</span>
            Create Question
          </button>
        </div>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Questions', value: totalCount.toString(), icon: 'help_center', color: 'primary' },
            { label: 'MCQ / MRQ', value: mcqCount.toString(), icon: 'radio_button_checked', color: 'emerald' },
            { label: 'Programming', value: progCount.toString(), icon: 'code', color: 'cta' },
            { label: 'Categories', value: categories.size.toString(), icon: 'folder', color: 'primary' },
          ].map((stat) => (
            <div key={stat.label} className="card-flat flex items-center gap-3 !p-4">
              <div className={clsx(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                stat.color === 'primary' ? 'bg-info-bg' : stat.color === 'emerald' ? 'bg-success-bg' : 'bg-cta-light',
              )}>
                <span className={clsx(
                  'material-symbols-outlined',
                  stat.color === 'primary' ? 'text-primary' : stat.color === 'emerald' ? 'text-emerald' : 'text-cta',
                )}>
                  {stat.icon}
                </span>
              </div>
              <div>
                <p className="text-xl font-bold text-text-primary">{stat.value}</p>
                <p className="text-caption-xs text-text-muted">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters Bar */}
      <div className="card-flat !p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Search questions by title, tag, or category..."
              className="input !pl-10"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <select
            className="input !w-auto !min-w-[140px]"
            value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
          >
            <option value="All" className="bg-surface-card text-text-primary">All Types</option>
            <option value="MCQ" className="bg-surface-card text-text-primary">MCQ</option>
            <option value="MRQ" className="bg-surface-card text-text-primary">MRQ</option>
            <option value="TRUE_FALSE" className="bg-surface-card text-text-primary">True/False</option>
            <option value="PROGRAMMING" className="bg-surface-card text-text-primary">Programming</option>
            <option value="ESSAY" className="bg-surface-card text-text-primary">Essay</option>
          </select>
          <select
            className="input !w-auto !min-w-[150px]"
            value={selectedDifficulty}
            onChange={(e) => { setSelectedDifficulty(e.target.value); setPage(1); }}
          >
            <option value="All" className="bg-surface-card text-text-primary">All Difficulties</option>
            <option value="EASY" className="bg-surface-card text-text-primary">Easy</option>
            <option value="MEDIUM" className="bg-surface-card text-text-primary">Medium</option>
            <option value="HARD" className="bg-surface-card text-text-primary">Hard</option>
            <option value="EXPERT" className="bg-surface-card text-text-primary">Expert</option>
          </select>
          <div className="flex items-center border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={clsx(
                'px-3 py-2 text-sm transition-colors',
                viewMode === 'table' ? 'bg-primary text-white' : 'text-text-muted hover:bg-surface-page',
              )}
            >
              <span className="material-symbols-outlined text-lg">view_list</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={clsx(
                'px-3 py-2 text-sm transition-colors',
                viewMode === 'grid' ? 'bg-primary text-white' : 'text-text-muted hover:bg-surface-page',
              )}
            >
              <span className="material-symbols-outlined text-lg">grid_view</span>
            </button>
          </div>
        </div>

        {/* Selected Actions */}
        {selectedQuestions.length > 0 && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border animate-slide-up">
            <span className="text-sm text-text-secondary">
              <strong>{selectedQuestions.length}</strong> selected
            </span>
            <button className="text-sm text-cta font-medium hover:text-cta-hover">
              Add to Exam
            </button>
            <button className="text-sm text-primary font-medium hover:text-primary-bright">
              Export
            </button>
            <button
              className="text-sm text-danger font-medium hover:opacity-80"
              onClick={handleBulkDelete}
            >
              Delete
            </button>
            <button
              className="text-sm text-text-muted ml-auto"
              onClick={() => setSelectedQuestions([])}
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-danger-bg border border-red-200 text-danger text-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
            <button onClick={fetchQuestions} className="ml-auto text-xs font-medium underline">Retry</button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : questions.length === 0 ? (
        /* Empty State */
        <div className="card text-center py-12">
          <span className="material-symbols-outlined text-5xl text-text-muted mb-4">quiz</span>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No questions found</h3>
          <p className="text-body-sm text-text-muted mb-6">
            {searchQuery || selectedType !== 'All' || selectedDifficulty !== 'All'
              ? 'Try adjusting your filters or search query.'
              : 'Get started by creating your first question.'}
          </p>
          <button className="btn-cta" onClick={() => router.push('/dashboard/questions/create')}>
            <span className="material-symbols-outlined text-lg">add</span>
            Create Question
          </button>
        </div>
      ) : (
        /* Questions Table */
        <div className="card !p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="table-header border-b border-border">
                <th className="table-cell w-10">
                  <input
                    type="checkbox"
                    checked={selectedQuestions.length === questions.length && questions.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-border text-primary"
                  />
                </th>
                <th className="table-cell text-left font-medium">Question</th>
                <th className="table-cell text-left font-medium w-24">Type</th>
                <th className="table-cell text-left font-medium w-28">Difficulty</th>
                <th className="table-cell text-center font-medium w-20">Points</th>
                <th className="table-cell text-center font-medium w-24">Used In</th>
                <th className="table-cell text-left font-medium w-32">Created</th>
                <th className="table-cell w-12"></th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr
                  key={q.id}
                  className={clsx(
                    'table-row cursor-pointer',
                    selectedQuestions.includes(q.id) && 'bg-info-bg/30',
                  )}
                >
                  <td className="table-cell">
                    <input
                      type="checkbox"
                      checked={selectedQuestions.includes(q.id)}
                      onChange={() => toggleSelect(q.id)}
                      className="w-4 h-4 rounded border-border text-primary"
                    />
                  </td>
                  <td className="table-cell">
                    <div>
                      <p className="font-medium text-text-primary text-sm leading-snug">{q.title}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {getTags(q).slice(0, 3).map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-page text-text-muted">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={clsx('badge text-xs', typeColors[q.type] || 'badge-primary')}>
                      {q.type}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={clsx('badge text-xs', difficultyColors[q.difficulty])}>
                      {q.difficulty?.charAt(0) + q.difficulty?.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="table-cell text-center font-medium">{q.points}</td>
                  <td className="table-cell text-center">
                    <span className="text-sm text-text-muted">{q.usageCount} exams</span>
                  </td>
                  <td className="table-cell text-sm text-text-muted">{formatDate(q.createdAt)}</td>
                  <td className="table-cell">
                    <div className="relative group">
                      <button className="p-1 rounded-lg hover:bg-surface-page transition-colors">
                        <span className="material-symbols-outlined text-text-muted text-lg">more_vert</span>
                      </button>
                      {/* Dropdown */}
                      <div className="absolute right-0 top-full mt-1 w-36 bg-surface-card rounded-xl shadow-lg border border-border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-page rounded-t-xl"
                          onClick={() => addToast('Edit feature coming soon', 'info')}
                        >
                          <span className="material-symbols-outlined text-base">edit</span> Edit
                        </button>
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-bg rounded-b-xl"
                          onClick={() => { setDeleteTarget(q); setDeleteModalOpen(true); }}
                        >
                          <span className="material-symbols-outlined text-base">delete</span> Delete
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface-page/50">
            <span className="text-sm text-text-muted">
              Showing {questions.length} of {totalCount} questions
            </span>
            <div className="flex items-center gap-1">
              <button
                className="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:bg-surface-card transition-colors disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-sm font-medium',
                    page === i + 1 ? 'bg-primary text-white' : 'text-text-muted hover:bg-surface-card',
                  )}
                >
                  {i + 1}
                </button>
              ))}
              <button
                className="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:bg-surface-card transition-colors disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeleteTarget(null); }}
        title="Delete Question"
        description="This action cannot be undone."
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
            <button className="btn-cta !bg-danger hover:!bg-red-800" onClick={handleDelete}>
              Delete Question
            </button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Are you sure you want to delete <strong>{deleteTarget?.title}</strong>?
          This will permanently remove it from the question bank.
        </p>
      </Modal>
    </div>
  );
}
