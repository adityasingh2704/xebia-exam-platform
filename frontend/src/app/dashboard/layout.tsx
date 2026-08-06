'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import Sidebar from '@/components/layout/Sidebar';
import TopNav from '@/components/layout/TopNav';
import ToastContainer from '@/components/ui/Toast';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user, checkAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('xe_access_token') : null;
    if (!token && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  const hasToken = typeof window !== 'undefined' ? !!localStorage.getItem('xe_access_token') : true;

  if (!hasToken && !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-page">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation */}
        <TopNav />

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
