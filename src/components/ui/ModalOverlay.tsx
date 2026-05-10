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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className={`card w-full ${maxWidth} ${className}`}
        style={{ animation: 'fadeIn .2s ease', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
