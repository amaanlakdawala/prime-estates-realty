'use client';

import { useEffect, useRef } from 'react';

export default function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel, busy = false, busyLabel = 'Deleting…' }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }} className="w-[min(92vw,26rem)] rounded-xl p-0 backdrop:bg-basalt/60">
      <div className="p-6">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-[15px] text-basalt/80">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
