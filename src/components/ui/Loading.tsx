'use client';

import React from 'react';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
    return (
        <svg
            className={`animate-spin ${sizeClasses[size]} ${className}`}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
            />
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
    );
}

export function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
    return (
        <div role="status" className="flex flex-col items-center justify-center gap-4 py-12">
            <Spinner size="lg" className="text-primary" />
            <p className="text-muted-foreground">{message}</p>
        </div>
    );
}

export function LoadingOverlay({ show }: { show?: boolean }) {
    if (!show) return null;
    return (
        <div role="status" aria-label="Loading" className="absolute inset-0 bg-card/80 backdrop-blur-[2px] flex items-center justify-center z-50">
            <Spinner size="lg" className="text-primary" />
        </div>
    );
}
