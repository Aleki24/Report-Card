'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

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

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((type: ToastType, message: string) => {
        const id = Math.random().toString(36).slice(2);
        setToasts(prev => [...prev, { id, type, message }]);
        setTimeout(() => removeToast(id), 4000);
    }, [removeToast]);

    const showSuccess = useCallback((message: string) => showToast('success', message), [showToast]);
    const showError = useCallback((message: string) => showToast('error', message), [showToast]);

    const typeStyles: Record<ToastType, string> = {
        success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        error: 'bg-red-500/10 text-red-400 border-red-500/30',
        warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    };

    return (
        <ToastContext.Provider value={{ showToast, showSuccess, showError }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`p-4 rounded-md border text-sm ${typeStyles[toast.type]} animate-slide-in`}
                    >
                        <div className="flex items-start gap-3">
                            <span>{toast.message}</span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="opacity-60 hover:opacity-100"
                            >
                                ×
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
    const typeStyles: Record<ToastType, string> = {
        success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        error: 'bg-red-500/10 text-red-400 border-red-500/30',
        warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    };

    return (
        <div className={`p-3 rounded-md border text-sm ${typeStyles[type]}`}>
            <div className="flex items-center justify-between gap-3">
                <span>{message}</span>
                {onDismiss && (
                    <button onClick={onDismiss} className="opacity-60 hover:opacity-100">×</button>
                )}
            </div>
        </div>
    );
}
