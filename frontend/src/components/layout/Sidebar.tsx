'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { useAuthStore } from '@/stores/authStore';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: string[]; // if specified, only show for these roles
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
      { label: 'Analytics', href: '/dashboard/analytics', icon: 'analytics', roles: ['TENANT_ADMIN', 'TEACHER'] },
    ],
  },
  {
    title: 'Assessment',
    items: [
      { label: 'Exams', href: '/dashboard/exams', icon: 'quiz', roles: ['TEACHER', 'CANDIDATE'] },
      { label: 'Exams Taken', href: '/dashboard/exams-taken', icon: 'history', roles: ['CANDIDATE'] },
      { label: 'Review Submissions', href: '/dashboard/submissions', icon: 'grading', roles: ['TEACHER', 'PROCTOR'] },
      { label: 'Question Bank', href: '/dashboard/questions', icon: 'help_center', roles: ['TEACHER'] },
      { label: 'Coding Questions', href: '/dashboard/coding', icon: 'code', roles: ['CANDIDATE'] },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Users', href: '/dashboard/users', icon: 'group', roles: ['TENANT_ADMIN'] },
      { label: 'Candidates', href: '/dashboard/candidates', icon: 'school', roles: ['TENANT_ADMIN', 'TEACHER', 'PROCTOR'] },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { label: 'Live Proctoring', href: '/dashboard/proctoring', icon: 'videocam', roles: ['PROCTOR'] },
      { label: 'Incidents', href: '/dashboard/incidents', icon: 'warning', roles: ['TEACHER', 'PROCTOR'] },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Tenants', href: '/dashboard/tenants', icon: 'apartment', roles: ['PLATFORM_ADMIN'] },
      { label: 'Plans & Billing', href: '/dashboard/billing', icon: 'receipt_long', roles: ['PLATFORM_ADMIN'] },
      { label: 'Global Configurations', href: '/dashboard/settings', icon: 'settings', roles: ['TENANT_ADMIN'] },
      { label: 'Audit Log', href: '/dashboard/audit', icon: 'history', roles: ['PLATFORM_ADMIN', 'TENANT_ADMIN'] },
    ],
  },
  {
    title: 'My Data',
    items: [
      { label: 'Data Requests', href: '/dashboard/dsar', icon: 'privacy_tip', roles: ['CANDIDATE'] },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const userRole = user?.role || 'TEACHER';
  const userName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Guest User';
  const userEmail = user?.email || '';
  const userInitials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'
    : 'GU';

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    window.location.href = '/login';
    await logout();
  };

  // Filter nav items by role
  const filteredNavigation = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.roles) return true;
        return item.roles.includes(userRole);
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className="w-[220px] min-w-[220px] flex flex-col h-full"
      style={{ background: '#6C1D5F' }}
    >
      {/* Logo Header */}
      <div
        className="px-5 py-4 flex items-center gap-3 min-h-[64px]"
        style={{ background: '#4A1E47', borderBottom: '1px solid rgba(255,255,255,0.10)' }}
      >
        <img src="/Logo-White.png" alt="Xe-Recruits Logo" className="h-8 w-auto flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-white font-bold text-sm leading-tight truncate">Xe-Recruits</h1>
          <p className="text-white/50 text-[10px]">by Xebia</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {filteredNavigation.map((group) => (
          <div key={group.title} className="mb-1">
            <div className="sidebar-group">{group.title}</div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    isActive(item.href) ? 'sidebar-item-active' : 'sidebar-item',
                  )}
                >
                  <span className="material-symbols-outlined text-lg">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Section */}
      <div
        className="p-4 mt-auto"
        style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}
      >

        {/* User info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cta/20 flex items-center justify-center flex-shrink-0">
            <span className="text-cta text-xs font-bold">{userInitials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-medium truncate">
              {userName || userRole.replace('_', ' ')}
            </p>
            <p className="text-white/40 text-[10px] truncate">{userEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-white/40 hover:text-white transition-colors"
            title="Sign out"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
