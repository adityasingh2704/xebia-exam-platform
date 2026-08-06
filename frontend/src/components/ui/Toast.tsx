'use client';

import { create } from 'zustand';
import { useEffect, useRef, useCallback } from 'react';

/* ── Toast Types ── */
type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  removeToast: (id: string) => void;
}

/* ── Zustand Store ── */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, variant = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => {
      if (state.toasts.some((t) => t.message === message && t.variant === variant)) {
        return state;
      }
      return {
        toasts: [...state.toasts, { id, message, variant, duration }],
      };
    });
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

/* ── Variant Styles ── */
const variantStyles: Record<ToastVariant, { bg: string; icon: string; iconColor: string; border: string }> = {
  success: { bg: 'bg-success-bg', icon: 'check_circle', iconColor: 'text-emerald', border: 'border-emerald/20' },
  error: { bg: 'bg-danger-bg', icon: 'error', iconColor: 'text-danger', border: 'border-red-200' },
  info: { bg: 'bg-info-bg', icon: 'info', iconColor: 'text-primary', border: 'border-primary/20' },
  warning: { bg: 'bg-warning-bg', icon: 'warning', iconColor: 'text-warning', border: 'border-amber-200' },
};

/* ── Single Toast Item ── */
function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToastStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => removeToast(toast.id), toast.duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast.id, toast.duration, removeToast]);

  const style = variantStyles[toast.variant];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm ${style.bg} ${style.border} animate-slide-up`}
      role="alert"
    >
      <span className={`material-symbols-outlined text-xl ${style.iconColor}`}>{style.icon}</span>
      <p className="text-sm font-medium text-text-primary flex-1">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-text-muted hover:text-text-primary transition-colors"
      >
        <span className="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
  );
}

/* ── Toast Container (render once in layout) ── */
export default function ToastContainer() {
  const { toasts } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-auto">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
