"use client";

/**
 * FOTO SAHNE — FlowWall perdesinin Sign'a TAŞINMIŞ hâli.
 *
 * KULLANICI KARARI (net): "yeni bir şey yazma — aynı ürünü taşıyacaktın sadece.
 * Anons yok, QR yok, sevilen yok." Buradaki çizim Wall'ın gerçek perde
 * modlarından (`components/wall/screen/*`) uyarlandı: aynı marquee şeritler,
 * aynı Ken Burns, aynı bulanık zemin, aynı polaroid saçılması. Çıkarılanlar
 * yalnız ETKİNLİK süsleri: beğeni pili, rumuz, "en sevilen" tacı, yeni-anı
 * rozeti, çekiliş/anons katmanları — fabrika panosunda anlamları yok.
 *
 * Wall'dan ayrılan tek mecburi şey ölçü birimi: Wall tam ekranda yaşar (vh),
 * sahne bir ALANIN içinde yaşar — vh yerine alan yüzdeleri/cq kullanılır.
 *
 * SIGN'A ÖZEL iki ekleme (Wall'a GERİ TAŞINMAZ — orası bitmiş ürün):
 *  - Foto YAZISI (`SahneFoto.yazi`): "Ahmet Bey'e teşekkürler" — büyük karenin
 *    altında döner (Sahne/Spot/Sinema), Polaroid'de kartın beyaz kenarında.
 *  - Ambient efekt katmanı (kar/konfeti/kabarcık… — `SahneEfektleri`).
 *
 * İçerik listesi DURAĞAN (yükleme sırası; "son yüklenen öne çıkar" bilerek
 * yok) olduğu için Wall'ın "yeni anı gelince anında geç" makinesi gerekmez.
 */
import { useEffect, useMemo, useState } from "react";
import { FotoSahneKaydi, SAHNE_MODU_VARSAYILAN, SahneFoto, SahneModu, seritlereBol } from "@/lib/fotoSahne";
import SahneEfektleri from "./SahneEfektleri";

/** Wall ile aynı kalma süresi (hooks.ts IMAGE_MS). */
const KARE_MS = 6500;

// Self-host: Cloudinary boyutlandırma yok — yerel dosya olduğu gibi çizilir.
const buyuk = (src: string) => src;
const kucuk = (src: string, _w = 500) => src;

