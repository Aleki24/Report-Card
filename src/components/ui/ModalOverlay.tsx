"use client";

import React from 'react';

interface ModalOverlayProps {
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
  className?: string;
}

export function ModalOverlay({ children, onClose, maxWidth = 'max-w-lg', className = '' }: ModalOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`card w-full ${maxWidth} max-h-[90vh] overflow-y-auto animate-fade-in ${className}`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
