'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
}

interface ToastContextType {
    showToast: (type: ToastType, message: string) => void;
    showSuccess: (message: string) => void;
    showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

const accentStyles: Record<ToastType, string> = {
    success: 'border-emerald-500/40 [&_svg.toast-icon]:text-emerald-600 dark:[&_svg.toast-icon]:text-emerald-400',
    error: 'border-red-500/40 [&_svg.toast-icon]:text-red-600 dark:[&_svg.toast-icon]:text-red-400',
    warning: 'border-amber-500/40 [&_svg.toast-icon]:text-amber-600 dark:[&_svg.toast-icon]:text-amber-400',
    info: 'border-blue-500/40 [&_svg.toast-icon]:text-blue-600 dark:[&_svg.toast-icon]:text-blue-400',
};

const typeIcons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="toast-icon w-4.5 h-4.5 shrink-0 mt-0.5" aria-hidden="true" />,
    error: <XCircle className="toast-icon w-4.5 h-4.5 shrink-0 mt-0.5" aria-hidden="true" />,
    warning: <AlertTriangle className="toast-icon w-4.5 h-4.5 shrink-0 mt-0.5" aria-hidden="true" />,
    info: <Info className="toast-icon w-4.5 h-4.5 shrink-0 mt-0.5" aria-hidden="true" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((type: ToastType, message: string) => {
        const id = Math.random().toString(36).slice(2);
        setToasts(prev => [...prev, { id, type, message }]);
        // Errors need more reading time than confirmations
        setTimeout(() => removeToast(id), type === 'error' ? 7000 : 4000);
    }, [removeToast]);

    const showSuccess = useCallback((message: string) => showToast('success', message), [showToast]);
    const showError = useCallback((message: string) => showToast('error', message), [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, showSuccess, showError }}>
            {children}
            <div
                className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm"
                aria-live="polite"
            >
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        role={toast.type === 'error' ? 'alert' : 'status'}
                        className={`p-3.5 rounded-lg border bg-card text-card-foreground text-sm shadow-lg ${accentStyles[toast.type]} animate-slide-in`}
                    >
                        <div className="flex items-start gap-3">
                            {typeIcons[toast.type]}
                            <span className="flex-1 leading-snug">{toast.message}</span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="shrink-0 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label="Dismiss notification"
                            >
                                <X className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

interface AlertBannerProps {
    type: ToastType;
    message: string;
    onDismiss?: () => void;
}

export function AlertBanner({ type, message, onDismiss }: AlertBannerProps) {
    const bannerStyles: Record<ToastType, string> = {
        success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        error: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
        warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
        info: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
    };

    return (
        <div role={type === 'error' ? 'alert' : 'status'} className={`p-3 rounded-md border text-sm ${bannerStyles[type]}`}>
            <div className="flex items-center justify-between gap-3">
                <span>{message}</span>
                {onDismiss && (
                    <button onClick={onDismiss} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                )}
            </div>
        </div>
    );
}
