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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-lg sm:p-6">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <p className="mb-6 text-gray-700">{message}</p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={onCancel}
            className="min-h-11 rounded bg-gray-200 px-4 py-2 text-brand-navy/90 transition hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="min-h-11 rounded bg-brand-orange px-4 py-2 text-white transition hover:bg-orange-600"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
