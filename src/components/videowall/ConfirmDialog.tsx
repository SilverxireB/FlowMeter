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
        className="w-full max-w-sm rounded-2xl bg-[#1e1b4b] border border-white/15 p-5 animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display font-semibold mb-2 text-white">{title}</p>
        <p className="text-sm text-white/75 leading-relaxed mb-5 whitespace-pre-line">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="rounded-xl bg-white/10 border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-[#a5b4fc]/60">
            {cancelLabel}
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-[#a5b4fc]/60 ${
              danger ? "bg-rose-500 hover:bg-rose-600" : "bg-accent hover:bg-accent-dark"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
