'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useTheme } from '@/components/theme/ThemeProvider';

export default function RegisterPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'CANDIDATE' | 'TEACHER' | 'TENANT_ADMIN' | 'PLATFORM_ADMIN'>('CANDIDATE');
  const [tenantSlug, setTenantSlug] = useState('');
  const [tenantName, setTenantName] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Password rules validation
  const passLength = password.length >= 10;
  const passUpper = /[A-Z]/.test(password);
  const passLower = /[a-z]/.test(password);
  const passNumber = /[0-9]/.test(password);
  const passSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  
  const strengthScore = [passLength, passUpper, passLower, passNumber, passSpecial].filter(Boolean).length;
  
  const getStrengthLabel = () => {
    if (!password) return '';
    if (strengthScore <= 2) return 'Weak';
    if (strengthScore <= 4) return 'Good';
    return 'Strong';
  };

  const getStrengthColor = () => {
    if (strengthScore <= 2) return 'bg-danger';
    if (strengthScore <= 4) return 'bg-amber';
    return 'bg-emerald';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate strength before submit
    if (strengthScore < 5) {
      setError('Please satisfy all password complexity requirements.');
      return;
    }

    setIsLoading(true);
    try {
      const payload: Record<string, any> = {
        firstName,
        lastName,
        email,
        password,
        role,
      };

      if (role === 'TENANT_ADMIN') {
        payload.tenantName = tenantName;
        payload.tenantSlug = tenantSlug;
      } else if (role !== 'PLATFORM_ADMIN') {
        payload.tenantSlug = tenantSlug;
      }

      await authApi.register(payload);
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error?.message || 'Registration failed. Please check details and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-surface-page relative">
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
        <div className="absolute inset-0 bg-gradient-to-br from-primary-dark via-primary to-primary-bright opacity-90" />
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

          <div className="space-y-6">
            <h2 className="text-white text-4xl font-bold leading-tight">
              Join the<br />
              Next-Gen AI<br />
              Assessment<br />
              Community
            </h2>
            <p className="text-white/70 text-lg max-w-md">
              Create an account to build high-quality exams, oversee AI-proctored sessions, or take tests within a secure cloud-native portal.
            </p>
          </div>

          <div className="text-white/40 text-xs">
            © {new Date().getFullYear()} Xebia. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-lg space-y-6 py-8 animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <img src="/Logo-Purple.png" alt="Xe-Recruits Logo" className="h-10 w-auto" />
            <h1 className="text-primary font-bold text-xl">Xe-Recruits</h1>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-headline-2xl font-bold text-text-primary">Create an account</h2>
            <p className="text-body-base text-text-muted">
              Choose your role and register to get started
            </p>
          </div>

          {/* Success Banner */}
          {success && (
            <div className="p-4 rounded-xl bg-success-bg border border-emerald/20 text-sm font-medium text-emerald text-center space-y-2 animate-slide-up">
              <p className="font-semibold text-lg">Registration Successful!</p>
              <p className="text-xs">Your account has been registered. Redirecting to login page...</p>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-danger-bg border border-red-200 text-sm font-medium text-danger animate-slide-up">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-danger text-xl">error</span>
                <p>{error}</p>
              </div>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Role Selection */}
              <div>
                <label className="input-label">Select Your Role</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  {[
                    { value: 'CANDIDATE', label: 'Candidate', icon: 'school' },
                    { value: 'TEACHER', label: 'Teacher', icon: 'person' },
                    { value: 'TENANT_ADMIN', label: 'Tenant Admin', icon: 'corporate_fare' },
                    { value: 'PLATFORM_ADMIN', label: 'Platform Admin', icon: 'admin_panel_settings' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setRole(item.value as any);
                        setTenantSlug('');
                        setTenantName('');
                      }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all duration-200 ${
                        role === item.value
                          ? 'border-cta bg-cta/5 text-cta shadow-sm font-semibold'
                          : 'border-border hover:bg-surface-container text-text-secondary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                      <span className="text-[11px] uppercase tracking-wide">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label" htmlFor="firstName">First Name</label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    className="input"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="lastName">Last Name</label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    className="input"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="input-label" htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  required
                  className="input"
                  placeholder="you@organisation.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Tenant Details (Conditional) */}
              {role === 'TENANT_ADMIN' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-surface-container rounded-xl border border-border animate-slide-up">
                  <div>
                    <label className="input-label">Organisation Name</label>
                    <input
                      type="text"
                      required
                      className="input"
                      placeholder="Acme University"
                      value={tenantName}
                      onChange={(e) => {
                        setTenantName(e.target.value);
                        setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                      }}
                    />
                  </div>
                  <div>
                    <label className="input-label">Organisation Slug</label>
                    <input
                      type="text"
                      required
                      className="input"
                      placeholder="acme-university"
                      value={tenantSlug}
                      onChange={(e) => setTenantSlug(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {(role === 'CANDIDATE' || role === 'TEACHER') && (
                <div className="p-4 bg-surface-container rounded-xl border border-border animate-slide-up">
                  <label className="input-label">Organisation Slug to Join</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="acme-university"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                  />
                  <p className="text-[10px] text-text-muted mt-1.5">
                    Contact your administrator if you do not know the organisation slug.
                  </p>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="input-label" htmlFor="password">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="input pr-10"
                    placeholder="Choose a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

                {/* Password Strength Meter */}
                {password && (
                  <div className="mt-3 space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted">Password Strength:</span>
                      <span className="font-semibold text-text-primary">{getStrengthLabel()}</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface-page rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${getStrengthColor()}`}
                        style={{ width: `${(strengthScore / 5) * 100}%` }}
                      />
                    </div>

                    {/* Requirements checklist */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-[11px]">
                      <div className={`flex items-center gap-1.5 ${passLength ? 'text-emerald' : 'text-text-muted'}`}>
                        <span className="material-symbols-outlined text-sm">{passLength ? 'check_circle' : 'cancel'}</span>
                        At least 10 chars
                      </div>
                      <div className={`flex items-center gap-1.5 ${passUpper ? 'text-emerald' : 'text-text-muted'}`}>
                        <span className="material-symbols-outlined text-sm">{passUpper ? 'check_circle' : 'cancel'}</span>
                        Uppercase letter
                      </div>
                      <div className={`flex items-center gap-1.5 ${passLower ? 'text-emerald' : 'text-text-muted'}`}>
                        <span className="material-symbols-outlined text-sm">{passLower ? 'check_circle' : 'cancel'}</span>
                        Lowercase letter
                      </div>
                      <div className={`flex items-center gap-1.5 ${passNumber ? 'text-emerald' : 'text-text-muted'}`}>
                        <span className="material-symbols-outlined text-sm">{passNumber ? 'check_circle' : 'cancel'}</span>
                        At least 1 number
                      </div>
                      <div className={`flex items-center gap-1.5 ${passSpecial ? 'text-emerald' : 'text-text-muted'}`}>
                        <span className="material-symbols-outlined text-sm">{passSpecial ? 'check_circle' : 'cancel'}</span>
                        Special character
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="btn-cta w-full py-3"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-2" />
                    Registering Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          )}

          {/* Redirection Link */}
          <div className="text-center text-sm mt-4">
            <span className="text-text-muted">Already have an account? </span>
            <button
              type="button"
              className="text-cta hover:text-cta-hover font-semibold transition-colors"
              onClick={() => router.push('/login')}
            >
              Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
