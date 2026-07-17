"use client";

import { useRef, useState } from "react";
import { fileToCompressedDataUrl } from "@/lib/images";
import { updateTheme } from "@/lib/presentations";
import { PresentationTheme, THEME_PRESETS } from "@/lib/themes";

/** Editördeki tema paneli: hazır tema, arka plan görseli ve logo yönetimi. */
export default function ThemePanel({
  presentationId,
  theme,
  onClose,
}: {
  presentationId: string;
  theme: PresentationTheme | undefined;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);

  async function apply(patch: Partial<PresentationTheme>) {
    setError(null);
    await updateTheme(presentationId, { ...theme, ...patch });
  }

  async function upload(kind: "logo" | "bgImage", file: File | undefined) {
    if (!file) return;
    setBusy(kind);
    setError(null);
    try {
      const dataUrl =
        kind === "logo"
          ? await fileToCompressedDataUrl(file, 240, 90_000)
          : await fileToCompressedDataUrl(file, 2560, 950_000);
      await apply({ [kind]: dataUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yükleme başarısız.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full bg-white shadow-2xl p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-semibold">🎨 Tema</h2>
          <button onClick={onClose} className="btn-ghost !px-3 !py-1.5 text-sm">
            Kapat
          </button>
        </div>

        <p className="eyebrow mb-3">Hazır temalar</p>
        <div className="grid grid-cols-4 gap-2 mb-8">
          {THEME_PRESETS.map((t) => (
            <button
              key={t.id}
              onClick={() => apply({ preset: t.id })}
              title={t.name}
              aria-label={`Tema: ${t.name}`}
              className={`aspect-square rounded-2xl border-2 transition-all cursor-pointer ${
                (theme?.preset ?? "kagit") === t.id
                  ? "border-accent ring-4 ring-accent-soft scale-105"
                  : "border-line hover:border-muted"
              }`}
              style={{ background: t.bg }}
            />
          ))}
        </div>

        <p className="eyebrow mb-3">Arka plan görseli</p>
        {theme?.bgImage ? (
          <div className="mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={theme.bgImage} alt="Arka plan" className="w-full h-28 object-cover rounded-2xl mb-2" />
            <button
              onClick={() => apply({ bgImage: undefined })}
              className="text-brand text-sm font-bold cursor-pointer"
            >
              Görseli kaldır
            </button>
          </div>
        ) : (
          <div className="mb-8">
            <button
              onClick={() => bgInput.current?.click()}
              disabled={busy === "bgImage"}
              className="btn-ghost w-full py-6 border-dashed"
            >
              {busy === "bgImage" ? "Sıkıştırılıyor…" : "+ Görsel yükle (büyük ekran için 2560px / ~900KB)"}
            </button>
            <input
              ref={bgInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => upload("bgImage", e.target.files?.[0])}
            />
            <p className="text-muted text-xs mt-2">
              Görsel seçilince hazır temanın önüne geçer; okunabilirlik için otomatik karartılır.
            </p>
          </div>
        )}

        <p className="eyebrow mb-3">Marka logosu</p>
        {theme?.logo ? (
          <div className="mb-6 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={theme.logo} alt="Logo" className="h-12 w-auto rounded-lg bg-paper p-1" />
            <button
              onClick={() => apply({ logo: undefined })}
              className="text-brand text-sm font-bold cursor-pointer"
            >
              Logoyu kaldır
            </button>
          </div>
        ) : (
          <div className="mb-6">
            <button
              onClick={() => logoInput.current?.click()}
              disabled={busy === "logo"}
              className="btn-ghost w-full py-4 border-dashed"
            >
              {busy === "logo" ? "Sıkıştırılıyor…" : "+ Logo yükle (PNG önerilir)"}
            </button>
            <input
              ref={logoInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => upload("logo", e.target.files?.[0])}
            />
          </div>
        )}

        {error && <p className="text-brand text-sm font-semibold">{error}</p>}
      </div>
    </div>
  );
}
