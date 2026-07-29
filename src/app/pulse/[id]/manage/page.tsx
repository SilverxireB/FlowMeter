"use client";

/**
 * FlowPulse KOKPİT — bugünkü skor + düne fark, 30 günlük trend (saf CSS),
 * gün×saat ısı matrisi (vardiya analizi), dağılım, yorum moderasyonu, ayarlar
 * (eşik/cooldown/PIN), kiosk-pano-QR linkleri, haftalık PDF (jspdf).
 * Yalnız sahibi; veriler günlük özetlerden okunur (ucuz).
 */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import QrCode from "@/components/present/QrCode";
import { scoreColor, scoreEmoji } from "@/components/pulse/shared";
import { useAuthUser } from "@/lib/hooks";
import {
  dayKey,
  getRecentDays,
  percentOf,
  PulseComment,
  setCommentStatus,
  deleteComment,
  updatePulse,
  watchComments,
  watchPulse,
  watchToday,
} from "@/lib/pulses";
import { Pulse, PulseDay } from "@/lib/types";

const DAY_NAMES = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

export default function PulseManagePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [pulse, setPulse] = useState<Pulse | null | undefined>(undefined);
  const [today, setToday] = useState<PulseDay | null>(null);
  const [days, setDays] = useState<PulseDay[]>([]);
  const [comments, setComments] = useState<PulseComment[]>([]);
  const [origin, setOrigin] = useState("");

  useEffect(() => watchPulse(id, setPulse), [id]);
  useEffect(() => watchToday(id, setToday), [id]);
  useEffect(() => watchComments(id, setComments), [id]);
  useEffect(() => setOrigin(window.location.origin), []);
  const refreshDays = useCallback(() => getRecentDays(id, 30).then(setDays).catch(() => {}), [id]);
  // Oy başına değil, en fazla dakikada bir tazele (yoğun kioskta okuma faturası şişmesin).
  const lastFetch = useRef(0);
  useEffect(() => {
    if (Date.now() - lastFetch.current < 60_000) return;
    lastFetch.current = Date.now();
    refreshDays();
  }, [refreshDays, today?.total]);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const type = pulse?.question.type ?? "smiley";
  const pctToday = percentOf(type, today);
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return days.find((x) => x.id === dayKey(d)) ?? null;
  }, [days]);
  const pctYesterday = percentOf(type, yesterday);
  const delta = pctToday !== null && pctYesterday !== null ? pctToday - pctYesterday : null;

  // Gün×saat ısı matrisi: son 30 günün hours haritaları haftanın gününe toplanır.
  const heat = useMemo(() => {
    if (type === "choice") return null;
    const m: { t: number; s: number }[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ t: 0, s: 0 })));
    let any = false;
    for (const d of days) {
      const wd = new Date(d.id + "T12:00:00").getDay();
      if (!(wd >= 0 && wd <= 6)) continue; // bozuk doküman id'si kokpiti çökertmesin
      for (const [h, v] of Object.entries(d.hours ?? {})) {
        const hh = Number(h);
        if (!(hh >= 0 && hh <= 23) || typeof v?.t !== "number") continue;
        m[wd][hh].t += v.t;
        m[wd][hh].s += v.s ?? 0;
        any = true;
      }
    }
    return any ? m : null;
  }, [days, type]);

  // Dağılım (bugün + son 30 gün toplamı)
  const dist = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const d of days) for (const [k, n] of Object.entries(d.counts ?? {})) acc[k] = (acc[k] ?? 0) + n;
    return acc;
  }, [days]);
  const distMax = Math.max(1, ...Object.values(dist));

  async function pdfReport() {
    if (!pulse) return;
    const { default: jsPDF } = await import("jspdf");
    // jsPDF'in gömülü fontu ğ/ş/ı bilmiyor → Türkçe karakterleri katla (mojibake yerine okunur ASCII)
    const fold = (s: string) => s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (m) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "C", Ğ: "G", İ: "I", Ö: "O", Ş: "S", Ü: "U" })[m] ?? m);
    const docPdf = new jsPDF();
    docPdf.setFontSize(16);
    docPdf.text(`FlowPulse Raporu — ${fold(pulse.title)}`, 14, 18);
    docPdf.setFontSize(10);
    docPdf.text(`Soru: ${fold(pulse.question.text)}`, 14, 26);
    docPdf.text(`Olusturulma: ${new Date().toLocaleString("tr-TR")}`, 14, 32);
    let y = 44;
    docPdf.text("Tarih", 14, y);
    docPdf.text("Oy", 60, y);
    docPdf.text("Skor %", 90, y);
    y += 6;
    for (const d of [...days].reverse().slice(0, 30)) {
      const p = percentOf(type, d);
      docPdf.text(d.id, 14, y);
      docPdf.text(String(d.total ?? 0), 60, y);
      docPdf.text(p === null ? "-" : String(p), 90, y);
      y += 6;
      if (y > 280) break;
    }
    docPdf.save(`flowpulse-${pulse.title.replace(/\s+/g, "-")}.pdf`);
  }

  if (pulse === undefined || loading)
    return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;
  if (pulse === null) return <main className="min-h-screen grid place-items-center bg-wash text-muted">Nokta bulunamadı.</main>;
  if (user && pulse.ownerId !== user.uid)
    return (
      <main className="min-h-screen grid place-items-center bg-wash px-4">
        <div className="text-center">
          <p className="text-5xl mb-4" aria-hidden>🔒</p>
          <p className="text-muted mb-4">Bu noktada yetkin yok.</p>
          <Link href="/pulse" className="btn-ghost">← Noktalar</Link>
        </div>
      </main>
    );

  const belowThreshold = !!pulse.threshold && pctToday !== null && pctToday < pulse.threshold;
  const pending = comments.filter((c) => c.status === "pending");
  const voteUrl = origin ? `${origin}/pulse/${id}/vote` : "";

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-4 flex items-center flex-wrap gap-x-3 gap-y-2">
        <Link href="/pulse" className="text-muted hover:text-ink shrink-0 text-lg" aria-label="Noktalara dön">←</Link>
        <input
          key={pulse.title}
          defaultValue={pulse.title}
          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== pulse.title && updatePulse(id, { title: e.target.value.trim() })}
          className="order-last basis-full sm:order-none sm:basis-auto sm:flex-1 min-w-0 bg-transparent font-display font-semibold text-lg focus:outline-none border-b border-transparent focus:border-accent"
          aria-label="Nokta adı"
        />
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <a href={`/pulse/${id}/kiosk`} target="_blank" className="btn-ghost !py-2 !px-3.5 text-sm">🖥 Kiosk ↗</a>
          <a href={`/pulse/${id}/board`} target="_blank" className="btn-primary !py-2 !px-3.5 text-sm">📊 Pano ↗</a>
        </div>
      </header>

      {belowThreshold && (
        <div className="bg-brand-soft text-brand px-4 sm:px-6 py-2.5 text-sm font-semibold">
          ⚠ Bugünkü skor %{pctToday} — %{pulse.threshold} eşiğinin ALTINDA. Sahaya bakmakta fayda var.
        </div>
      )}

      <section className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Skor kartları */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card p-5 text-center">
            <p className="eyebrow mb-2">Bugün</p>
            {pctToday !== null ? (
              <>
                <p className="font-display font-bold text-5xl tabular-nums" style={{ color: scoreColor(pctToday) }}>
                  {scoreEmoji(pctToday)} %{pctToday}
                </p>
                <p className="text-muted text-sm mt-1 tabular-nums">{today?.total ?? 0} oy</p>
              </>
            ) : (
              <p className="text-muted py-3">{type === "choice" ? `${today?.total ?? 0} oy` : "Henüz oy yok"}</p>
            )}
          </div>
          <div className="card p-5 text-center">
            <p className="eyebrow mb-2">Düne göre</p>
            {delta !== null ? (
              <p className={`font-display font-bold text-5xl tabular-nums ${delta === 0 ? "text-muted" : delta > 0 ? "text-emerald-600" : "text-brand"}`}>
                {delta === 0 ? "=" : delta > 0 ? "↑" : "↓"} {Math.abs(delta)} <span className="text-lg font-normal text-muted">puan</span>
              </p>
            ) : (
              <p className="text-muted py-3">Karşılaştırma için veri yok</p>
            )}
          </div>
          <div className="card p-5 text-center">
            <p className="eyebrow mb-2">Son 30 gün</p>
            <p className="font-display font-bold text-5xl tabular-nums text-ink">{days.reduce((a, d) => a + (d.total ?? 0), 0)}</p>
            <p className="text-muted text-sm mt-1">toplam oy</p>
          </div>
        </div>

        {/* Trend */}
        {type !== "choice" && days.length > 0 && (
          <div className="card p-5">
            <p className="eyebrow mb-4">30 günlük trend</p>
            {/* Tam 30 günlük pencere — veri olmayan günler ince çizgi (3 oylu ay
                "kesintisiz trend" gibi görünmesin). Değer dokunuşta da görünür. */}
            <div className="flex items-end gap-1 h-36">
              {Array.from({ length: 30 }).map((_, i) => {
                const dt = new Date();
                dt.setDate(dt.getDate() - (29 - i));
                const kk = dayKey(dt);
                const d = days.find((x) => x.id === kk);
                const p = d ? percentOf(type, d) ?? 0 : null;
                return (
                  <button key={kk} className="flex-1 min-w-0 group relative focus:outline-none" aria-label={`${kk}: ${p === null ? "veri yok" : `%${p}`}`}>
                    <div className="rounded-t" style={{ height: p === null ? "2px" : `${Math.max(4, p) * 1.4}px`, background: p === null ? "#ececeb" : scoreColor(p) }} />
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block group-focus:block bg-ink text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap tabular-nums z-10">
                      {kk.slice(5)} · {p === null ? "veri yok" : `%${p} · ${d?.total} oy`}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-muted text-[11px] mt-1 tabular-nums">
              <span>{(() => { const d = new Date(); d.setDate(d.getDate() - 29); return dayKey(d).slice(5); })()}</span>
              <span>bugün</span>
            </div>
          </div>
        )}

        {/* Gün × saat ısı matrisi */}
        {heat && (
          <div className="card p-5 overflow-x-auto">
            <p className="eyebrow mb-1">Gün × saat skoru <span className="normal-case font-normal text-muted">(son 30 gün — hangi vardiyada ne oluyor?)</span></p>
            <p className="text-muted text-[11px] mb-2">Renk = skor (yeşil iyi · gül kötü) · doygunluk = oy sayısı. Az oylu hücreler yanıltabilir.</p>
            <div className="mt-2 grid" style={{ gridTemplateColumns: "38px repeat(24, minmax(14px, 1fr))", gap: 2 }}>
              <span />
              {Array.from({ length: 24 }).map((_, h) => (
                <span key={h} className="text-[9px] text-muted text-center tabular-nums">{h % 3 === 0 ? h : ""}</span>
              ))}
              {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
                <Fragment key={wd}>
                  <span className="text-[10px] text-muted font-semibold self-center">{DAY_NAMES[wd]}</span>
                  {heat[wd].map((cell, h) => {
                    const { min, max } = type === "smiley" ? { min: 1, max: 5 } : type === "nps" ? { min: 0, max: 10 } : { min: 0, max: 1 };
                    const p = cell.t ? Math.min(100, Math.max(0, Math.round((((cell.s / cell.t) - min) / (max - min)) * 100))) : null;
                    return (
                      <span
                        key={h}
                        title={p === null ? "veri yok" : `${DAY_NAMES[wd]} ${h}:00 · %${p} (${cell.t} oy)`}
                        className="h-4 rounded-[3px]"
                        style={{
                          background: p === null ? "#f1f0ef" : scoreColor(p),
                          opacity: p === null ? 1 : 0.25 + 0.6 * Math.min(1, cell.t / 10),
                        }}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Dağılım */}
        {Object.keys(dist).length > 0 && (
          <div className="card p-5">
            <p className="eyebrow mb-4">Dağılım (30 gün)</p>
            <div className="flex flex-col gap-2">
              {Object.entries(dist)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([k, n]) => (
                  <div key={k} className="flex items-center gap-3">
                    <span className="w-24 text-sm font-semibold truncate">
                      {type === "choice" ? pulse.question.options?.[Number(k)] ?? k : type === "yesno" ? (k === "1" ? "👍 Evet" : "👎 Hayır") : type === "smiley" ? ["", "😡", "🙁", "😐", "🙂", "😍"][Number(k)] : k}
                    </span>
                    <div className="flex-1 h-5 bg-paper rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(n / distMax) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right text-sm tabular-nums text-muted">{n}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Yorumlar */}
        {pulse.commentsEnabled !== false && (
          <div className="card p-5">
            <p className="eyebrow mb-4">Yorumlar {pending.length > 0 && <span className="chip !py-0.5 text-brand ml-2">{pending.length} onay bekliyor</span>}</p>
            {comments.length === 0 ? (
              <p className="text-muted text-sm">Henüz yorum yok.</p>
            ) : (
              <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {comments.map((c) => (
                  <li key={c.id} className={`rounded-xl border border-line p-3 flex items-start justify-between gap-3 ${c.status === "rejected" ? "opacity-40" : ""}`}>
                    <div className="min-w-0">
                      <p className="text-sm">{c.text}</p>
                      <p className="text-muted text-[11px] mt-1">{c.createdAt?.toDate().toLocaleString("tr-TR")} · {c.status === "pending" ? "⏳ bekliyor" : c.status === "approved" ? "✓ onaylı" : "✗ reddedildi"}</p>
                    </div>
                    <span className="flex gap-1 shrink-0">
                      {c.status !== "approved" && <button onClick={() => setCommentStatus(id, c.id, "approved")} className="btn-ghost !p-0 w-8 h-8 text-emerald-600" title="Onayla">✓</button>}
                      {c.status !== "rejected" && <button onClick={() => setCommentStatus(id, c.id, "rejected")} className="btn-ghost !p-0 w-8 h-8 text-muted" title="Reddet">✗</button>}
                      <button onClick={() => deleteComment(id, c.id)} className="btn-ghost !p-0 w-8 h-8 text-brand" title="Sil">🗑</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Ayarlar + linkler */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-5 flex flex-col gap-3">
            <p className="eyebrow">Ayarlar</p>
            <label className="text-sm flex flex-col gap-1">
              <span className="text-muted text-xs">Soru metni <span className="text-muted/70">(soru tipi oluşturduktan sonra değiştirilemez)</span></span>
              <input key={pulse.question.text} defaultValue={pulse.question.text} onBlur={(e) => e.target.value.trim() && updatePulse(id, { question: { ...pulse.question, text: e.target.value.trim() } })} className="input-base !py-2" />
            </label>
            {type === "choice" && (
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted text-xs">Seçenekler (virgülle — yazım hatası burada düzelir)</span>
                <input
                  key={(pulse.question.options ?? []).join(",")}
                  defaultValue={(pulse.question.options ?? []).join(", ")}
                  onBlur={(e) => {
                    const opts = e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 11);
                    if (opts.length >= 2) updatePulse(id, { question: { ...pulse.question, options: opts } });
                  }}
                  className="input-base !py-2"
                />
              </label>
            )}
            <div className="flex flex-wrap gap-3">
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted text-xs">Uyarı eşiği (%, 0=kapalı)</span>
                <input key={`t${pulse.threshold}`} type="number" min={0} max={100} defaultValue={pulse.threshold ?? 0} onBlur={(e) => updatePulse(id, { threshold: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className="input-base !py-2 w-24" />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted text-xs" title="Aynı kişinin üst üste basmasını engeller">Oylar arası bekleme (sn)</span>
                <input key={`c${pulse.cooldownSec}`} type="number" min={1} max={60} defaultValue={pulse.cooldownSec ?? 3} onBlur={(e) => updatePulse(id, { cooldownSec: Math.min(60, Math.max(1, Number(e.target.value) || 3)) })} className="input-base !py-2 w-24" />
              </label>
              <label className="text-sm flex flex-col gap-1">
                <span className="text-muted text-xs">Kiosk çıkış PIN&apos;i</span>
                <input key={`p${pulse.pin}`} defaultValue={pulse.pin ?? ""} placeholder="boş = PIN yok" onBlur={(e) => updatePulse(id, { pin: e.target.value.trim() })} className="input-base !py-2 w-32" />
              </label>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={pulse.commentsEnabled !== false} onChange={(e) => updatePulse(id, { commentsEnabled: e.target.checked })} /> Yorumlar</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={pulse.moderation !== false} onChange={(e) => updatePulse(id, { moderation: e.target.checked })} /> Yorum moderasyonu</label>
            </div>
            <button onClick={pdfReport} className="btn-ghost self-start !py-2 text-sm">🧾 PDF rapor indir</button>
          </div>

          <div className="card p-5 flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="eyebrow mb-2">Oy QR&apos;ı</p>
              <p className="text-muted text-xs leading-relaxed mb-2">
                Postere bas, insanlar telefonla okutup oy versin. Kiosk linkini tablette aç; çıkmak için <b>sol üst köşeye 3 sn içinde 5 kez</b> dokun + PIN gir.
                Panoyu FlowSign&apos;da bir alana <b>URL öğesi</b> olarak göm → sonuçlar ekranda dönsün.
              </p>
              <code className="text-xs bg-paper rounded-lg px-2 py-1 break-all">{voteUrl}</code>
            </div>
            {voteUrl && <div className="shrink-0 bg-white border border-line rounded-xl p-2"><QrCode text={voteUrl} size={104} /></div>}
          </div>
        </div>
      </section>
    </main>
  );
}
