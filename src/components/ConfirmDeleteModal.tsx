"use client";

import { useEffect, useState, type ReactNode } from "react";

interface ConfirmDeleteModalProps {
  open: boolean;
  title: string;
  description: ReactNode;
  /** The exact text the user must retype before the delete button unlocks. */
  confirmText: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({
  open,
  title,
  description,
  confirmText,
  confirmLabel = "Hapus Permanen",
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  if (!open) return null;

  const matches = typed === confirmText;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <div className="text-sm text-muted mt-2">{description}</div>

        <label className="block text-xs text-muted mt-4 mb-1">
          Ketik <span className="font-mono text-foreground">{confirmText}</span> untuk konfirmasi
        </label>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-negative"
          placeholder={confirmText}
        />

        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-hover disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || busy}
            className="rounded-md bg-negative text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "Menghapus..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
