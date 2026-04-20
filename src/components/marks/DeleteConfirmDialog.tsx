"use client";

interface Props {
  examName: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({ examName, deleting, onConfirm, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="card w-full max-w-sm"
        style={{ animation: 'fadeIn .15s ease' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 32, marginBottom: 'var(--space-3)', textAlign: 'center' }}>🗑️</div>
        <h3 className="text-center font-bold mb-2">Delete Exam?</h3>
        <p className="text-sm text-center text-[var(--color-text-muted)] mb-6">
          <strong>{examName}</strong> and all associated marks will be permanently deleted. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={onCancel} disabled={deleting}>Cancel</button>
          <button
            className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 transition-colors"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
