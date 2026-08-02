"use client";

/**
 * SİPARİŞİM — molada elde tutulan ekran.
 *
 * Durum CANLI akar (onSnapshot). "Hazır"a geçtiği an ses + titreşim verir:
 * kişi telefona bakmıyor olabilir, molası da 10 dakika. Uyarı SAYFA AÇIKKEN
 * çalışır; sayfayı kapatanlar için web push ayrı bir adım (sıradaki iş).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { durumDegistir, gunKey, izleSiparislerim } from "@/lib/kantin/api";
import { useKantin } from "@/lib/kantin/oturum";
import { ACIK_DURUMLAR, DURUM_ETIKET, Siparis } from "@/lib/kantin/types";

const RENK: Record<string, string> = {
  yeni: "bg-paper border-line",
  hazirlaniyor: "bg-[#eda100]/12 border-[#eda100]/40",
  hazir: "bg-[#1baf7a]/12 border-[#1baf7a]/40",
  alindi: "bg-paper border-line",
  alinmadi: "bg-brand-soft border-brand/30",
  iptal: "bg-paper border-line",
};

/** Kısa "hazır" tonu — dosya/dış servis yok, WebAudio ile üretilir. */
function calDing() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const now = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = "sine";
      g.gain.setValueAtTime(0.0001, now + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(now + i * 0.18);
      o.stop(now + i * 0.18 + 0.4);
    });
    window.setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {}
}

export default function SiparisimPage() {
  const { user, hazir, seciliId, seciliKantin } = useKantin();
  const router = useRouter();
  const [liste, setListe] = useState<Siparis[]>([]);
  const oncekiRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (hazir && !user) router.replace("/kantin/giris");
  }, [hazir, user, router]);

  useEffect(() => {
    if (!seciliId || !user) return;
    return izleSiparislerim(seciliId, user.uid, (s) => {
      // "hazır"a GEÇİŞ anında uyar — her snapshot'ta değil (aksi hâlde
      // sayfaya her dönüşte yeniden çalardı).
      for (const o of s) {
        const eski = oncekiRef.current[o.id];
        if (eski && eski !== "hazir" && o.durum === "hazir") {
          calDing();
          navigator.vibrate?.([120, 60, 120]);
        }
        oncekiRef.current[o.id] = o.durum;
      }
      setListe(s);
    });
  }, [seciliId, user]);

  if (!hazir || !user) {
    return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;
  }

  const bugun = liste.filter((s) => s.gun === gunKey());
  const acik = bugun.filter((s) => ACIK_DURUMLAR.includes(s.durum));
  const gecmis = liste.filter((s) => !acik.some((a) => a.id === s.id)).slice(0, 20);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="font-display text-2xl font-semibold">Siparişim</h1>
      <p className="text-muted text-sm mb-4">{seciliKantin?.ad ?? ""}</p>

      {acik.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-muted text-sm mb-3">Açık siparişin yok.</p>
          <Link href="/kantin/menu" className="btn-primary !py-2 !px-4 text-sm inline-block">
            Menüye git
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {acik.map((s) => (
            <div key={s.id} className={`rounded-2xl border p-5 ${RENK[s.durum]}`}>
              <p className="font-display text-2xl font-semibold">{DURUM_ETIKET[s.durum]}</p>
              <p className="text-sm mt-1">
                {s.satirlar.map((x) => `${x.adet}× ${x.ad}`).join(", ")}
              </p>
              {s.not && <p className="text-muted text-xs mt-1">Not: {s.not}</p>}
              {s.durum === "hazir" && (
                <p className="text-sm font-semibold mt-2">Tezgâhta adını söyle: {s.ad} · {s.sicil}</p>
              )}
              {s.durum === "yeni" && (
                <button
                  onClick={() => void durumDegistir(seciliId, s.id, "iptal")}
                  className="btn-ghost !py-1.5 !px-3 text-xs mt-3 !text-brand !border-brand/40"
                >
                  Vazgeç
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {gecmis.length > 0 && (
        <>
          <p className="eyebrow mt-8 mb-2">Geçmiş</p>
          <div className="card divide-y divide-line">
            {gecmis.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm truncate">{s.satirlar.map((x) => `${x.adet}× ${x.ad}`).join(", ")}</p>
                  <p className="text-muted text-xs">{s.gun}</p>
                </div>
                <span className={`text-xs shrink-0 ${s.durum === "alinmadi" ? "text-brand font-semibold" : "text-muted"}`}>
                  {DURUM_ETIKET[s.durum]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
