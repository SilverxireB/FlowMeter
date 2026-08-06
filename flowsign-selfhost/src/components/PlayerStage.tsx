"use client";

/**
 * FlowSign yayın sahnesi (oynatma motoru) — self-host kopyası. Duvar tam ekran
 * (100vw×100vh); alanlar oransal (0–1) → fiziksel çözünürlükten bağımsız böler.
 * Her alan kendi listesini döndürür (görsel/video/URL/metin/saat), saat aralığı +
 * gün filtresi, geçiş efekti (fade/cut/slide), bozuk öğe atlama (7/24). Ekran
 * uyumaz (Wake Lock) + tam ekran + ekran tanıma. Görseller önceden yüklenip
 * DECODE edilir → geçişte flaş/boşluk yok. Online sürümle davranış birebir;
 * tek fark: yerel /media yolları da güvenli kaynak sayılır.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { sendScreenBeat, watchWall, watchWallByKey } from "@/lib/client";
import { BEAT_MS, itemInWindow as inWindow, signAdresi, ZONE_BG_DEFAULT } from "@/lib/zones";
import { FotoSahneKaydi, sahneAdresi } from "@/lib/fotoSahne";
import { watchSahne } from "@/lib/sahneClient";
import FotoSahne from "./FotoSahne";
import { Videowall, Zone, ZoneItem } from "@/lib/types";

type Transition = "fade" | "cut" | "slide";

/** http(s) VE yerel /media yolları oynatılır — javascript:/data: XSS'i keser (derin savunma). */
const safeSrc = (src?: string) => (src && (/^https?:\/\//i.test(src) || /^\/(?!\/)/.test(src)) ? src : undefined);

/**
 * BOŞ ALAN YÜZÜ — içeriği olmayan (ya da tamamı takvim dışı) alan.
 *
 * Eskiden düz "FlowSign" yazısıydı; ürünün kendi işareti dururken duvarda
 * yazıyla marka anlatmanın anlamı yok. Soluk bırakılıyor: boş alan bir HATA
 * değil, henüz doldurulmamış bir yer — dikkat çekmemeli.
 */
function BosAlan() {
  return (
    <div className="w-full h-full grid place-items-center select-none" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-sign-white.png" alt="" className="max-w-[38%] max-h-[38%] w-auto h-auto opacity-[0.13]" />
    </div>
  );
}

/**
 * GÖMÜLÜ EKRAN — bir alana bağlanan başka bir ekran (yetki devri).
 *
 * NEDEN IFRAME DEĞİL: gömülü ekran eskiden `/flowsign/[slug]` adresiyle URL
 * öğesi olarak ekleniyordu, yani alanın içinde UYGULAMANIN TAMAMI yeniden
 * çalışıyordu — ikinci bir React ağacı, ikinci Firebase SDK'sı, ikinci
 * Firestore bağlantısı, ikinci nabız, ikinci "sıradakini önden indir". Üstüne
 * iframe, gömülü ekranın TASARIM çözünürlüğünde çizilip küçültüldüğü için her
 * karede dev bir yüzey ölçekleniyordu. Sonuç: videolar geç açılıyor ve
 * duraksıyordu.
 *
 * Burada bağlı ekranın YAYINI (live) okunup alanları doğrudan bu ağacın içinde
 * çiziliyor: tek uygulama, tek bağlantı, gerçek boyutta yüzey.
 *
 * Üç kapı:
 *  - `zincir` döngüyü keser (A→B→A sonsuza gider),
 *  - gömülü ekran HEP otomatik oynar (iç ekranın "Sunum" modu kumanda beklemesin),
 *  - nabız ve ekran kilidi yalnız EN DIŞTAKİ perdede (PlayerStage) çalışır.
 */
function GomuluEkran({ hedef, box, zincir }: { hedef: { id?: string; slug?: string }; box: { w: number; h: number }; zincir: string[] }) {
  const [vw, setVw] = useState<Videowall | null | undefined>(undefined);
  const anahtar = hedef.id ?? `slug:${hedef.slug}`;
  // ZİNCİR KİMLİĞİ METİN OLARAK: dizi her render'da yeniden üretilir, bu yüzden
  // bağımlılık listesine DİZİYİ koymak aboneliği her render'da kopartıp yeniden
  // kurardı (7/24 ekranda saniyede bir tik atan bir saat bile bunu tetikler).
  const zincirKey = zincir.join("|");
  const dongu = zincir.includes(anahtar) || (vw?.id ? zincir.includes(vw.id) : false);
  useEffect(() => {
    if (zincirKey.split("|").includes(anahtar)) return;
    if (hedef.id) return watchWall(hedef.id, setVw);
    if (hedef.slug) return watchWallByKey(hedef.slug, setVw);
  }, [hedef.id, hedef.slug, anahtar, zincirKey]);

  // Alt zincir de KİMLİĞİ sabit kalsın: yeni dizi = alt ağacın tamamı yeniden
  // render + alt aboneliklerin yeniden kurulması.
  const altZincir = useMemo(() => [...zincir, anahtar, vw?.id ?? ""], [zincirKey, anahtar, vw?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (dongu)
    return (
      <div className="w-full h-full grid place-items-center bg-black/40 text-white/40 text-xs text-center px-2">
        Bu ekran kendini içeriyor
      </div>
    );
  // YALNIZ YAYIN — taslağa DÜŞÜLMEZ. Gömme bir yetki devri: bağlı ekranı
  // başkası yönetiyor ve denemeleri senin duvarına düşmemeli. Henüz hiç
  // yayınlanmamışsa alan sessizce boş kalır (seçici bunu zaten "henüz
  // yayınlanmamış" diye yazıyor). En dıştaki perdenin eski duvarlar için
  // taslağa düşme kuralı burada BİLEREK geçerli değil.
  const stage = vw?.live ?? null;
  if (!stage?.zones?.length)
    return <BosAlan />;
  return (
    <div className="absolute inset-0">
      {stage.zones.map((z) => (
        <ZonePlayer key={z.id} zone={z} stageW={box.w} stageH={box.h} manual={false} zincir={altZincir} />
      ))}
    </div>
  );
}

/**
 * FOTO SAHNE (link ile) — gömülü ekran dersinin aynısı: sahne linki URL öğesi
 * olarak eklenir ama IFRAME AÇILMAZ; kayıt izlenip sahne AYNI ağaçta çizilir
 * (iframe alanın tasarım çözünürlüğünde çizilip küçültülür ve animasyonları
 * kekemeleştirirdi). Link kullanıcı için, perde için değil.
 */
function GomuluSahne({ id, box }: { id: string; box: { w: number; h: number } }) {
  const [sahne, setSahne] = useState<FotoSahneKaydi | null | undefined>(undefined);
  useEffect(() => watchSahne(id, setSahne), [id]);
  if (sahne === undefined) return null;
  if (sahne === null)
    return (
      <div className="w-full h-full grid place-items-center bg-black/40 text-white/40 text-xs text-center px-2">
        Foto sahne bulunamadı
      </div>
    );
  return <FotoSahne sahne={sahne} box={box} />;
}

function ClockView({ item }: { item: ZoneItem }) {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setT(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4 text-center" style={{ background: item.bg ?? "#0d102f", color: item.color ?? "#fff" }}>
      <div className="font-display font-bold tabular-nums leading-none" style={{ fontSize: "clamp(28px, min(18cqw, 40cqh), 240px)" }}>
        {t.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="font-display opacity-80" style={{ fontSize: "clamp(12px, min(5cqw, 11cqh), 48px)" }}>
        {t.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
      </div>
    </div>
  );
}

/**
 * Metin ne kadar uzunsa punto o kadar küçülür.
 *
 * Yalnız alan ölçüsüne bakmak yetmiyor: "HoşGeldiniz" sığan puntoda
 * "HoşGeldiniz Değerli Misafirlerimiz" üç satıra sarıp alanın DİKEYİNİ taşıyor
 * ve alt kısmı kırpılıyordu. Katsayılar uzunluğa göre kademeleniyor; ölçü yine
 * alana bağlı (cqw/cqh), yani hem dar hem alçak alanlarda doğru kalıyor.
 */
function yaziOlcu(metin: string, taban: [number, number], enBuyuk: number): string {
  const n = metin.length;
  const k = n <= 12 ? 1 : n <= 24 ? 0.68 : n <= 40 ? 0.5 : n <= 70 ? 0.38 : 0.28;
  const [w, h] = taban;
  return `clamp(14px, min(${(w * k).toFixed(2)}cqw, ${(h * k).toFixed(2)}cqh), ${enBuyuk}px)`;
}

function TextView({ item }: { item: ZoneItem }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center px-[6%]" style={{ background: item.bg ?? "#312e81", color: item.color ?? "#fff" }}>
      {item.title && <div className="font-display font-bold leading-tight max-w-full" style={{ fontSize: yaziOlcu(item.title ?? "", [12, 32], 160), overflowWrap: "anywhere" }}>{item.title}</div>}
      {item.text && <div className="font-display opacity-90 leading-snug whitespace-pre-wrap max-w-full" style={{ fontSize: yaziOlcu(item.text ?? "", [5, 14], 60), overflowWrap: "anywhere" }}>{item.text}</div>}
    </div>
  );
}

/** Tek öğe katmanı — güvenilir enter animasyonu (reflow + çift rAF → asla ani
 * zıplama/flaş yapmaz). İçerik alana STRETCH edilir (object-fit: fill).
 * Video: giriş animasyonu İLK KARE HAZIR OLANA dek bekler (loadeddata). */
function Layer({ item, transition, loop, designPx, zincir = [], onEnded, onError }: { item: ZoneItem; transition: Transition; loop: boolean; designPx?: { w: number; h: number }; zincir?: string[]; onEnded?: () => void; onError?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);
  const isVideo = item.kind === "video";
  const [ready, setReady] = useState(!isVideo);
  const [on, setOn] = useState(transition === "cut");
  // URL öğesi ÖLÇEK DÜZELTMESİ: iframe, görsel/video gibi alana "stretch"
  // edilemez — sayfa gerçek CSS pikselinde çizilir. Küçük pencerede (telefon
  // önizlemesi) sayfanın yalnız sol üst köşesi görünüyordu. Çözüm: sayfayı hep
  // alanın TASARIM çözünürlüğünde render et, görünen alana scale(sx, sy) ile
  // sığdır. Gerçek TV'de sx=sy≈1 → davranış değişmez.
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (item.kind !== "url" || !designPx) return;
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((es) => {
      const r = es[0]?.contentRect;
      if (r && r.width > 0) setBox({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [item.kind, designPx]);
  // Emniyet: loadeddata hiç gelmezse (yavaş ağ/bozuk dosya) 1.2sn sonra yine gir
  useEffect(() => {
    if (!isVideo || ready) return;
    const t = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(t);
  }, [isVideo, ready]);
  useEffect(() => {
    if (transition === "cut" || !ready) return;
    if (ref.current) void ref.current.offsetWidth; // reflow
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setOn(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [transition, ready]);
  // 7/24 bellek disiplini: video elemanı sökülürken kaynağı gerçekten bırak
  useEffect(() => {
    return () => {
      const v = vidRef.current;
      if (v) {
        try {
          v.pause();
          v.removeAttribute("src");
          v.load();
        } catch {}
      }
    };
  }, []);

  // DONMA BEKÇİSİ: ağ koparsa video buffer bitiminde donar — ended de error da
  // gelmez, alan sonsuza dek donuk karede kalırdı. currentTime ~12sn ilerlemezse
  // zorla sıradakine geç (yalnız otomatik akışta ilerletilebilen videolar).
  useEffect(() => {
    if (item.kind !== "video" || !onEnded) return;
    let last = -1;
    let stuckMs = 0;
    let fired = false;
    const iv = window.setInterval(() => {
      const v = vidRef.current;
      if (!v || fired) return;
      if (v.currentTime === last) {
        stuckMs += 4000;
        if (stuckMs >= 12000) {
          fired = true;
          onEnded();
        }
      } else {
        last = v.currentTime;
        stuckMs = 0;
      }
    }, 4000);
    return () => window.clearInterval(iv);
  }, [item.kind, onEnded]);

  const style =
    transition === "slide"
      ? { transform: on ? "translateX(0)" : "translateX(100%)", transition: "transform 550ms ease" }
      : transition === "cut"
      ? {}
      : { opacity: on ? 1 : 0, transition: "opacity 500ms ease" };

  // Gömülü ekran: ya açıkça bağlanmış (kind "screen"), ya da ESKİDEN URL olarak
  // yapıştırılmış kendi Sign adresimiz. İkincisi bilerek destekleniyor —
  // üretimdeki linklerin de iframe yerine yerel çizilmesi için.
  const gomuluHedef =
    item.kind === "screen"
      ? item.screenId
        ? { id: item.screenId }
        : null
      : item.kind === "url"
        ? signAdresi(item.src, typeof window !== "undefined" ? window.location.origin : undefined)
        : null;
  // Foto sahne linki de aynı kapıdan: URL öğesi ama iframe DEĞİL, yerel çizim.
  const sahneId = item.kind === "url" ? sahneAdresi(item.src) : null;

  return (
    // isolation: içerideki z-index'ler (polaroid kartları zIndex 1..40) bu
    // katmanın İÇİNDE kalsın. Eski katman opacity:1 beklerken yığın bağlamı
    // oluşturmaz; kartlar alanın köküne sızıp ÜSTTE solan yeni katmanı
    // (z-index auto) yeniyordu — zemin doğru kaybolup kartlar sonraki
    // içeriğin üzerine binmiş görünüyordu.
    <div ref={ref} className="absolute inset-0" style={{ ...style, isolation: "isolate" }}>
      {gomuluHedef ? (
        <GomuluEkran hedef={gomuluHedef} box={designPx ?? { w: 1920, h: 1080 }} zincir={zincir} />
      ) : sahneId ? (
        <GomuluSahne id={sahneId} box={designPx ?? { w: 1920, h: 1080 }} />
      ) : item.kind === "video" ? (
        <video
          ref={vidRef}
          src={safeSrc(item.src)}
          autoPlay
          muted
          playsInline
          loop={loop}
          onLoadedData={() => setReady(true)}
          onEnded={onEnded}
          onError={onError}
          className="w-full h-full"
          style={{ objectFit: "fill" }}
        />
      ) : item.kind === "url" ? (
        // sandbox: üst pencereye yönlendirme/popup/indirme YOK. pointer-events-none:
        // tabela salt-görüntü. zoom: sayfa daha BÜYÜK sanal pencerede render edilip
        // ölçeklenir — dashboard grafikleri elle zoom gerekmeden sığar.
        <iframe
          src={safeSrc(item.src)}
          title={item.name || "sayfa"}
          sandbox="allow-scripts allow-same-origin allow-forms"
          referrerPolicy="no-referrer"
          className="absolute top-0 left-0 border-0 pointer-events-none"
          style={(() => {
            const zf = Math.min(150, Math.max(25, item.zoom ?? 100)) / 100;
            // Tasarım-piksel modu: sayfa, alanın gerçek (tasarım) çözünürlüğünde
            // render edilir ve görünen kutuya ölçeklenir — küçük pencerede de
            // TV'deki görüntünün birebir küçültülmüşü görünür.
            if (designPx && box)
              return {
                width: `${designPx.w / zf}px`,
                height: `${designPx.h / zf}px`,
                transform: `scale(${(box.w / designPx.w) * zf}, ${(box.h / designPx.h) * zf})`,
                transformOrigin: "top left",
              };
            // Ölçü henüz alınamadıysa eski yüzde tabanlı davranış (TV'de eşdeğer)
            return {
              width: `${10000 / (zf * 100)}%`,
              height: `${10000 / (zf * 100)}%`,
              transform: `scale(${zf})`,
              transformOrigin: "top left",
            };
          })()}
        />
      ) : item.kind === "text" ? (
        <TextView item={item} />
      ) : item.kind === "clock" ? (
        <ClockView item={item} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={safeSrc(item.src)} alt={item.name || ""} onError={onError} className="w-full h-full" style={{ objectFit: "fill" }} />
      )}
    </div>
  );
}

/** Sunum modunda kumandadan gelen gezinme sinyali (n her basışta artar). */
type NavSignal = { dir: 1 | -1; n: number };

function ZonePlayer({
  zone,
  stageW,
  stageH,
  manual = false,
  nav,
  onIndex,
  zincir = [],
}: {
  zone: Zone;
  /** Duvarın tasarım çözünürlüğü (px) — URL öğesinin ölçek düzeltmesi için. */
  stageW: number;
  stageH: number;
  /** Sunum modu: otomatik ilerleme kapalı; nav sinyaliyle gezinilir, uçlarda durur. */
  manual?: boolean;
  nav?: NavSignal;
  /** Sayaç için (yalnız en büyük alana verilir): aktif index + toplam. */
  onIndex?: (i: number, len: number) => void;
  /** Gömülü ekran zinciri (döngü koruması) — en dışta boş. */
  zincir?: string[];
}) {
  const transition: Transition = zone.transition ?? "fade";
  // Bu alanın tasarım-piksel ölçüsü (URL iframe'i bu boyutta render edilir)
  const designPx = useMemo(() => ({ w: Math.max(1, Math.round(stageW * zone.w)), h: Math.max(1, Math.round(stageH * zone.h)) }), [stageW, stageH, zone.w, zone.h]);
  const [now, setNow] = useState(() => new Date());
  // Takvim tiki dakika sınırına hizalı — "08:00'da başlar" gerçekten 08:00'da başlar
  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | undefined;
    const align = window.setTimeout(() => {
      setNow(new Date());
      iv = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000) + 250);
    return () => {
      window.clearTimeout(align);
      if (iv) clearInterval(iv);
    };
  }, []);

  // Bütün görselleri önceden yükle + DECODE et → geçişte boş kare/flaş olmaz.
  useEffect(() => {
    (zone.items ?? []).forEach((it) => {
      if (it.kind === "image" && it.src) {
        const img = new Image();
        img.src = it.src;
        img.decode?.().catch(() => {});
      }
    });
  }, [zone.items]);

  const items = useMemo(() => (zone.items ?? []).filter((it) => inWindow(it, now)), [zone.items, now]);
  const len = items.length;

  const [idx, setIdx] = useState(0);
  const advance = useCallback(() => setIdx((i) => i + 1), []);

  // Sunum modu gezinmesi: uçlarda durur (döngü yok)
  const lastNavN = useRef(0);
  useEffect(() => {
    if (!manual || !nav || nav.n === 0 || nav.n === lastNavN.current) return;
    lastNavN.current = nav.n;
    setIdx((i) => {
      const cur = ((i % Math.max(1, len)) + len) % Math.max(1, len);
      return Math.min(len - 1, Math.max(0, cur + nav.dir));
    });
  }, [nav, manual, len]);

  const cur = len ? items[((idx % len) + len) % len] : undefined;

  // Saat penceresi bir öğeyi düşürünce/ekleyince akış BAŞA SARMAZ: gösterilen
  // öğe hâlâ listedeyse kaldığı yerden sürer, değilse sıradakine geçilir.
  const curIdRef = useRef<string | undefined>(undefined);
  curIdRef.current = cur?.id ?? curIdRef.current;
  useEffect(() => {
    if (!len) return;
    const keep = items.findIndex((it) => it.id === curIdRef.current);
    setIdx((i) => (keep >= 0 ? keep : i % len));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [len]);
  const next = len > 1 ? items[(idx + 1) % len] : undefined;

  const keyRef = useRef(0);
  const [layers, setLayers] = useState<{ key: number; item: ZoneItem }[]>([]);
  useEffect(() => {
    if (!cur) {
      setLayers([]);
      return;
    }
    const k = keyRef.current++;
    setLayers((prev) => [...prev, { key: k, item: cur }].slice(-2));
    // Eski katman, YENİ katman görünür olana dek kalmalı (videoda pencere daha uzun).
    const holdMs = transition === "cut" ? 30 : cur.kind === "video" ? 2000 : 650;
    const t = window.setTimeout(() => setLayers((prev) => prev.slice(-1)), holdMs);
    return () => window.clearTimeout(t);
  }, [cur?.id, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sayaç bildirimi (sunum modunda sağ alt "3 / 12")
  useEffect(() => {
    if (!onIndex || !len) return;
    onIndex((((idx % len) + len) % len) + 1, len);
  }, [idx, len, onIndex]);

  // TEK ÖĞELİ URL BEKÇİSİ: hiç rotasyon olmadığından iframe bir kez açılıp
  // günlerce kalıyordu. 15 dk'da bir sessizce yeniden yüklenir.
  const [urlEpoch, setUrlEpoch] = useState(0);
  useEffect(() => {
    if (manual || len !== 1 || cur?.kind !== "url") return;
    const iv = window.setInterval(() => setUrlEpoch((e) => e + 1), 15 * 60_000);
    return () => window.clearInterval(iv);
  }, [manual, len, cur?.kind]);

  useEffect(() => {
    if (manual) return; // sunum modu: otomatik ilerleme YOK — kumanda söyler
    if (!cur || len <= 1) return;
    // Video: süre girilmişse ÜST SINIR; girilmemişse kendi bitişinde ilerler (onEnded).
    if (cur.kind === "video" && !cur.durationSec) return;
    const secs = Math.max(2, cur.durationSec ?? 8);
    const t = window.setTimeout(advance, secs * 1000);
    return () => window.clearTimeout(t);
  }, [cur, idx, len, advance, manual]);

  return (
    <div
      className="absolute overflow-hidden"
      /* containerType: metin/saat boyutlari ALANA gore olculsun diye.
         Eskiden `vw` kullaniliyordu, yani EKRANIN TAMAMINA gore: ucte bir
         genislikteki bir alanda yazi uc kat buyuk cikiyor ve saga sola
         tasip kesiliyordu (kullanici ekran goruntusu). Tek alanli duvarda
         cqw ile vw ayni sonucu verir. Olcu HEM genislige HEM yukseklige
         bagli (min(...cqw, ...cqh)): yalniz genislige baglayinca genis ama
         alcak alanlarda yazi gereksiz kuculuyordu (kullanici: "cok kucuk"),
         yalniz yukseklige baglayinca dar alanlarda tasiyordu. */
      style={{ left: `${zone.x * 100}%`, top: `${zone.y * 100}%`, width: `${zone.w * 100}%`, height: `${zone.h * 100}%`, background: zone.bg ?? ZONE_BG_DEFAULT, containerType: "size" }}
    >
      {layers.length === 0 ? (
        <BosAlan />
      ) : (
        layers.map((l, i) => {
          const top = i === layers.length - 1;
          return (
            <Layer
              key={`${l.key}-${urlEpoch}`}
              item={l.item}
              transition={transition}
              designPx={designPx}
              zincir={zincir}
              /* Sunum modunda video hep loop eder (sayfada kaldıkça döner) */
              loop={top && l.item.kind === "video" && (manual || len <= 1)}
              onEnded={top && !manual && l.item.kind === "video" && len > 1 ? advance : undefined}
              onError={top && !manual ? () => window.setTimeout(advance, 2000) : undefined}
            />
          );
        })
      )}
      {next?.kind === "video" && next.src && <video key={next.src} src={next.src} preload={designPx.w >= 900 ? "auto" : "metadata"} muted playsInline className="hidden" aria-hidden />}
    </div>
  );
}

export default function PlayerStage({ vw, draft = false }: { vw: Videowall; draft?: boolean }) {
  const [controls, setControls] = useState(false);
  const [fs, setFs] = useState(false);
  const [identify, setIdentify] = useState(false);
  // "← Kapat" yalnız DOKUNMATİK cihazlarda (telefon/tablet kontrolü): geri
  // tuşuyla listeye dönülebilsin. Fare/kiosk TV'lerde görünmez (yanlış tıkla
  // yayından çıkılmasın); geçmişsiz açılmış perdede sessizce hiçbir şey yapmaz.
  const [touchDevice, setTouchDevice] = useState(false);
  useEffect(() => {
    try {
      setTouchDevice(window.matchMedia("(pointer: coarse)").matches);
    } catch {}
  }, []);
  const closeSelf = () => {
    if (window.history.length > 1) window.history.back();
    else window.close();
  };

  // YAYIN modunda kaydedilmiş anlık görüntü oynar; draft=true → editörün "Önizle"si.
  const stage = draft ? vw : vw.live ?? vw;

  // ── SUNUM MODU: kumanda/klavye ile gezinme (tabela ekranlarını etkilemez) ──
  const manual = (vw.playMode ?? "auto") === "manual";
  const [nav, setNav] = useState<NavSignal>({ dir: 1, n: 0 });
  const [black, setBlack] = useState(false);
  const [counter, setCounter] = useState<{ i: number; len: number } | null>(null);
  const [counterDim, setCounterDim] = useState(true);
  const counterTimer = useRef<number | undefined>(undefined);
  const lastKeyRef = useRef(0);
  const onIndex = useCallback((i: number, len: number) => {
    setCounter({ i, len });
    setCounterDim(false);
    window.clearTimeout(counterTimer.current);
    counterTimer.current = window.setTimeout(() => setCounterDim(true), 1200);
  }, []);
  // Sayaç en büyük alana bağlanır (tipik kullanım: tek tam-ekran alan)
  const biggestZoneId = useMemo(() => {
    let best: Zone | null = null;
    for (const z of stage.zones ?? []) if (!best || z.w * z.h > best.w * best.h) best = z;
    return best?.id;
  }, [stage.zones]);

  useEffect(() => {
    if (!manual) return;
    const FWD: Record<string, 1> = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, " ": 1, Spacebar: 1, Enter: 1 };
    const BACK: Record<string, 1> = { ArrowLeft: 1, ArrowUp: 1, PageUp: 1, Backspace: 1 };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const k = e.key;
      // Bazı kumandalar "sunumu başlat" için F5 gönderir — sayfa YENİLENMESİN
      if (k === "F5") {
        e.preventDefault();
        void document.documentElement.requestFullscreen?.().catch(() => {});
        return;
      }
      if (k === "b" || k === "B" || k === ".") {
        e.preventDefault();
        setBlack((v) => !v);
        return;
      }
      if (k === "f" || k === "F") {
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        else void document.documentElement.requestFullscreen?.().catch(() => {});
        return;
      }
      if (FWD[k] || BACK[k]) {
        e.preventDefault();
        const nowMs = Date.now();
        if (nowMs - lastKeyRef.current < 150) return; // kumanda çift sinyal koruması
        lastKeyRef.current = nowMs;
        setBlack(false);
        setNav((p) => ({ dir: FWD[k] ? 1 : -1, n: p.n + 1 }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [manual]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Wake Lock: tek referansta tutulur; otomatik istek reddedilirse İLK kullanıcı
  // dokunuşunda bir kez daha denenir (ekran sessizce uyumasın).
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const requestWake = useCallback(async () => {
    try {
      await wakeRef.current?.release?.().catch(() => {});
      wakeRef.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      /* kullanıcı hareketi gerekebilir; pointerdown/tam ekran yeniden dener */
    }
  }, []);
  useEffect(() => {
    requestWake();
    const onVis = () => document.visibilityState === "visible" && requestWake();
    const onFirstPointer = () => {
      if (!wakeRef.current) requestWake();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pointerdown", onFirstPointer, { once: true });
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointerdown", onFirstPointer);
      wakeRef.current?.release?.().catch(() => {});
    };
  }, [requestWake]);

  // EKRAN SAĞLIĞI: perde BEAT_MS'te bir "canlıyım" yazar; kokpit çevrimiçi
  // gösterir. Aralık BURADA SABİT YAZILMAZ (eskiden `120_000` yazıyordu ve
  // lib'deki değerden habersizdi) — tek kaynak `@/lib/zones`.
  useEffect(() => {
    if (draft) return;
    sendScreenBeat(vw.id, true).catch(() => {});
    const iv = window.setInterval(() => sendScreenBeat(vw.id).catch(() => {}), BEAT_MS);
    return () => window.clearInterval(iv);
  }, [draft, vw.id]);

  // GECE TAZELEME (yalnız gerçek yayın): ~04:00-04:10 arası sessiz reload —
  // günlerce birikmiş bellek temizlenir, yeni sürüm alınır.
  useEffect(() => {
    if (draft) return;
    const now = new Date();
    const next = new Date(now);
    next.setHours(4, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const jitter = Math.floor(Math.random() * 10 * 60_000); // ekranlar aynı anda gitmesin
    const t = window.setTimeout(() => window.location.reload(), next.getTime() - now.getTime() + jitter);
    return () => window.clearTimeout(t);
  }, [draft]);

  const hideRef = useRef<number | undefined>(undefined);
  const poke = useCallback(() => {
    setControls(true);
    window.clearTimeout(hideRef.current);
    hideRef.current = window.setTimeout(() => setControls(false), 3000);
  }, []);

  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFs = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await document.documentElement.requestFullscreen();
        await requestWake(); // kullanıcı hareketi var → reddedilmişse şimdi alınır
      }
    } catch {}
  };

  const showIdentify = () => {
    setIdentify(true);
    window.setTimeout(() => setIdentify(false), 6000);
  };

  const screens = stage.cols * stage.rows;

  return (
    // onPointerDown da poke: dokunmatik ekranda "tap" move üretmez.
    <main
      className={`relative w-screen h-screen bg-black overflow-hidden ${controls ? "" : "cursor-none"}`}
      /* 100dvh: telefonda adres çubuğu görünürken 100vh GÖRÜNÜR alandan uzundur —
         perdenin alt %3-4'ü (foto sahne yazısı tam orada) çubuğun altında
         kalıyordu. dvh görünür alanı ölçer; desteklemeyen cihaz vh'de kalır. */
      style={{ height: "100dvh" }}
      onPointerMove={poke}
      onPointerDown={poke}
    >
      {stage.zones?.map((z) => (
        <ZonePlayer
          key={z.id}
          zone={z}
          stageW={stage.width}
          stageH={stage.height}
          manual={manual}
          nav={manual ? nav : undefined}
          onIndex={manual && z.id === biggestZoneId ? onIndex : undefined}
        />
      ))}

      {/* Sunum modu katmanları: siyah ekran (B) + sayaç */}
      {manual && (
        <div
          aria-hidden
          className="fixed inset-0 z-40 bg-black pointer-events-none transition-opacity duration-150"
          style={{ opacity: black ? 1 : 0 }}
        />
      )}
      {manual && counter && (
        <div
          className={`fixed bottom-5 right-6 z-40 rounded-xl bg-black/40 px-4 py-1.5 text-white text-2xl font-semibold tabular-nums transition-opacity duration-500 ${counterDim ? "opacity-0" : "opacity-90"}`}
          aria-hidden
        >
          {counter.i} / {counter.len}
        </div>
      )}

      {/* Önizleme rozeti — taslağı izlediğin belli olsun */}
      {draft && (
        <div className="fixed top-4 left-4 z-50 rounded-full bg-black/60 backdrop-blur border border-white/20 text-white/80 px-4 py-1.5 text-xs font-semibold">
          👁 Önizleme — taslak (yayında olmayabilir)
        </div>
      )}

      {identify && (
        <div className="fixed inset-0 z-40 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${stage.cols},1fr)`, gridTemplateRows: `repeat(${stage.rows},1fr)` }}>
          {Array.from({ length: screens }).map((_, i) => (
            <div key={i} className="border border-[#6366f1]/60 bg-[#0d102f]/80 grid place-items-center">
              <span className="font-display font-bold text-[#a5b4fc]" style={{ fontSize: "clamp(40px, 12vw, 260px)" }}>{i + 1}</span>
            </div>
          ))}
        </div>
      )}

      <div className={`fixed bottom-4 right-4 z-50 flex gap-2 transition-opacity ${controls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        {touchDevice && (
          <button onClick={closeSelf} className="rounded-xl bg-black/60 backdrop-blur border border-white/20 text-white px-4 py-2.5 text-sm font-semibold">
            ← Kapat
          </button>
        )}
        {screens > 1 && (
          <button onClick={showIdentify} className="rounded-xl bg-black/60 backdrop-blur border border-white/20 text-white px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-1.5">
            <Icon name="grid" size={15} /> Ekranları tanı
          </button>
        )}
        <button onClick={toggleFs} className="rounded-xl bg-black/60 backdrop-blur border border-white/20 text-white px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-1.5">
          <Icon name={fs ? "close" : "expand"} size={15} /> {fs ? "Tam ekrandan çık" : "Tam ekran"}
        </button>
      </div>
    </main>
  );
}
