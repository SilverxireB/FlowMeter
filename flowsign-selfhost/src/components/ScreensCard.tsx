"use client";

/**
 * Ekran sağlığı kartı (kokpit) — bu yayını açık tutan cihazlar (heartbeat).
 * Perde ~2dk'da bir yazar; 5dk içinde görülen = 🟢 çevrimiçi. Bayat kayıtlar
 * 🗑 ile temizlenir (yalnız kayıt silinir; cihaz açıksa yeniden belirir).
 */
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { deleteScreenBeat, watchScreens } from "@/lib/client";
import { ScreenBeat } from "@/lib/types";

const ONLINE_MS = 5 * 60_000;

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

export default function ScreensCard({ id }: { id: string }) {
  const [screens, setScreens] = useState<ScreenBeat[]>([]);
  // "son görülme" etiketleri bayatlamasın diye 30sn'de bir yeniden çiz
  const [, setTick] = useState(0);
  useEffect(() => watchScreens(id, setScreens), [id]);
  useEffect(() => {
    const iv = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(iv);
  }, []);

  const online = screens.filter((s) => Date.now() - (s.lastSeenAt ?? 0) < ONLINE_MS);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <p className="text-white/60 text-[11px] font-bold uppercase tracking-[0.14em]">Ekranlar</p>
        {screens.length > 0 && (
          <span className={`text-xs font-semibold ${online.length ? "text-emerald-300" : "text-white/40"}`}>
            {online.length ? `● ${online.length} çevrimiçi` : "○ çevrimiçi ekran yok"}
          </span>
        )}
      </div>

      {screens.length === 0 ? (
        <p className="text-white/50 text-sm">
          Yayın linkini bir cihazda açınca burada görünür — hangi ekranların açık olduğunu buradan izlersin.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {screens.map((s) => {
            const seen = s.lastSeenAt ?? 0;
            const isOnline = Date.now() - seen < ONLINE_MS;
            return (
              <li key={s.id} className="flex items-center gap-3 rounded-xl bg-black/25 border border-white/10 px-3 py-2.5 text-sm">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? "bg-emerald-400" : "bg-white/25"}`} aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {uaLabel(s.ua)}
                    {s.vwPx ? <span className="text-white/45 font-normal ml-2 tabular-nums">{s.vwPx}×{s.vhPx}</span> : null}
                  </p>
                  <p className="text-white/50 text-xs">
                    {isOnline ? "çevrimiçi" : seen ? `son görülme: ${ago(seen)}` : "hiç görülmedi"}
                    {s.startedAt ? ` · açılış: ${ago(s.startedAt)}` : ""}
                  </p>
                </div>
                {!isOnline && (
                  <button
                    onClick={() => deleteScreenBeat(id, s.id).catch(() => {})}
                    className="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-white/40 hover:text-rose-400 hover:bg-white/10"
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
