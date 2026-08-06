'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { examApi, questionApi, userApi, tenantApi } from '@/lib/api';

import PlatformAdminDashboard from './_components/PlatformAdminDashboard';
import TenantAdminDashboard from './_components/TenantAdminDashboard';
import TeacherDashboard from './_components/TeacherDashboard';
import CandidateDashboard from './_components/CandidateDashboard';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const currentRole = user?.role || 'TEACHER';

  const [stats, setStats] = useState<any>({ totalExams: 0, totalQuestions: 0, totalUsers: 0, totalTenants: 0 });
  const [recentExams, setRecentExams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      try {
        const [examsRes, questionsRes, usersRes, incidentsRes, assignmentsRes] = await Promise.allSettled([
          examApi.list({ 
            limit: 100, 
            tenantId: user?.tenantId,
            ...(currentRole === 'CANDIDATE' && { candidateId: user?.id })
          }),
          questionApi.list({ limit: 1000, tenantId: user?.tenantId }),
          userApi.list({ limit: 1000, tenantId: user?.tenantId }),
          examApi.getIncidents('all'),
          examApi.listAssignments({ tenantId: user?.tenantId }),
        ]);

        let examData: any[] = [];
        let totalQuestions = 0;
        let totalUsers = 0;
        let pendingIncidents = 0;
        let averageScore = '-';

        if (examsRes.status === 'fulfilled') {
          const resData = examsRes.value.data;
          if (Array.isArray(resData)) examData = resData;
          else if (Array.isArray(resData?.data?.data)) examData = resData.data.data;
          else if (Array.isArray(resData?.data?.items)) examData = resData.data.items;
          else if (Array.isArray(resData?.data?.exams)) examData = resData.data.exams;
          else if (Array.isArray(resData?.data)) examData = resData.data;
          else if (Array.isArray(resData?.exams)) examData = resData.exams;
        }
        if (questionsRes.status === 'fulfilled') {
          const resObj = questionsRes.value.data;
          let list: any[] = [];
          if (Array.isArray(resObj)) list = resObj;
          else if (Array.isArray(resObj?.data?.data)) list = resObj.data.data;
          else if (Array.isArray(resObj?.data?.items)) list = resObj.data.items;
          else if (Array.isArray(resObj?.data?.questions)) list = resObj.data.questions;
          else if (Array.isArray(resObj?.data)) list = resObj.data;
          else if (Array.isArray(resObj?.items)) list = resObj.items;
          else if (Array.isArray(resObj?.questions)) list = resObj.questions;

          totalQuestions = resObj?.data?.meta?.total ?? resObj?.meta?.total ?? resObj?.total ?? list.length;
        }
        if (usersRes.status === 'fulfilled') {
          const d = usersRes.value.data?.data || usersRes.value.data;
          totalUsers = d?.total || (Array.isArray(d) ? d.length : d?.data?.length || 0);
        }
        if (incidentsRes.status === 'fulfilled') {
          const d = incidentsRes.value.data?.data || incidentsRes.value.data || [];
          if (Array.isArray(d)) {
            pendingIncidents = d.filter((inc: any) => inc.reviewerDecision === 'PENDING').length;
          }
        }
        if (assignmentsRes.status === 'fulfilled') {
          const d = assignmentsRes.value.data?.data || assignmentsRes.value.data || [];
          if (Array.isArray(d)) {
            const graded = d.filter((a: any) => a.status === 'GRADED' && typeof a.score === 'number');
            if (graded.length > 0) {
              const avg = graded.reduce((sum: number, a: any) => sum + (a.score || 0), 0) / graded.length;
              averageScore = `${avg.toFixed(1)}%`;
            }
          }
        }

        let totalTenants = 0;
        if (currentRole === 'PLATFORM_ADMIN') {
          try {
            const tenantsRes = await tenantApi.list();
            const d = tenantsRes.data?.data || tenantsRes.data;
            totalTenants = Array.isArray(d) ? d.length : d?.total || 0;
          } catch { /* ignore */ }
        }

        setStats({
          totalExams: examData.length,
          totalQuestions,
          totalUsers,
          totalTenants,
          pendingIncidents,
          averageScore,
        });
        setRecentExams(examData.slice(0, 5));
      } catch {
        // Defaults already set
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [currentRole, user?.id, user?.tenantId]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-headline-xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-body-sm text-text-muted mt-1">
          Welcome back{user ? `, ${user.firstName}` : ''}! Here&apos;s an overview of your workspace.
        </p>
      </div>

      {currentRole === 'PLATFORM_ADMIN' && (
        <PlatformAdminDashboard stats={stats} isLoading={isLoading} />
      )}
      
      {currentRole === 'TENANT_ADMIN' && (
        <TenantAdminDashboard stats={stats} recentExams={recentExams} isLoading={isLoading} formatDate={formatDate} />
      )}
      
      {currentRole === 'TEACHER' && (
        <TeacherDashboard stats={stats} recentExams={recentExams} isLoading={isLoading} formatDate={formatDate} />
      )}
      
      {currentRole === 'CANDIDATE' && (
        <CandidateDashboard recentExams={recentExams} isLoading={isLoading} formatDate={formatDate} />
      )}
    </div>
  );
}
