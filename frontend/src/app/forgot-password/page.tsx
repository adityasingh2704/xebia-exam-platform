'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useTheme } from '@/components/theme/ThemeProvider';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setDevToken(null);

    try {
      const response = await authApi.requestPasswordReset(email);
      setSuccess(true);
      // Capture the dev token if returned
      if (response.data?.data?.devToken) {
        setDevToken(response.data.data.devToken);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to request password reset. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-page p-6 relative">
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
      <div className="card w-full max-w-md space-y-6 animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center justify-center mb-2">
          <img src="/Logo-Purple.png" alt="Xe-Recruits Logo" className="h-14 w-auto mb-2" />
          <h1 className="text-primary font-bold text-lg">Xe-Recruits</h1>
        </div>

        <div className="text-center space-y-1.5">
          <h2 className="text-headline-xl font-bold text-text-primary">Forgot Password?</h2>
          <p className="text-body-sm text-text-muted">
            Enter your email address and we'll help you reset your password.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-danger-bg border border-red-200 text-sm font-medium text-danger animate-slide-up">
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-4 animate-slide-up">
            <div className="p-4 rounded-xl bg-success-bg border border-emerald/20 text-sm font-medium text-emerald text-center">
              <p className="font-semibold text-base mb-1">Request Received</p>
              <p className="text-xs text-text-muted">If the email exists, a password reset link has been processed.</p>
            </div>

            {/* Dev Helper Callout */}
            {devToken && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-xs text-text-secondary space-y-2">
                <p className="font-semibold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">info</span>
                  Development Mode Helper
                </p>
                <p className="text-text-muted">
                  Since there is no active email server, use the link below to test the reset password flow directly:
                </p>
                <button
                  type="button"
                  onClick={() => router.push(`/reset-password?token=${devToken}`)}
                  className="w-full text-center py-2 px-3 bg-cta text-white font-medium rounded-lg hover:bg-cta-hover transition-colors"
                >
                  Reset Password Now
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full text-center py-2 text-sm text-text-muted hover:text-text-primary font-medium"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="input-label" htmlFor="reset-email">Email Address</label>
              <input
                id="reset-email"
                type="email"
                required
                className="input"
                placeholder="you@organisation.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-cta w-full py-2.5"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-2" />
                  Sending Request...
                </>
              ) : (
                'Request Reset Link'
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full text-center py-2 text-sm text-text-muted hover:text-text-primary font-medium"
            >
              Cancel and Return
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
