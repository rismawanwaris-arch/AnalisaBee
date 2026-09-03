
import { useEffect, useState, type ReactNode } from "react";

interface ConfirmDeleteModalProps {
  open: boolean;
  title: string;
  description: ReactNode;
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
    if (open) {
      const timer = setTimeout(() => setTyped(""), 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!open) return null;

  const matches = typed === confirmText;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-surface p-6 shadow-2xl space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 grid place-items-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            <div className="text-xs text-muted mt-1 leading-relaxed">{description}</div>
          </div>
        </div>

        <div className="pt-1">
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Ketik <span className="font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">{confirmText}</span> untuk konfirmasi
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-border/80 bg-surface-subtle px-3.5 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
            placeholder={confirmText}
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-border/80 bg-surface hover:bg-surface-hover px-4 py-2 text-xs font-semibold text-foreground transition-all disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || busy}
            className="rounded-xl bg-rose-600 text-white px-4 py-2 text-xs font-semibold hover:bg-rose-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
          >
            {busy ? "Menghapus..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
