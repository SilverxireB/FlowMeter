"use client";

/**
 * Kokpit ilk-kullanım rehberi — duvar tazeyken "3 adımda başla" kartı. Canlı
 * durum (adımlar tamamlandıkça ✓), kapatılabilir (localStorage). Ürüne
 * profesyonel bir giriş; deneyimli sahip "Gizle" ile kaldırır.
 */
import { useEffect, useState } from "react";
import { downloadQrCard } from "@/components/WallQrCard";
import { usePlayTarget } from "@/lib/usePlayTarget";
import { setWallModeration } from "@/lib/walls";
import { Wall } from "@/lib/types";

function Step({ done, icon, title, children }: { done: boolean; icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className={`shrink-0 w-7 h-7 rounded-full grid place-items-center text-sm font-bold ${done ? "bg-[#1baf7a] text-white" : "bg-paper border border-line text-muted"}`}>
        {done ? "✓" : icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-ink">{title}</p>
        <div className="text-sm text-muted mt-0.5">{children}</div>
      </div>
    </div>
  );
}

export default function WallOnboarding({
  wall,
  joinUrl,
  mediaCount,
  onGoSettings,
}: {
  wall: Wall;
  joinUrl: string;
  mediaCount: number;
  onGoSettings: () => void;
}) {
  const key = `flowwall.onboard.${wall.id}`;
  const playTarget = usePlayTarget();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    setHidden(typeof localStorage !== "undefined" && localStorage.getItem(key) === "1");
  }, [key]);

  if (hidden) return null;

  const themed = !!(wall.headline || wall.theme?.preset || wall.theme?.bgImage);
  const started = mediaCount > 0;

  function dismiss() {
    try { localStorage.setItem(key, "1"); } catch { /* yok say */ }
    setHidden(true);
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(joinUrl); } catch { /* yok say */ }
  }

  return (
    <div className="card p-5 border-accent/30 bg-accent/[0.03]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="eyebrow text-accent">Başlangıç</p>
          <h2 className="font-display text-lg font-bold text-ink mt-0.5">
            {started ? "Duvarın canlı! 🎉" : "Duvarın hazır — 3 adımda başla"}
          </h2>
        </div>
        <button onClick={dismiss} className="text-muted hover:text-ink text-sm shrink-0">Gizle ✕</button>
      </div>

      <div className="flex flex-col gap-4">
        <Step done={false} icon="1" title="📽 Perde ekranını aç">
          Etkinlik ekranına/projeksiyona{" "}
          <a href={`/wall/${wall.id}`} target={playTarget} className="text-accent font-semibold underline">
            perde ekranını
          </a>{" "}
          yansıt — anılar orada canlı akacak.
        </Step>

        <Step done={false} icon="2" title="📱 Katılım kodunu paylaş">
          <span className="font-display font-bold tracking-[0.15em] text-ink">{wall.joinCode || "——————"}</span> — misafirler{" "}
          <span className="font-mono text-xs">/{"u/" + wall.joinCode}</span> adresinden katılır.
          <div className="flex flex-wrap gap-2 mt-2">
            <button onClick={() => downloadQrCard(wall, joinUrl)} disabled={!wall.joinCode} className="btn-ghost !py-1.5 !px-3 text-xs">🖨 QR kartı indir</button>
            <button onClick={copyLink} disabled={!joinUrl} className="btn-ghost !py-1.5 !px-3 text-xs">🔗 Bağlantıyı kopyala</button>
          </div>
        </Step>

        <Step done={started} icon="3" title="✅ İlk anıyı test et">
          {started ? (
            <>İlk anılar geldi — her şey çalışıyor.</>
          ) : (
            <>QR&apos;ı kendi telefonunla okut ve bir fotoğraf at; birkaç saniyede perdede belirir.</>
          )}
        </Step>
      </div>

      {/* İkincil ipuçları */}
      <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span>{themed ? "🎨 Tema ayarlı ✓" : "🎨 Tema/başlık için"} <button onClick={onGoSettings} className="text-accent font-semibold underline">Sunum ayarları</button></span>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" checked={!!wall.moderation} onChange={(e) => setWallModeration(wall.id, e.target.checked).catch(() => {})} className="w-4 h-4 accent-[#4f46e5]" />
          🛡 Moderasyon {wall.moderation ? "açık (önce onayla)" : "kapalı (direkt perdede)"}
        </label>
      </div>
    </div>
  );
}
