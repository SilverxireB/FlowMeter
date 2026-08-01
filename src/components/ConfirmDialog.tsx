"use client";

/**
 * Flow Studio ÇEKİRDEK onay penceresi + `useConfirm` kancası.
 *
 * Neden: tarayıcının kendi `confirm()` penceresi markasız görünür, mobil PWA'da
 * çirkin durur ve kurumsal/kiosk Chrome profillerinde tamamen bastırılabilir —
 * o zaman kullanıcı "sildim ama olmadı" der, oysa diyalog hiç açılmamıştır.
 * Bu bileşen her yüzeyde aynı görünür; aydınlık kokpitte de koyu perdede de.
 *
 * Kullanım (üç satır):
 *   const { confirm, dialog } = useConfirm();
 *   <button onClick={() => confirm({ title, message, danger: true }, doSil)} />
 *   {dialog}
 */
import { useCallback, useState } from "react";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Koyu yüzeyde (Sign/Wall perde/Pulse pano) açılacaksa. */
  tone?: "light" | "dark";
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Devam",
  cancelLabel = "Vazgeç",
  danger = false,
  tone = "light",
  onConfirm,
  onCancel,
}: ConfirmOptions & { onConfirm: () => void; onCancel: () => void }) {
  const dark = tone === "dark";
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 grid place-items-center p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full max-w-sm rounded-2xl p-5 animate-pop border ${
          dark ? "bg-[#1e1b4b] border-white/15 text-white" : "bg-white border-line text-ink shadow-xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display font-semibold mb-2">{title}</p>
        <p className={`text-sm leading-relaxed mb-5 whitespace-pre-line ${dark ? "text-white/75" : "text-muted"}`}>
          {message}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className={
              dark
                ? "rounded-xl bg-white/10 border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a5b4fc]/60"
                : "rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            }
          >
            {cancelLabel}
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 ${
              danger
                ? "bg-brand hover:bg-brand-dark focus-visible:ring-brand/40"
                : "bg-accent hover:bg-accent-dark focus-visible:ring-accent/40"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Onay penceresini üç satırda bağlayan kanca (native confirm yerine). */
export function useConfirm(defaults?: { tone?: "light" | "dark" }) {
  const [req, setReq] = useState<(ConfirmOptions & { run: () => void }) | null>(null);
  const confirm = useCallback((opts: ConfirmOptions, run: () => void) => setReq({ ...opts, run }), []);
  const dialog = req ? (
    <ConfirmDialog
      {...req}
      tone={req.tone ?? defaults?.tone ?? "light"}
      onConfirm={() => {
        req.run();
        setReq(null);
      }}
      onCancel={() => setReq(null)}
    />
  ) : null;
  return { confirm, dialog };
}
