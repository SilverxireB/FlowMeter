"use client";

/**
 * İşlem bildirimi (ekranın altında sabit şerit) + `useToast` kancası.
 *
 * Neden: silme gibi işlemler sunucuda saniyeler sürüyor (duvar/ekran silmede
 * Cloudinary temizliği de var) ama ekranda hiçbir şey olmuyordu — kullanıcı
 * "sildi mi silmedi mi" bilemiyordu. Artık işlem BAŞLARKEN dönen halkalı
 * "siliniyor…" görünür, BİTİNCE "✓ silindi"ye döner ve kendiliğinden kaybolur.
 *
 * Sayfanın neresine bakıyor olursan ol görünür (fixed, alt orta) — eski
 * sayfa-içi şeritler ekranın dışında kalabiliyordu.
 */
import { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

type Kind = "busy" | "done" | "error";

function ToastView({ text, kind }: { text: string; kind: Kind }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] max-w-[92vw] animate-pop"
    >
      <div
        className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lg border ${
          kind === "error"
            ? "bg-brand text-white border-brand-dark"
            : "bg-ink text-white border-ink"
        }`}
      >
        {kind === "busy" && (
          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" aria-hidden />
        )}
        {kind === "done" && <Icon name="check" size={16} />}
        {kind === "error" && <Icon name="warning" size={16} />}
        <span className="truncate">{text}</span>
      </div>
    </div>
  );
}

export function useToast() {
  const [state, setState] = useState<{ text: string; kind: Kind } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  /** kind="busy" kendiliğinden kaybolmaz — işlem bitince tekrar çağır. */
  const show = useCallback((text: string, kind: Kind = "done") => {
    window.clearTimeout(timer.current);
    setState({ text, kind });
    if (kind !== "busy") {
      timer.current = window.setTimeout(() => setState(null), kind === "error" ? 5000 : 2200);
    }
  }, []);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setState(null);
  }, []);

  return { show, hide, toast: state ? <ToastView {...state} /> : null };
}
