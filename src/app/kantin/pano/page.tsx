"use client";

/**
 * PANO — kantindeki ekran (TV/tablet). Tezgâhın önünde birikmeyi çözer:
 * kimin siparişi hazır, kimlerinki hazırlanıyor, uzaktan okunacak boyda.
 *
 * 7/24 açık kalacağı için Sign perdesindeki disiplin: ekran uyanık tutulur,
 * saat başlıkta canlı akar, "hazır" listesi en üstte ve en büyük. Yeni bir
 * sipariş HAZIR olduğunda kısa bir ton çalar — tezgâhtaki gürültüde ekrana
 * bakmayan da duyar.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { izleBugunSiparisleri } from "@/lib/kantin/api";
import { useKantin } from "@/lib/kantin/oturum";
import { Siparis } from "@/lib/kantin/types";
import { calDing, ekraniUyanikTut } from "@/lib/kantin/bildirim";
import ScreenClose from "@/components/ScreenClose";

export default function KantinPanoPage() {
  // useSearchParams Suspense sınırı ister (Next 14 önizleme derlemesi):
  // sınır olmadan sayfa ön-render'da patlıyor.
  return (
    <Suspense fallback={<main className="fixed inset-0 bg-[#0b1020]" />}>
      <Pano />
    </Suspense>
  );
}

function Pano() {
  const { user, hazir, seciliId, kantinler } = useKantin();
  const router = useRouter();
  // TV'de tek URL sabitlenebilsin: ?kantin=<id> seçimi ezer. Yoksa panoda
  // yanlış kantinin siparişleri görünebilirdi ve düzeltmenin yolu yoktu
  // (kabuk gizli olduğu için kantin seçici burada görünmüyor).
  const sorgu = useSearchParams();
  const kantinId = sorgu.get("kantin") || seciliId;
  const seciliKantin = kantinler.find((k) => k.id === kantinId) ?? null;
  const [liste, setListe] = useState<Siparis[] | null>(null);
  const [saat, setSaat] = useState("");
  const oncekiHazirRef = useRef<Set<string>>(new Set());
  const ilkRef = useRef(true);

  useEffect(() => {
    if (hazir && !user) router.replace("/kantin/giris");
  }, [hazir, user, router]);

  useEffect(() => {
    if (!kantinId) return;
    setListe(null);
    ilkRef.current = true;
    return izleBugunSiparisleri(kantinId, (s) => {
      const hazirlar = new Set(s.filter((x) => x.durum === "hazir").map((x) => x.id));
      // İlk yüklemede ton ÇALMAZ: ekran açıldığında birikmiş hazırlar için
      // arka arkaya ötmek gürültüden başka bir şey değil.
      if (!ilkRef.current) {
        for (const id of hazirlar) if (!oncekiHazirRef.current.has(id)) {
          calDing();
          break;
        }
      }
      ilkRef.current = false;
      oncekiHazirRef.current = hazirlar;
      setListe(s);
    });
  }, [kantinId]);

  useEffect(() => {
    let birak: (() => void) | null = null;
    let iptal = false;
    void ekraniUyanikTut().then((f) => (iptal ? f() : (birak = f)));
    const iv = window.setInterval(() => {
      const d = new Date();
      setSaat(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    }, 1000);
    return () => {
      iptal = true;
      birak?.();
      window.clearInterval(iv);
    };
  }, []);

  const hazirlar = useMemo(() => (liste ?? []).filter((s) => s.durum === "hazir"), [liste]);
  const hazirlanan = useMemo(
    () => (liste ?? []).filter((s) => s.durum === "hazirlaniyor" || s.durum === "yeni"),
    [liste]
  );

  return (
    <main className="fixed inset-0 bg-[#0b1020] text-white [color-scheme:dark] overflow-hidden flex flex-col">
      <ScreenClose />
      <header className="flex items-baseline justify-between px-6 sm:px-10 pt-6 pb-3 shrink-0">
        <div className="min-w-0">
          <p className="uppercase tracking-[0.2em] text-xs text-white/45">Kantin</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold truncate">{seciliKantin?.ad ?? ""}</h1>
        </div>
        <p className="font-display text-3xl sm:text-4xl font-semibold tabular-nums text-white/85">{saat}</p>
      </header>

      <div className="flex-1 min-h-0 grid grid-rows-[1fr_auto] gap-4 px-6 sm:px-10 pb-6">
        {/* HAZIR — ekranın yıldızı */}
        <section className="min-h-0 flex flex-col">
          <p className="uppercase tracking-[0.2em] text-xs text-[#7ef0c2] mb-3 shrink-0">Hazır — alabilirsiniz</p>
          {liste === null ? (
            <div className="flex-1 grid place-items-center text-white/30 text-lg animate-pulse">Bağlanıyor…</div>
          ) : hazirlar.length === 0 ? (
            <div className="flex-1 grid place-items-center text-white/30 text-lg">Şu an hazır sipariş yok</div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto grid gap-3 content-start sm:grid-cols-2 xl:grid-cols-3">
              {hazirlar.map((s) => (
                <div
                  key={s.id}
                  className="rounded-3xl bg-[#1baf7a]/15 border border-[#1baf7a]/40 px-5 py-4 animate-pop"
                >
                  <p className="font-display text-2xl sm:text-3xl font-semibold leading-tight truncate">{s.ad}</p>
                  <p className="text-white/60 text-sm tabular-nums">{s.sicil}</p>
                  <p className="text-white/80 text-sm mt-1 truncate">
                    {s.satirlar.map((x) => `${x.adet}× ${x.ad}`).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* HAZIRLANIYOR — sıradakiler, daha küçük */}
        <section className="shrink-0">
          <p className="uppercase tracking-[0.2em] text-xs text-white/45 mb-2">
            Hazırlanıyor {hazirlanan.length > 0 && <span className="text-white/70">· {hazirlanan.length}</span>}
          </p>
          {hazirlanan.length === 0 ? (
            <p className="text-white/25 text-sm">Sıra boş.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {hazirlanan.slice(0, 14).map((s) => (
                <span
                  key={s.id}
                  className="shrink-0 rounded-full bg-white/8 border border-white/12 px-4 py-2 text-sm whitespace-nowrap"
                >
                  {s.ad}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
