'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/components/theme/ThemeProvider';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tenantSlug, setTenantSlug] = useState('');
  const [showTenantField, setShowTenantField] = useState(false);

  useEffect(() => {
    // Pre-warm backend microservices silently when user opens login page
    const prewarm = async () => {
      try {
        const gatewayUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://xe-api-gateway.onrender.com/api/v1')
          .replace(/\/$/, '')
          .replace(/\/api\/v1\/?$/, '');
        fetch(`${gatewayUrl}/health`).catch(() => {});
        fetch(`https://xe-auth-service.onrender.com/api/v1/health`).catch(() => {});
      } catch {
        // ignore
      }
    };
    prewarm();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await login(email, password, tenantSlug || undefined);
      router.push('/dashboard');
    } catch {
      // Error is handled by the store
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    clearError();

    try {
      await login(demoEmail, demoPassword);
      router.push('/dashboard');
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Theme Toggle Button (Top Right Header Icon Only) */}
      <div className="absolute top-6 right-6 z-30">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-surface-card border border-border text-text-secondary hover:text-text-primary hover:bg-surface-container transition-all shadow-sm flex items-center justify-center"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
        >
          <span className="material-symbols-outlined text-xl">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
      </div>
      {/* Left Panel — Brand */}
      <div className="hidden lg:flex lg:w-[45%] bg-primary relative overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-dark via-primary to-primary-bright opacity-90" />

        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full border border-white/30" />
          <div className="absolute bottom-32 right-16 w-96 h-96 rounded-full border border-white/20" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full border border-white/10" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <img src="/Logo-White.png" alt="Xe-Recruits Logo" className="h-10 w-auto" />
              <div>
                <h1 className="text-white font-bold text-xl tracking-tight">Xe-Recruits</h1>
                <p className="text-white/60 text-xs">by Xebia</p>
              </div>
            </div>
          </div>

          {/* Hero content */}
          <div className="space-y-6">
            <h2 className="text-white text-4xl font-bold leading-tight">
              Enterprise<br />
              AI-Proctored<br />
              Examination<br />
              Platform
            </h2>
            <p className="text-white/70 text-lg max-w-md">
              Conduct secure, scalable assessments with real-time AI monitoring,
              comprehensive analytics, and multi-tenant architecture.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-4">
              {['MCQ', 'MRQ', 'Coding', 'AI Proctoring', 'Live Monitor', 'Analytics'].map((feature) => (
                <span
                  key={feature}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/90 backdrop-blur-sm border border-white/10"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-white/40 text-xs">
            © {new Date().getFullYear()} Xebia. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-surface-page">
        <div className="w-full max-w-md animate-fade-in">
          {/* Centered Logo & Header */}
          <div className="flex flex-col items-center mb-8">
            <img src="/Logo-Purple.png" alt="Xe-Recruits Logo" className="h-16 w-auto mb-4" />
            <h2 className="text-headline-2xl font-bold text-text-primary text-center">Welcome Back</h2>
            <p className="text-body-base text-text-muted text-center mt-1">
              Access the secure Xe-Recruits Admin
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-danger-bg border border-red-200 animate-slide-up">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-danger text-xl mt-0.5">error</span>
                <div>
                  <p className="text-sm font-medium text-danger">{error}</p>
                </div>
              </div>
            </div>
          )}



          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {showTenantField && (
              <div className="animate-slide-up">
                <label className="input-label" htmlFor="tenant-slug">
                  Organisation Slug
                </label>
                <input
                  id="tenant-slug"
                  type="text"
                  className="input"
                  placeholder="acme-university"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="input-label" htmlFor="login-email">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                className="input"
                placeholder="you@organisation.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="input-label !mb-0" htmlFor="login-password">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-cta hover:text-cta-hover font-medium"
                  onClick={() => router.push('/forgot-password')}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-cta w-full"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>

          {/* Tenant toggle */}
          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-xs text-text-muted hover:text-primary transition-colors"
              onClick={() => setShowTenantField(!showTenantField)}
            >
              {showTenantField ? 'Hide' : 'Show'} organisation field
            </button>
          </div>

          {/* Registration Redirect */}
          <div className="mt-4 text-center text-sm">
            <span className="text-text-muted">Don't have an account? </span>
            <button
              type="button"
              className="text-cta hover:text-cta-hover font-semibold transition-colors animate-pulse"
              onClick={() => router.push('/register')}
            >
              Sign Up
            </button>
          </div>

          {/* Demo Users Section */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-caption-xs text-text-muted uppercase tracking-wider mb-3">
              Demo Accounts
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Platform Admin', email: 'admin@acme.edu', password: 'Admin@123', color: 'bg-primary' },
                { label: 'Tenant Admin', email: 'tenantadmin@acme.edu', password: 'Admin@123', color: 'bg-cta' },
                { label: 'Teacher', email: 'teacher@acme.edu', password: 'Admin@123', color: 'bg-emerald' },
                { label: 'Proctor', email: 'proctor@acme.edu', password: 'Admin@123', color: 'bg-purple-600' },
                { label: 'Candidate', email: 'john.doe@student.acme.edu', password: 'Admin@123', color: 'bg-blue-500' },
              ].map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => handleDemoLogin(demo.email, demo.password)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-surface-container transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${demo.color}`} />
                  {demo.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
