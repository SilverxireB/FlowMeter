"use client";

/**
 * Ekran sağlığı kartı (kokpit) — bu yayını açık tutan cihazlar (heartbeat).
 * Perde BEAT_MS'te bir yazar; ONLINE_MS içinde görülen = 🟢 çevrimiçi. Bayat
 * kayıtlar 🗑 ile temizlenir (yalnız kayıt silinir; cihaz açıksa yeniden belirir).
 * Eşik BURADA SABİT YAZILMAZ — nabızdan türer, yoksa nabız uzatılınca çalışan
 * ekranlar çevrimdışı görünürdü (bu dosyada 5dk ayrı sabit olarak duruyordu).
 */
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { deleteScreenBeat, ONLINE_MS, watchScreens } from "@/lib/videowalls";
import { ScreenBeat } from "@/lib/types";

function uaLabel(ua?: string): string {
  if (!ua) return "Bilinmeyen cihaz";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Tarayıcı";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}

function ago(ms: number): string {
  const d = Date.now() - ms;
  if (d < 90_000) return "az önce";
  if (d < 3600_000) return `${Math.round(d / 60_000)} dk önce`;
  if (d < 86_400_000) return `${Math.round(d / 3600_000)} sa önce`;
  return `${Math.round(d / 86_400_000)} gün önce`;
}

/** Süre: "42 dk", "3 sa 20 dk", "6 gün 4 sa" (yayın süresi sütunu). */
function sure(ms: number): string {
  if (ms < 60_000) return "1 dk";
  const dk = Math.floor(ms / 60_000);
  if (dk < 60) return `${dk} dk`;
  const sa = Math.floor(dk / 60);
  if (sa < 24) return dk % 60 ? `${sa} sa ${dk % 60} dk` : `${sa} sa`;
  const gun = Math.floor(sa / 24);
  return sa % 24 ? `${gun} gün ${sa % 24} sa` : `${gun} gün`;
}

export default function ScreensCard({ id }: { id: string }) {
  const [screens, setScreens] = useState<ScreenBeat[]>([]);
  // "son görülme" etiketleri bayatlamasın diye 30sn'de bir yeniden çiz
  const [, setTick] = useState(0);
  useEffect(() => watchScreens(id, setScreens), [id]);
  useEffect(() => {
    const iv = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(iv);
  }, []);

  const online = screens.filter((s) => Date.now() - (s.lastSeenAt?.toMillis() ?? 0) < ONLINE_MS);

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <p className="eyebrow">Ekranlar</p>
        {screens.length > 0 && (
          <span className={`text-xs font-semibold ${online.length ? "text-emerald-600" : "text-muted"}`}>
            {online.length ? `● ${online.length} çevrimiçi` : "○ çevrimiçi ekran yok"}
          </span>
        )}
      </div>

      {screens.length === 0 ? (
        <p className="text-muted text-sm">
          Yayın linkini bir cihazda açınca burada görünür — hangi ekranların açık olduğunu buradan izlersin.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {screens.map((s) => {
            const seen = s.lastSeenAt?.toMillis() ?? 0;
            const isOnline = Date.now() - seen < ONLINE_MS;
            const basladi = s.startedAt?.toMillis?.() ?? 0;
            // Bu oturum: çevrimiçiyse ŞU ANA kadar, değilse son görüldüğü ana kadar.
            const oturum = basladi ? Math.max(0, (isOnline ? Date.now() : seen) - basladi) : 0;
            const toplam = s.totalMs ?? 0;
            // Toplam yalnız oturumdan belirgin fazlaysa yazılır — ilk oturumda
            // aynı sayıyı iki kez göstermenin anlamı yok.
            const toplamGoster = toplam > oturum + 5 * 60_000;
            return (
              <li key={s.id} className="flex items-center gap-3 rounded-xl bg-paper border border-line px-3 py-2.5 text-sm">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? "bg-emerald-500" : "bg-line"}`} aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {uaLabel(s.ua)}
                    {s.vwPx ? <span className="text-muted font-normal ml-2 tabular-nums">{s.vwPx}×{s.vhPx}</span> : null}
                  </p>
                  <p className="text-muted text-xs">
                    {isOnline ? "çevrimiçi" : seen ? `son görülme: ${ago(seen)}` : "hiç görülmedi"}
                  </p>
                </div>
                {(oturum > 0 || toplamGoster) && (
                  <div className="shrink-0 text-right leading-tight">
                    {oturum > 0 && (
                      <p className="font-semibold tabular-nums">
                        {sure(oturum)}
                        <span className="text-muted font-normal ml-1">{isOnline ? "yayında" : "sürdü"}</span>
                      </p>
                    )}
                    {toplamGoster && (
                      <p className="text-muted text-xs tabular-nums">toplam {sure(toplam)}</p>
                    )}
                  </div>
                )}
                {!isOnline && (
                  <button
                    onClick={() => deleteScreenBeat(id, s.id).catch(() => {})}
                    className="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-brand-soft/50"
                    title="Bayat kaydı kaldır (cihaz açıksa yeniden belirir)"
                    aria-label="Ekran kaydını kaldır"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
