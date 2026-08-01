"use client";

/**
 * FlowSign onay penceresi — kritik içerik-taşıma/silme bilgisi native confirm()
 * yerine markalı, okunur bir pencerede. (Kiosk/kurumsal Chrome profillerinde
 * native diyaloglar bastırılabiliyor; ayrıca UI'nın en "bitmemiş" anıydı.)
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Devam",
  cancelLabel = "Vazgeç",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 grid place-items-center p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-2xl bg-white border border-line p-5 shadow-xl animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display font-semibold mb-2 text-ink">{title}</p>
        <p className="text-sm text-muted leading-relaxed mb-5 whitespace-pre-line">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="rounded-xl bg-white border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper focus-visible:ring-4 focus-visible:ring-accent-soft">
            {cancelLabel}
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white focus-visible:ring-4 focus-visible:ring-accent-soft ${
              danger ? "bg-brand hover:bg-brand-dark" : "bg-accent hover:bg-accent-dark"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
