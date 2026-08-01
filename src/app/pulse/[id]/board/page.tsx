"use client";

/**
 * FlowPulse PANO — sonuç yayın ekranı. FlowSign'a URL öğesi olarak gömülür
 * (Pulse ölçer → Sign yayınlar) ya da tek başına ekranda döner. Bugünkü skor
 * büyük, 7 günlük mini trend, oy QR'ı. Public, canlı (onSnapshot).
 */
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import QrCode from "@/components/present/QrCode";
import ScreenClose from "@/components/ScreenClose";
import { scoreColor, scoreEmoji } from "@/components/pulse/shared";
import { getRecentDays, percentOf, watchPulse, watchToday } from "@/lib/pulses";
import { Pulse, PulseDay } from "@/lib/types";

export default function PulseBoardPage() {
  const { id } = useParams<{ id: string }>();
  const [pulse, setPulse] = useState<Pulse | null | undefined>(undefined);
  const [today, setToday] = useState<PulseDay | null>(null);
  const [week, setWeek] = useState<PulseDay[]>([]);
  const [voteUrl, setVoteUrl] = useState("");

  useEffect(() => watchPulse(id, setPulse), [id]);
  useEffect(() => watchToday(id, setToday), [id]);
  useEffect(() => setVoteUrl(`${window.location.origin}/pulse/${id}/vote`), [id]);
  useEffect(() => {
    getRecentDays(id, 7).then(setWeek).catch(() => {});
    const t = window.setInterval(() => getRecentDays(id, 7).then(setWeek).catch(() => {}), 5 * 60_000);
    return () => window.clearInterval(t);
  }, [id]);

  if (pulse === undefined) return <main className="w-screen h-screen grid place-items-center bg-[#101014] text-white/40 animate-pulse">Yükleniyor…</main>;
  if (pulse === null) return <main className="w-screen h-screen grid place-items-center bg-[#101014] text-white/40">Nokta bulunamadı.</main>;

  const type = pulse.question.type;
  const pct = percentOf(type, today);
  const weekTotals = week.reduce((a, d) => a + (d.total ?? 0), 0);
  const caption = type === "nps" ? "tavsiye skoru (0–10 ort.)" : type === "yesno" ? "“Evet” oranı" : "bugünkü memnuniyet";
  // choice: skor yok → bugünün seçenek dağılımı
  const todayCounts = Object.entries(today?.counts ?? {}).sort((a, b) => Number(a[0]) - Number(b[0]));
  const countMax = Math.max(1, ...todayCounts.map(([, n]) => n));

  return (
    <main className="w-screen h-screen bg-[#101014] text-white flex flex-col items-center justify-center gap-8 px-6 overflow-hidden" style={{ colorScheme: "dark" }}>
      <p className="text-white/45 font-display" style={{ fontSize: "clamp(16px, 2.4vw, 34px)" }}>{pulse.title}</p>

      {pct !== null ? (
        <div className="text-center">
          <div style={{ fontSize: "clamp(60px, 12vw, 170px)" }} aria-hidden>{scoreEmoji(pct)}</div>
          <div className="font-display font-bold tabular-nums leading-none" style={{ fontSize: "clamp(72px, 16vw, 230px)", color: scoreColor(pct) }}>
            %{pct}
          </div>
          <p className="text-white/55 mt-3" style={{ fontSize: "clamp(13px, 1.8vw, 26px)" }}>
            {caption} · {today?.total ?? 0} oy
          </p>
        </div>
      ) : type === "choice" && (today?.total ?? 0) > 0 ? (
        // choice: skor yerine bugünün dağılımı (pano "oy yok" yalanı söylemesin)
        <div className="w-full max-w-2xl flex flex-col gap-3">
          {todayCounts.map(([k, n]) => (
            <div key={k} className="flex items-center gap-4">
              <span className="w-40 truncate font-semibold" style={{ fontSize: "clamp(14px, 2vw, 30px)" }}>{pulse.question.options?.[Number(k)] ?? k}</span>
              <div className="flex-1 h-7 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(n / countMax) * 100}%` }} />
              </div>
              <span className="w-12 text-right tabular-nums text-white/70" style={{ fontSize: "clamp(13px, 1.6vw, 24px)" }}>{n}</span>
            </div>
          ))}
          <p className="text-white/55 text-center" style={{ fontSize: "clamp(12px, 1.6vw, 22px)" }}>bugün · {today?.total} oy</p>
        </div>
      ) : (
        <p className="text-white/50 font-display" style={{ fontSize: "clamp(20px, 3vw, 44px)" }}>Bugün ilk oyu sen ver 👇</p>
      )}

      {/* 7 günlük mini trend (TV'de imleç yok → gün baş harfleri altta) */}
      {week.length > 1 && type !== "choice" && (
        <div className="flex items-end gap-2">
          {week.map((d) => {
            const p = percentOf(type, d) ?? 0;
            const g = ["P", "Pt", "S", "Ç", "P", "C", "Ct"][new Date(d.id + "T12:00:00").getDay()];
            return (
              <div key={d.id} className="flex flex-col items-center gap-1">
                <div className="w-6 rounded-t self-stretch" style={{ height: `${Math.max(6, p * 0.7)}px`, background: scoreColor(p), opacity: 0.85 }} />
                <span className="text-white/50 text-[11px]">{g}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-4">
        {voteUrl && (
          <div className="bg-white rounded-xl p-2">
            <QrCode text={voteUrl} size={150} />
          </div>
        )}
        <p className="text-white/55 max-w-[200px]" style={{ fontSize: "clamp(12px, 1.5vw, 20px)" }}>
          Telefonunla okut, <b>anonim</b> oyunu ver — bu hafta {weekTotals} kişi katıldı.
        </p>
      </div>

      <ScreenClose />
    </main>
  );
}