/** Sıradan türetilen sabit sözde-rastgele (polaroid dağılımı zıplamasın). */
const tohum = (i: number) => {
  const x = Math.sin((i + 1) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export default function FotoSahne({
  sahne,
  box,
  /** Editör önizlemesi: zamanlayıcı ve efekt çalışmaz, ilk kare durur. */
  durgun = false,
}: {
  sahne: Pick<FotoSahneKaydi, "fotolar" | "mod" | "efekt">;
  box: { w: number; h: number };
  durgun?: boolean;
}) {
  const fotolar = useMemo(() => (sahne.fotolar ?? []).filter((f) => f?.src), [sahne.fotolar]);
  const srcler = useMemo(() => fotolar.map((f) => f.src), [fotolar]);
  const mod: SahneModu = sahne.mod ?? SAHNE_MODU_VARSAYILAN;

  // Sıralı dönüş — liste durağan, sıra yükleme sırası (adalet bedava).
  const [sira, setSira] = useState(0);
  useEffect(() => {
    if (durgun || fotolar.length <= 1) return;
    const t = window.setInterval(() => setSira((s) => s + 1), KARE_MS);
    return () => window.clearInterval(t);
  }, [durgun, fotolar.length]);
  const aktif = fotolar.length ? fotolar[sira % fotolar.length] : undefined;

  if (!fotolar.length)
    return (
      <div className="w-full h-full grid place-items-center text-white/35 text-xs text-center px-3" style={{ background: "#05091c" }}>
        Foto sahne — henüz fotoğraf yok
      </div>
    );

  return (
    // Wall'ın koyu lacivert perde zemini (tema: dark).
    <div className="absolute inset-0 overflow-hidden text-white" style={{ background: "#05091c" }}>
      <SahneStilleri />
      {mod === "mozaik" && <Mozaik fotolar={srcler} box={box} />}
      {mod === "sahne" && <Sahne fotolar={srcler} aktif={aktif!} />}
      {mod === "spot" && <Spot fotolar={srcler} aktif={aktif!} box={box} />}
      {mod === "polaroid" && <Polaroid fotolar={fotolar} sira={sira} box={box} />}
      {mod === "sinema" && <Sinema aktif={aktif!} sira={sira} />}
      {!durgun && <SahneEfektleri efekt={sahne.efekt} />}
    </div>
  );
}

/** Foto yazısı — aktif karenin altında (Sahne/Spot/Sinema). Boşsa hiç çizilmez. */
function FotoYazi({ foto }: { foto?: SahneFoto }) {
  if (!foto?.yazi) return null;
  return (
    <div key={foto.src} className="absolute inset-x-0 bottom-[3.5%] z-30 flex justify-center pointer-events-none fs-fade">
      <p
        className="max-w-[82%] rounded-full bg-black/55 px-[2.5%] py-[0.7%] text-center font-display font-semibold leading-snug"
        style={{ fontSize: "clamp(12px, 3cqw, 44px)", backdropFilter: "blur(6px)" }}
      >
        {foto.yazi}
      </p>
    </div>
  );
}

/* ── MOZAİK — Wall MosaicMode: dikey marquee sütunları, fade maskeli ─────── */
function Mozaik({ fotolar, box }: { fotolar: string[]; box: { w: number; h: number } }) {
  // Wall 5 sütunu viewport kırılımlarıyla gizler; alan viewport değil —
  // sütun sayısı alanın GERÇEK genişliğinden türetilir.
  const N = Math.max(2, Math.min(5, Math.round(box.w / 380)));
  const cols = useMemo(() => {
    const buckets: string[][] = Array.from({ length: N }, () => []);
    fotolar.forEach((m, i) => buckets[i % N].push(m));
    return buckets;
  }, [fotolar, N]);
  return (
    <div className="h-full flex gap-3 px-3 py-3 justify-center">
      {cols.map((col, ci) => {
        if (col.length === 0) return null;
        // Marquee yarıya kayar → liste iki kez basılır (Wall ile aynı hile).
        const loop = [...col, ...col];
        const dur = Math.max(26, col.length * 8) + ci * 3;
        return (
          <div
            key={ci}
            className="relative flex-1 min-w-0 overflow-hidden"
            style={{ maskImage: "linear-gradient(to bottom, transparent, #000 8%, #000 92%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 8%, #000 92%, transparent)" }}
          >
            <div className="flex flex-col gap-3 fs-marquee" style={{ animationDuration: `${dur}s`, animationDirection: ci % 2 === 0 ? "normal" : "reverse" }}>
              {loop.map((m, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={m + "-" + i} src={buyuk(m)} alt="" loading="lazy" className="w-full rounded-2xl border border-white/10 shadow-lg" />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── SAHNE — Wall StageMode: bulanık zemin + Ken Burns + yan şeritler ────── */
function Sahne({ fotolar, aktif }: { fotolar: string[]; aktif: SahneFoto }) {
  const seritler = seritlereBol(fotolar);
  return (
    <div className="h-full flex relative">
      <div
        key={"bg-" + aktif.src}
        aria-hidden
        className="absolute inset-0 fs-fade"
        style={{ backgroundImage: `url(${kucuk(aktif.src)})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(60px) brightness(0.42) saturate(1.3)", transform: "scale(1.25)" }}
      />
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(120% 100% at 50% 40%, transparent 40%, rgba(5,9,28,0.80) 100%)" }} />
      <Serit items={seritler.sol} yon="normal" />
      <section className="flex-1 flex items-center justify-center px-[3%] min-w-0 relative z-10">
        <figure key={aktif.src} className="fs-pop max-w-full" style={{ maxHeight: "86%" }}>
          <div className="rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={buyuk(aktif.src)} alt="" className="max-w-full object-contain block fs-ken" style={{ maxHeight: "86cqh" }} />
          </div>
        </figure>
      </section>
      <Serit items={seritler.sag} yon="reverse" />
      <FotoYazi foto={aktif} />
    </div>
  );
}

function Serit({ items, yon }: { items: string[]; yon: "normal" | "reverse" }) {
  if (items.length === 0) return <div className="w-[12%] shrink-0" aria-hidden />;
  const loop = [...items, ...items];
  const dur = Math.max(22, items.length * 6);
  return (
    <div
      className="relative block w-[14%] shrink-0 overflow-hidden z-10"
      style={{ maskImage: "linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent)" }}
    >
      <div className="flex flex-col gap-3 p-3 fs-marquee" style={{ animationDuration: `${dur}s`, animationDirection: yon }}>
        {loop.map((m, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={m + "-" + i} src={kucuk(m, 320)} alt="" loading="lazy" className="w-full aspect-square object-cover rounded-xl border border-white/10 bg-white/5 shadow-lg" />
        ))}
      </div>
    </div>
  );
}

/* ── SPOT — Wall SpotlightMode: arkada soluk ızgara, ortada parlayan kare ── */
function Spot({ fotolar, aktif, box }: { fotolar: string[]; aktif: SahneFoto; box: { w: number; h: number } }) {
  const oran = box.h > 0 ? box.w / box.h : 1.78;
  const sutun = Math.max(2, Math.min(6, Math.round(Math.sqrt(fotolar.length * oran))));
  return (
    <div className="h-full relative">
      <div className="absolute inset-0 grid gap-1 p-1 opacity-30" style={{ gridTemplateColumns: `repeat(${sutun}, 1fr)`, gridAutoRows: "1fr" }}>
        {fotolar.slice(0, sutun * Math.ceil(fotolar.length / sutun)).map((m, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={m + i} src={kucuk(m, 400)} alt="" loading="lazy" className="w-full h-full object-cover rounded-lg" />
        ))}
      </div>
      <div className="absolute inset-0 grid place-items-center p-[6%]">
        <div key={aktif.src} className="fs-spot rounded-3xl overflow-hidden shadow-2xl ring-2 ring-white/25" style={{ maxWidth: "78%", maxHeight: "82%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={buyuk(aktif.src)} alt="" className="max-w-full object-contain block" style={{ maxHeight: "82cqh" }} />
        </div>
      </div>
      <FotoYazi foto={aktif} />
    </div>
  );
}

/* ── POLAROID — Wall PolaroidMode: saçılmış eğik kartlar, biri tepeye düşer ─ */
function Polaroid({ fotolar, sira, box }: { fotolar: SahneFoto[]; sira: number; box: { w: number; h: number } }) {
  const oran = box.h > 0 ? box.w / box.h : 1.78;
  const ust = fotolar[sira % fotolar.length];
  return (
    <div className="h-full relative overflow-hidden">
      {fotolar.map((m, i) => {
        const x = 4 + tohum(i * 2) * 72;
        const y = 4 + tohum(i * 2 + 1) * 62;
        const aci = (tohum(i * 3) - 0.5) * 22;
        const gen = Math.max(14, Math.min(26, 90 / Math.sqrt(fotolar.length * Math.max(1, oran))));
        return (
          <div
            key={m.src}
            className="absolute fs-float bg-white p-[0.5%] pb-[2%] rounded-md shadow-2xl"
            style={{ left: `${x}%`, top: `${y}%`, width: `${gen}%`, ["--r" as string]: `${aci.toFixed(1)}deg`, transform: `rotate(${aci.toFixed(1)}deg)`, zIndex: 1 + (i % 5), animationDelay: `${(i % 7) * 0.9}s` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={kucuk(m.src, 520)} alt="" loading="lazy" className="w-full aspect-square object-cover" />
          </div>
        );
      })}
      {/* En üste düşen kart — Wall'da "en yenisi tepeye düşer"; durağan listede
          sıra dolaşır, herkes sırayla tepeye çıkar. Yazı polaroid'in beyaz
          kenarına yazılır (kartın doğal yeri). */}
      <div key={"ust-" + ust.src} className="absolute left-1/2 top-1/2 fs-drop bg-white p-[0.6%] pb-[1%] rounded-md shadow-2xl" style={{ width: "30%", transform: "translate(-50%, -50%) rotate(-3deg)", zIndex: 40 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={buyuk(ust.src)} alt="" className="w-full aspect-square object-cover" />
        <p className="text-center text-black/75 font-display font-semibold truncate px-1" style={{ fontSize: "clamp(10px, 1.7cqw, 26px)", minHeight: "1.4em", marginTop: "2%" }}>
          {ust.yazi ?? ""}
        </p>
      </div>
    </div>
  );
}

/* ── SİNEMA — Wall CinemaMode: tam alan tek kare, sinematik crossfade ────── */
function Sinema({ aktif, sira }: { aktif: SahneFoto; sira: number }) {
  return (
    <div className="h-full relative bg-black">
      <div key={aktif.src} className="absolute inset-0 fs-fade">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={buyuk(aktif.src)} alt="" className={`w-full h-full object-cover ${sira % 2 === 0 ? "fs-ken" : "fs-ken-slow"}`} />
      </div>
      <div aria-hidden className="absolute inset-x-0 top-0 h-[8%] bg-gradient-to-b from-black/70 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[8%] bg-gradient-to-t from-black/70 to-transparent" />
      <FotoYazi foto={aktif} />
    </div>
  );
}

/** Wall'ın animasyon dili (shared.tsx WallStyles) — fs- öneki: Sign kendi
 *  kopyasını taşır, Wall'a bağ kurmaz (ayrı paket kuralı). */
function SahneStilleri() {
  return (
    <style>{`
      .fs-fade { animation: fsfade 1s ease-out; }
      @keyframes fsfade { from { opacity: 0; } to { opacity: 1; } }
      .fs-pop { animation: fspop 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
      @keyframes fspop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
      .fs-ken { animation: fsken 8s ease-out both; }
      @keyframes fsken { from { transform: scale(1.02); } to { transform: scale(1.13) translate(1.5%, -1.5%); } }
      .fs-ken-slow { animation: fskenslow 9s ease-out both; }
      @keyframes fskenslow { from { transform: scale(1.04); } to { transform: scale(1.14) translate(-1.5%, 1.5%); } }
      .fs-marquee { animation-name: fsmarquee; animation-timing-function: linear; animation-iteration-count: infinite; }
      @keyframes fsmarquee { from { transform: translateY(0); } to { transform: translateY(-50%); } }
      .fs-spot { animation: fsspot 0.8s cubic-bezier(0.22, 1, 0.36, 1); }
      @keyframes fsspot { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      .fs-drop { animation: fsdrop 0.9s cubic-bezier(0.22, 1, 0.36, 1); }
      @keyframes fsdrop { from { opacity: 0; transform: translate(-50%, -50%) translateY(-40px) scale(1.1) rotate(-3deg); } to { transform: translate(-50%, -50%) rotate(-3deg); } }
      .fs-float { animation: fsfloat 7s ease-in-out infinite; }
      @keyframes fsfloat { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)); } 50% { transform: translateY(-6px) rotate(var(--r,0deg)); } }
      @media (prefers-reduced-motion: reduce) {
        .fs-fade, .fs-pop, .fs-ken, .fs-ken-slow, .fs-marquee, .fs-spot, .fs-drop, .fs-float { animation: none !important; }
      }
    `}</style>
  );
}
