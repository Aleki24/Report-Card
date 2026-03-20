'use client';

import React, { useEffect, useCallback } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
};

export function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
    const handleEscape = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleEscape]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <div
                className={`card w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto`}
                style={{ animation: 'fadeIn .2s ease' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold font-[family-name:var(--font-display)]">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-[var(--color-surface-raised)] transition-colors"
                        aria-label="Close"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                {children}
                {footer && (
                    <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-[var(--color-border)]">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'default';
    loading?: boolean;
}

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
    loading = false,
}: ConfirmDialogProps) {
    const confirmButtonClass = variant === 'danger'
        ? 'bg-red-500 hover:bg-red-600 text-white'
        : variant === 'warning'
            ? 'bg-amber-500 hover:bg-amber-600 text-white'
            : 'btn-primary';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <p className="text-[var(--color-text-secondary)] mb-6">{message}</p>
            <div className="flex gap-3 justify-end">
                <button className="btn-secondary" onClick={onClose} disabled={loading}>
                    {cancelText}
                </button>
                <button className={`${confirmButtonClass} disabled:opacity-50`} onClick={onConfirm} disabled={loading}>
                    {loading ? 'Processing...' : confirmText}
                </button>
            </div>
        </Modal>
    );
}
