import React from 'react';

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationDialog({ open, title, message, onConfirm, onCancel }: ConfirmationDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-primary/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-surface p-5 shadow-lg sm:p-6">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="mb-6 text-text-primary">{message}</p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={onCancel}
            className="min-h-11 rounded bg-secondary px-4 py-2 text-primary/90 transition hover:bg-border-subtle"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="min-h-11 rounded bg-accent px-4 py-2 text-white transition hover:bg-accent"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
