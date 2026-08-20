'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useToastStore } from '@/components/ui/Toast';
import { useTheme } from '@/components/theme/ThemeProvider';
import { examApi, userApi } from '@/lib/api';
import { clsx } from 'clsx';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  timestamp: number;
  unread: boolean;
  type?: 'info' | 'warning' | 'success';
}

export default function TopNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const router = useRouter();
  const { addToast } = useToastStore();
  const { theme, toggleTheme } = useTheme();
  const notifRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const effectiveUser = (user as any)?.user || user;
  const roleLabel = effectiveUser?.role?.replace(/_/g, ' ') || 'User';
  const isCandidate = effectiveUser?.role === 'CANDIDATE';

  // Get page title from pathname
  const getPageTitle = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length <= 1) return 'Dashboard';
    const lastSegment = segments[segments.length - 1];
    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      router.push(`/dashboard/exams?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Load & Synchronize Notifications ───────────────────
  useEffect(() => {
    if (!user?.id) return;

    const storageKey = `xe_notifications_${user.id}`;
    const stored = localStorage.getItem(storageKey);
    let loadedList: NotificationItem[] = [];

    if (stored) {
      try {
        loadedList = JSON.parse(stored);
      } catch (err) {
        console.error('Failed to parse notifications storage:', err);
      }
    } else {
      // Seed default welcome notifications based on role
      if (isCandidate) {
        loadedList = [
          {
            id: 'welcome-cand',
            title: 'Welcome Candidate',
            message: 'Welcome to your exam proctoring portal. Start by reviewing assigned exams in the dashboard.',
            time: 'Just now',
            timestamp: Date.now(),
            unread: true,
            type: 'info',
          },
        ];
      } else {
        loadedList = [
          {
            id: 'welcome-teach',
            title: 'Welcome Instructor',
            message: 'Welcome to the Examiner Console. You can manage exams, view candidates, and evaluate submissions.',
            time: 'Just now',
            timestamp: Date.now(),
            unread: true,
            type: 'info',
          },
        ];
      }
      localStorage.setItem(storageKey, JSON.stringify(loadedList));
    }
    setNotifications(loadedList);
  }, [user, isCandidate]);

  // Save changes to localStorage helper
  const saveNotifications = (list: NotificationItem[]) => {
    if (!user?.id) return;
    localStorage.setItem(`xe_notifications_${user.id}`, JSON.stringify(list));
    setNotifications(list);
  };

  // ── Periodic Sync with Microservices database ───────────
  useEffect(() => {
    if (!user?.id || !user?.tenantId) return;

    let previousSubmissionsMap: Record<string, string> = {};

    const syncWithDb = async () => {
      try {
        const params: Record<string, unknown> = { tenantId: user.tenantId };
        if (isCandidate) {
          params.candidateId = user.id;
        }

        const response = await examApi.listAssignments(params);
        const data = response.data.data || response.data;
        if (!Array.isArray(data)) return;

        let modified = false;
        const currentList = [...notifications];

        // Fetch users map if teacher to display names
        let candidateNamesMap: Record<string, string> = {};
        if (!isCandidate) {
          try {
            const usersRes = await userApi.list({ tenantId: user.tenantId });
            const usersData = usersRes.data?.data?.data || usersRes.data?.data || [];
            if (Array.isArray(usersData)) {
              usersData.forEach((u: any) => {
                candidateNamesMap[u.id] = `${u.firstName} ${u.lastName}`;
              });
            }
          } catch { }
        }

        data.forEach((ass: any) => {
          const storedKey = `notif_state_${ass.id}`;
          const currentStatus = ass.status;
          const examTitle = ass.exam?.title || 'Examination';

          const storedStatus = localStorage.getItem(storedKey);

          if (storedStatus !== currentStatus) {
            // State has changed!
            localStorage.setItem(storedKey, currentStatus);

            if (isCandidate) {
              // Notification for candidate when graded
              if (currentStatus === 'GRADED') {
                const alreadyNotified = currentList.some(n => n.id === `grade-${ass.id}`);
                if (!alreadyNotified) {
                  currentList.unshift({
                    id: `grade-${ass.id}`,
                    title: 'Exam Result Released',
                    message: `Your exam "${examTitle}" has been graded! Score: ${ass.score}/${ass.totalMarks || 100}.`,
                    time: 'Just now',
                    timestamp: Date.now(),
                    unread: true,
                    type: 'success',
                  });
                  modified = true;
                  addToast(`Exam result announced: ${examTitle}`, 'info');
                }
              }
              // Notification for teacher when exam submitted
              if (currentStatus === 'SUBMITTED') {
                const alreadyNotified = currentList.some(n => n.id === `submit-${ass.id}`);
                if (!alreadyNotified) {
                  const studentName = candidateNamesMap[ass.candidateId] || 'A student';
                  currentList.unshift({
                    id: `submit-${ass.id}`,
                    title: 'New Exam Submission',
                    message: `${studentName} has completed and submitted the "${examTitle}" exam.`,
                    time: 'Just now',
                    timestamp: Date.now(),
                    unread: true,
                    type: 'info',
                  });
                  modified = true;
                  addToast(`New submission received for ${examTitle}`, 'info');
                }
              }
            }

            // Proctoring Integrity alerts for teachers
            if (!isCandidate && ass.exam?.enableProctoring) {
              const integrityKey = `notif_integrity_${ass.id}_${ass.trustScore}`;
              const alreadyNotifiedIntegrity = localStorage.getItem(integrityKey);

              if (!alreadyNotifiedIntegrity && ass.trustScore < 65) {
                localStorage.setItem(integrityKey, 'notified');
                const studentName = candidateNamesMap[ass.candidateId] || 'A student';
                currentList.unshift({
                  id: `integrity-${ass.id}-${ass.trustScore}`,
                  title: ass.trustScore <= 35 ? 'CRITICAL: Cheating Warning' : 'Suspicious Behavior Flagged',
                  message: `${studentName} has a low trust score of ${ass.trustScore}% in "${examTitle}". Proctoring warnings flagged.`,
                  time: 'Just now',
                  timestamp: Date.now(),
                  unread: true,
                  type: 'warning',
                });
                modified = true;
                addToast(`Proctoring Alert: ${studentName} flagged in ${examTitle} (${ass.trustScore}% Trust)`, 'error');
              }
            }
          }
        });

        if (modified) {
          saveNotifications(currentList);
        }
      } catch (err) {
        console.error('Periodic notification sync failed:', err);
      }
    };

    // Run immediately then every 8 seconds
    syncWithDb();
    const interval = setInterval(syncWithDb, 8000);
    return () => clearInterval(interval);
  }, [user, notifications]);

  // ── Actions ───────────────────────────────────────────
  const handleMarkAllRead = () => {
    const updated = notifications.map(n => ({ ...n, unread: false }));
    saveNotifications(updated);
    addToast('All notifications marked as read', 'success');
  };

  const handleToggleRead = (id: string) => {
    const updated = notifications.map(n =>
      n.id === id ? { ...n, unread: !n.unread } : n
    );
    saveNotifications(updated);
  };

  const handleClearAll = () => {
    saveNotifications([]);
    addToast('Cleared all notifications', 'success');
  };

  const formatTimeLabel = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <>
      <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b shrink-0 bg-surface-card border-border transition-colors duration-200">
        {/* Left: Mobile Menu Toggle & Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => useSidebarStore.getState().toggle()}
            className="md:hidden p-1.5 rounded-xl hover:bg-surface-page transition-colors text-text-secondary hover:text-text-primary flex items-center justify-center"
            title="Open Menu"
            aria-label="Open Navigation Menu"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-sm hidden sm:inline">Home</span>
            <span className="text-text-muted text-sm hidden sm:inline">/</span>
            <span className="text-text-primary text-sm font-medium">{getPageTitle()}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Search exams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              className="pl-9 pr-4 py-2 w-64 bg-surface-page rounded-xl text-sm border border-transparent
                         focus:border-primary focus:bg-surface-card transition-all text-text-primary placeholder:text-text-muted"
            />
          </div>

          {/* Theme Toggle Button (Upright Header Only) */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-surface-container transition-colors text-text-secondary hover:text-text-primary flex items-center justify-center"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle Theme"
          >
            <span className="material-symbols-outlined text-xl">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {/* Notifications Trigger Bell */}
          <div className="relative" ref={notifRef}>
            <button
              className="relative p-2 rounded-xl hover:bg-surface-page transition-colors"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <span className="material-symbols-outlined text-text-secondary">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-cta rounded-full text-[9px] font-bold text-white leading-none">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-surface-card rounded-xl shadow-lg border border-border overflow-hidden z-50 animate-slide-up">
                <div className="p-3 border-b border-border flex items-center justify-between bg-surface-page/50">
                  <span className="font-semibold text-sm text-text-primary">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-cta hover:text-cta-hover font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-text-muted">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleToggleRead(notif.id)}
                        className={clsx(
                          "p-3 border-b border-border hover:bg-surface-container-low transition-colors cursor-pointer flex flex-col",
                          notif.unread ? 'bg-primary/5 border-l-2 border-l-primary' : 'bg-transparent'
                        )}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className={clsx(
                            "text-sm font-semibold text-text-primary",
                            notif.unread && "font-bold"
                          )}>
                            {notif.title}
                          </span>
                          <span className="text-[10px] text-text-muted tracking-tight shrink-0">
                            {formatTimeLabel(notif.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary leading-normal">{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 text-center bg-surface-page/50 border-t border-border flex justify-between px-3">
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-text-muted font-medium hover:text-danger"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      setShowAllModal(true);
                    }}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    View All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Help */}
          <button
            className="p-2 rounded-xl hover:bg-surface-page transition-colors"
            onClick={() => setShowHelp(true)}
          >
            <span className="material-symbols-outlined text-text-secondary">help_outline</span>
          </button>

          {/* User role badge */}
          {user && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-info-bg">
              <span className="material-symbols-outlined text-primary text-sm">person</span>
              <span className="text-primary text-xs font-medium capitalize">{roleLabel}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Help Modal ────────────────────────────────────── */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-card rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up border border-border">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">Help Center</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-xl mt-0.5">school</span>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Candidate Instructions</h4>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Navigate to "Exams" to launch active tests. Keep your camera and screen sharing enabled to maintain exam integrity.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 pt-3 border-t border-border">
                <span className="material-symbols-outlined text-primary text-xl mt-0.5">history</span>
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Review Score History</h4>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Completed attempt statuses and released teacher marks are visible under the "Exams Taken" history page.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW ALL NOTIFICATIONS HISTORY MODAL ───────────── */}
      {showAllModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="card w-full max-w-lg max-h-[80vh] overflow-y-auto relative animate-scale-in flex flex-col p-0">
            <div className="p-5 border-b border-border flex items-center justify-between bg-surface-page/30">
              <div>
                <h3 className="text-headline-lg font-bold text-text-primary">Notification Center</h3>
                <p className="text-caption-xs text-text-muted">Review the complete log of activity notifications.</p>
              </div>
              <button
                onClick={() => setShowAllModal(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-3 min-h-[250px]">
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-4xl text-text-muted mb-2">notifications_off</span>
                  <p className="text-sm text-text-muted">Your notification log is empty.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleToggleRead(notif.id)}
                    className={clsx(
                      "p-4 border rounded-xl flex items-start gap-3 cursor-pointer transition-all hover:bg-surface-page/30",
                      notif.unread ? "border-primary/30 bg-primary/5" : "border-white/5 bg-white/5"
                    )}
                  >
                    <span className={clsx(
                      "material-symbols-outlined p-2 rounded-lg text-lg shrink-0",
                      notif.unread ? "bg-primary/10 text-primary" : "bg-white/10 text-text-muted"
                    )}>
                      {notif.type === 'success' ? 'verified' : 'notifications'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className={clsx(
                          "text-sm font-semibold text-text-primary truncate",
                          notif.unread && "font-bold"
                        )}>
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-text-muted shrink-0">
                          {formatTimeLabel(notif.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary leading-normal mt-1">{notif.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-border bg-surface-page/30 flex justify-between">
              <button
                type="button"
                onClick={handleClearAll}
                className="btn-secondary text-xs py-1.5 hover:text-danger"
              >
                Clear Log
              </button>
              <button
                type="button"
                onClick={() => setShowAllModal(false)}
                className="btn-primary text-xs py-1.5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
