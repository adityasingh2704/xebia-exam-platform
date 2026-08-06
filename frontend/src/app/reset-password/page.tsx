'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      if (token) {
        await authApi.confirmPasswordReset(token, password);
      } else {
        const currentPassword = 'TemporaryPassword@123';
        await authApi.firstLoginReset(currentPassword, password, confirmPassword);
      }
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="text-center space-y-1.5">
        <h2 className="text-headline-xl font-bold text-text-primary">Reset Password</h2>
        <p className="text-body-sm text-text-muted">
          {token ? 'Create a secure new password for your account' : 'Please update your temporary password to secure your account'}
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger-bg border border-red-200 text-sm font-medium text-danger">
          {error}
        </div>
      )}

      {success ? (
        <div className="p-4 rounded-xl bg-success-bg border border-emerald/20 text-sm font-medium text-emerald text-center space-y-2">
          <p>Password reset successful!</p>
          <p className="text-caption-xs text-text-muted">Redirecting to login page...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label" htmlFor="new-password">New Password</label>
            <input
              id="new-password"
              type="password"
              className="input"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="input-label" htmlFor="confirm-password">Confirm Password</label>
            <input
              id="confirm-password"
              type="password"
              className="input"
              placeholder="Confirm your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-cta w-full"
          >
            {isLoading ? 'Resetting password...' : 'Update Password'}
          </button>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-page p-6">
      <div className="card w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center justify-center mb-2">
          <img src="/Logo-Purple.png" alt="Xe-Recruits Logo" className="h-14 w-auto mb-2" />
          <h1 className="text-primary font-bold text-lg">Xe-Recruits</h1>
        </div>

        <Suspense fallback={
          <div className="text-center py-8">
            <span className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin inline-block" />
            <p className="text-sm text-text-muted mt-2">Loading password reset details...</p>
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
