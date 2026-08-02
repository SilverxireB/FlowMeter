"use client";

/**
 * PROVA — FlowPulse (/admin → "Prova & sağlık" → nokta seç).
 *
 * Gerçek ziyaretçi gibi ANONİM oy/yorum yazar (castVote/addComment) — kurallar
 * hiç değişmez, yani prova gerçek yolu dener: kiosk+QR kanalları, günlük özet
 * (days) artışı, moderasyon kapısı, gece yarısı gün değişimi.
 *
 * Yazım hataları YUTULMAZ: kural reddi ile "hiç denenmedi" ekranda ayırt
 * edilebilsin diye işlem akışına düşer.
 */
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { percentOf, watchPulse, watchToday } from "@/lib/pulses";
import { firePulseComment, firePulseVote, seedPulseHistory } from "@/lib/simPulse";
import { useAdminGate } from "@/lib/useAdminGate";
import { usePlayTarget } from "@/lib/usePlayTarget";
import { Pulse, PulseDay } from "@/lib/types";

const TICK_MS = 500;

export default function PulseProvaPage() {
  const { id } = useParams<{ id: string }>();
  const authed = useAdminGate();
  const hedef = usePlayTarget();

  const [pulse, setPulse] = useState<Pulse | null | undefined>(undefined);
  const [bugun, setBugun] = useState<PulseDay | null>(null);
  useEffect(() => {
    if (!id) return;
    const a = watchPulse(id, setPulse);
    const b = watchToday(id, setBugun);
    return () => {
      a();
      b();
    };
  }, [id]);

  // Dakikada oy: gerçek bir nokta yoğun saatte ~20-60 oy/saat alır; kaydırıcı
  // "sakin"den "kuyruk var"a kadar açar.
  const [oyDk, setOyDk] = useState(12);
  const [qrPay, setQrPay] = useState(30); // % QR (kalanı kiosk)
  const [yorumAcik, setYorumAcik] = useState(true);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sayac, setSayac] = useState({ oy: 0, yorum: 0 });

  const cfgRef = useRef({ oyDk, qrPay, yorumAcik });
  useEffect(() => {
    cfgRef.current = { oyDk, qrPay, yorumAcik };
  }, [oyDk, qrPay, yorumAcik]);
  const pulseRef = useRef<Pulse | null>(null);
  useEffect(() => {
    pulseRef.current = pulse ?? null;
  }, [pulse]);
  const sayacRef = useRef({ oy: 0, yorum: 0 });

  type Tur = "oy" | "yorum" | "bilgi" | "hata";
  const logRef = useRef<{ id: number; tur: Tur; metin: string }[]>([]);
  const logIdRef = useRef(0);
  const [log, setLog] = useState<typeof logRef.current>([]);
  const kaydet = (tur: Tur, metin: string) => {
    logRef.current = [{ id: ++logIdRef.current, tur, metin }, ...logRef.current].slice(0, 80);
  };
  const hataRef = useRef<Record<string, number>>({});
  const hata = (ne: string, e: unknown) => {
    const k = `${ne} yazılamadı — ${e instanceof Error ? e.message : String(e)}`;
    hataRef.current[k] = (hataRef.current[k] ?? 0) + 1;
  };
  const hatalariBas = () => {
    const b = hataRef.current;
    hataRef.current = {};
    for (const [k, n] of Object.entries(b)) kaydet("hata", n > 1 ? `${k} (×${n})` : k);
  };

  // Ana döngü — oylar Poisson benzeri seyrek gelir (düzenli tik değil).
  useEffect(() => {
    if (!running || !id) return;
    const dt = TICK_MS / 1000;
    const iv = window.setInterval(() => {
      const p = pulseRef.current;
      if (!p) return;
      const cfg = cfgRef.current;
      const beklenen = (cfg.oyDk / 60) * dt;
      const adet = Math.floor(beklenen) + (Math.random() < beklenen % 1 ? 1 : 0);
      for (let i = 0; i < adet; i++) {
        const kanal = Math.random() * 100 < cfg.qrPay ? "qr" : "kiosk";
        firePulseVote(id, p.question, kanal)
          .then((v) => kaydet("oy", `${kanal === "qr" ? "QR" : "Kiosk"} · değer ${v}`))
          .catch((e) => hata("oy", e));
        sayacRef.current.oy++;
      }
      // Yorum: oyların ~%12'si yorum bırakır (gerçekçi oran).
      if (cfg.yorumAcik && p.commentsEnabled !== false && adet) {
        for (let i = 0; i < adet; i++) {
          if (Math.random() > 0.12) continue;
          firePulseComment(id, p.moderation !== false)
            .then((t) => kaydet("yorum", t))
            .catch((e) => hata("yorum", e));
          sayacRef.current.yorum++;
        }
      }
    }, TICK_MS);

    const statIv = window.setInterval(() => {
      setSayac({ ...sayacRef.current });
      hatalariBas();
      setLog([...logRef.current]);
    }, 1000);

    return () => {
      window.clearInterval(iv);
      window.clearInterval(statIv);
    };
  }, [running, id]);

  const [gecmisIlerleme, setGecmisIlerleme] = useState<{ y: number; t: number } | null>(null);
  const gecmisUret = useCallback(async () => {
    const p = pulseRef.current;
    if (!p || !id || busy) return;
    setBusy(true);
    try {
      kaydet("bilgi", "Geçmiş 7 gün üretiliyor (yalnız günlük özet)…");
      setLog([...logRef.current]);
      await seedPulseHistory(id, p.question, 7, 8, (y, t) => setGecmisIlerleme({ y, t }));
      kaydet("bilgi", "Geçmiş hazır — panoda trend grafiği dolu görünür.");
    } catch (e) {
      hata("geçmiş", e);
      hatalariBas();
    } finally {
      setGecmisIlerleme(null);
      setBusy(false);
      setLog([...logRef.current]);
    }
  }, [id, busy]);

  if (authed === null) return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;
  if (!authed) {
    return (
      <main className="min-h-screen grid place-items-center bg-wash text-center px-6">
        <div>
          <p className="text-xl font-bold mb-1">Yetki yok</p>
          <p className="text-muted">Bu sayfa sadece yöneticilere açık.</p>
        </div>
      </main>
    );
  }
  if (pulse === undefined) return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Nokta açılıyor…</main>;
  if (pulse === null) {
    return (
      <main className="min-h-screen grid place-items-center bg-wash text-center px-6">
        <div>
          <p className="text-xl font-bold mb-1">Nokta bulunamadı</p>
          <p className="text-muted">Bu kimlik ({id}) geçerli bir nabız noktasına karşılık gelmiyor.</p>
        </div>
      </main>
    );
  }

  const skor = percentOf(pulse.question.type, bugun);

  return (
    <main className="min-h-screen bg-wash p-4 sm:p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/admin/prova" className="text-muted hover:text-ink text-sm">← Prova &amp; sağlık</Link>
            <p className="eyebrow text-accent mt-1">FlowPulse provası</p>
            <h1 className="font-display text-2xl font-semibold truncate">{pulse.title}</h1>
            <p className="text-muted text-sm">
              {pulse.question.text} · {pulse.question.type}
              {pulse.moderation !== false && " · yorumlar onaya düşer"}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Link href={`/pulse/${id}/board`} target={hedef} className="btn-ghost !py-1.5 !px-3 text-xs">Pano ↗</Link>
            <Link href={`/pulse/${id}/kiosk`} target={hedef} className="btn-ghost !py-1.5 !px-3 text-xs">Kiosk ↗</Link>
          </div>
        </div>

        <div className="card p-5 flex flex-col gap-4">
          <p className="eyebrow">Aktiflik</p>
          <Slider label={`Oy yoğunluğu · dakikada ${oyDk}`} min={1} max={60} step={1} value={oyDk} onChange={setOyDk} />
          <Slider label={`Kanal karışımı · %${qrPay} QR, %${100 - qrPay} kiosk`} min={0} max={100} step={10} value={qrPay} onChange={setQrPay} />
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={yorumAcik} onChange={(e) => setYorumAcik(e.target.checked)} className="w-5 h-5 accent-[#4f46e5]" />
            <span className="text-sm font-semibold">Yorum da bırakılsın</span>
          </label>
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <button
              onClick={() => setRunning((r) => !r)}
              className={`!py-2.5 !px-6 text-sm rounded-full font-semibold ${running ? "btn-ghost !border-brand !text-brand" : "btn-primary"}`}
            >
              {running ? "■ Durdur" : "▶ Başlat"}
            </button>
            <button onClick={() => void gecmisUret()} disabled={busy} className="btn-ghost !py-2.5 !px-5 text-sm">
              {gecmisIlerleme ? `Geçmiş üretiliyor… ${gecmisIlerleme.y}/${gecmisIlerleme.t}` : "Geçmiş 7 gün üret"}
            </button>
          </div>
          <p className="text-muted text-xs">
            Geçmiş üretimi <b>56 yazım</b> yapar (7 gün × 8 oy) ve yalnız günlük özeti doldurur — trend grafiğini
            görmek için. Gerçek etkinlikte kullanma.
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="eyebrow">Canlı</p>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${
                running ? "bg-[#1baf7a]/12 text-[#0f7a55]" : "bg-paper text-muted"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${running ? "bg-[#1baf7a] animate-pulse" : "bg-muted/50"}`} />
              {running ? "Çalışıyor" : "Durdu"}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <Stat label="bugün oy" value={bugun?.total ?? 0} highlight />
            <Stat label="skor" value={skor ?? 0} suffix={skor === null ? "" : "%"} />
            <Stat label="prova oy" value={sayac.oy} />
            <Stat label="prova yorum" value={sayac.yorum} />
          </div>

          <div className="mt-5">
            <p className="eyebrow mb-2">İşlem akışı</p>
            {log.length === 0 ? (
              <p className="text-muted text-sm py-3">Henüz işlem yok.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-2xl border border-line divide-y divide-line/70">
                {log.map((o) => (
                  <p key={o.id} className="px-3 py-1.5 text-xs flex items-start gap-2">
                    <span
                      className={`shrink-0 font-bold ${
                        o.tur === "hata" ? "text-brand" : o.tur === "oy" ? "text-accent" : o.tur === "yorum" ? "text-[#0f7a55]" : "text-muted"
                      }`}
                    >
                      {o.tur === "bilgi" ? "·" : o.tur}
                    </span>
                    <span className="min-w-0 break-words">{o.metin}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
          <p className="text-muted text-xs mt-4">
            <b>Pano ↗</b>'yu aç ve başlat: skor, dağılım ve saat grafiği canlı dolmalı. Kiosk ekranında da
            aynı anda oy verip çakışma olmadığını görebilirsin.
          </p>
        </div>
      </div>
    </main>
  );
}

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold block mb-1">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#4f46e5]" />
    </label>
  );
}

function Stat({ label, value, highlight, suffix }: { label: string; value: number; highlight?: boolean; suffix?: string }) {
  return (
    <div className={`rounded-2xl py-3 ${highlight ? "bg-accent-soft" : "bg-paper"}`}>
      <p className={`font-display text-2xl font-semibold tabular-nums ${highlight ? "text-accent" : ""}`}>
        {value}
        {suffix}
      </p>
      <p className="text-muted text-xs">{label}</p>
    </div>
  );
}
