"use client";

/**
 * FlowSign içerik paneli — self-host kopyası. Seçili alana içerik ata:
 * görsel/video (sunucu diskine yüklenir, sürükle-bırak da çalışır), URL
 * (inline form, http(s) doğrulamalı — iç ağ adresleri serbest), METİN, SAAT +
 * medya kütüphanesinden tekrar kullan. Öğe başına süre + saat aralığı + günler;
 * "takvim dışı" rozeti; ⇄ Değiştir; sürükle VE ▲▼ ile sıralama (dokunmatik).
 * İçerik alana STRETCH edilir. Yazım → updateZones (taslak).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, IconName } from "@/components/icons";
import FlowSpinner from "@/components/FlowSpinner";
import { fixLiveSrc, listOrtakRaf, listWalls, rafaKoy as rafaKoyUc, raftanSil as raftanSilUc } from "@/lib/client";
import { adresDegistir, RafOgesi } from "@/lib/ortakRaf";
import { SAHNE_MODLARI, SAHNE_MODU_VARSAYILAN } from "@/lib/fotoSahne";
import { uploadMedia } from "@/lib/media";
import { icAgAdresi, itemInWindow, itemTakvimDurumu, ZONE_BG_DEFAULT } from "@/lib/zones";
import { Videowall, Zone, ZoneItem } from "@/lib/types";

const iid = () => `it-${Math.random().toString(36).slice(2, 9)}`;
const KIND_LABEL = { image: "Görsel", video: "Video", url: "URL", text: "Metin", clock: "Saat", screen: "Ekran", fotoSahne: "Foto sahne" } as const;
const DAYS = [
  { v: 1, l: "Pzt" }, { v: 2, l: "Sal" }, { v: 3, l: "Çar" }, { v: 4, l: "Per" },
  { v: 5, l: "Cum" }, { v: 6, l: "Cmt" }, { v: 0, l: "Paz" },
];
// Yerel disk sınırları (sunucu da aynı sınırı uygular) — aşan dosya yüklemeden
// ÖNCE insanca reddedilir.
const MAX_IMAGE_MB = 25;
const MAX_VIDEO_MB = 500;

const inputCls = "input-base !rounded-lg";

/**
 * Yerel gün, yyyy-mm-dd. `toISOString()` UTC'ye kayar — TR'de akşam saatlerinde
 * bir sonraki günü, gece yarısından hemen sonra bir önceki günü yazardı.
 */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/**
 * Takvim girdisinin seçilebilir EN ERKEN günü. Geçmiş tarih seçmek her zaman
 * hatadır (içerik daha kaydedilmeden ölü doğar), ama VAR OLAN değer geçmişte
 * olabilir — süregelen bir kampanya böyledir. O zaman sınır kendi değeridir,
 * yoksa tarayıcı çalışan içeriği geçersiz gösterirdi.
 */
const enErken = (mevcut: string | undefined, bugun: string) => (mevcut && mevcut < bugun ? mevcut : bugun);

function ItemThumb({ item }: { item: ZoneItem }) {
  const base = "w-14 h-14 rounded-lg overflow-hidden shrink-0 grid place-items-center";
  if (item.kind === "image" && item.src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.src} alt="" className={`${base} object-cover`} />;
  if (item.kind === "video" && item.src) return <div className={`${base} bg-ink/80 text-xl`}>🎬</div>;
  if (item.kind === "fotoSahne")
    return item.fotolar?.length ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.fotolar[0]} alt="" className={`${base} object-cover`} />
    ) : (
      <div className={`${base} bg-ink/80 text-xl`}>🖼</div>
    );
  if (item.kind === "text")
    return <div className={`${base} font-bold text-sm`} style={{ background: item.bg ?? "#312e81", color: item.color ?? "#fff" }}>Aa</div>;
  if (item.kind === "clock")
    return <div className={`${base} text-xl`} style={{ background: item.bg ?? "#0d102f", color: item.color ?? "#fff" }}>🕐</div>;
  return <div className={`${base} bg-paper border border-line text-xl`}>🔗</div>;
}

export default function ZonePanel({
  vw,
  zone,
  index,
  isAdmin,
  onZones,
  onSplit,
  onClose,
  onRehber,
}: {
  vw: Videowall;
  zone: Zone;
  index: number;
  /** Ortak raftan SİLME yalnız yöneticide (kullanıcı kararı: koymak herkese açık). */
  isAdmin?: boolean;
  onZones: (zones: Zone[]) => void;
  /** Bu alanı `parts` parçaya böl (h = yan yana, v = alt alta). */
  onSplit: (parcaC: number, parcaR: number, zonesOverride?: Zone[]) => void;
  onClose: () => void;
  /** Rehberi ilgili başlıkta aç (uyarının yanındaki "neden?" linki). */
  onRehber?: (bolum: string) => void;
}) {
  const [queue, setQueue] = useState<{ done: number; total: number; pct: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [fileOver, setFileOver] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  // Ekran seçici: bu alana bağlanacak BAŞKA ekran (yetki devri).
  const [screenPick, setScreenPick] = useState(false);
  const [screens, setScreens] = useState<Videowall[] | null>(null);
  const ekranOgesiVar = zone.items.some((it) => it.kind === "screen");
  useEffect(() => {
    if ((!screenPick && !ekranOgesiVar) || screens) return;
    listWalls()
      .then((r) => setScreens(r.walls.filter((v) => v.id !== vw.id)))
      .catch(() => setScreens([]));
  }, [screenPick, ekranOgesiVar, screens, vw.id]);
  const [libFilter, setLibFilter] = useState<"all" | "image" | "video">("all");
  /**
   * ORTAK RAF. Kütüphane iki sekme: "Bu ekran" ve "Ortak raf". Raf YALNIZ
   * pencere açıkken okunur — kokpit her açıldığında boşuna istek atmasın.
   */
  const [libTab, setLibTab] = useState<"ekran" | "ortak">("ekran");
  /**
   * FOTO SAHNE FOTOĞRAF SEÇİCİSİ. Ayrı bir pencere açmıyoruz: seçilecek şey
   * zaten kütüphanedeki medya. Bu değer doluyken kütüphane "sahneye ekle"
   * kipinde çalışır — aynı yüzey, iki iş; kullanıcı yeni bir yer öğrenmez.
   */
  const [fotoSecici, setFotoSecici] = useState<string | null>(null);
  const [raf, setRaf] = useState<RafOgesi[] | null>(null);
  const [rafBusy, setRafBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!libOpen) return;
    let iptal = false;
    listOrtakRaf()
      .then((l) => !iptal && setRaf(l))
      .catch(() => !iptal && setRaf([]));
    return () => {
      iptal = true;
    };
  }, [libOpen]);
  const [urlForm, setUrlForm] = useState<{ src: string; name: string } | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  // Sadeleştirme: süre/takvim/gün ayarları öğe başına AÇILIR (⚙) — panel
  // varsayılanda kompakt liste gösterir.
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const bugun = ymd(now);

  // Uzun yükleme sırasında kullanıcı sıralama/silme yapabilir → bitişte GÜNCEL
  // listeye ekle (bayat closure ile eski listeyi ezme).
  const zoneRef = useRef(zone);
  zoneRef.current = zone;

  const patch = (p: Partial<Zone>) => onZones((vw.zones ?? []).map((z) => (z.id === zone.id ? { ...z, ...p } : z)));
  const setItems = (items: ZoneItem[]) => patch({ items });

  // Kütüphane: TASLAK + YAYIN medyası (ızgara sıfırlansa da yüklenenler kaybolmaz).
  const library = useMemo(() => {
    const seen = new Set<string>();
    const out: ZoneItem[] = [];
    const pools = [...(vw.zones ?? []), ...(vw.live?.zones ?? [])];
    for (const z of pools)
      for (const it of z.items ?? [])
        if ((it.kind === "image" || it.kind === "video") && it.src && !seen.has(it.src)) {
          seen.add(it.src);
          out.push(it);
        }
    return out;
  }, [vw.zones, vw.live?.zones]);

  /**
   * ORTAK RAFA KOY. Dosya SUNUCUDA raf klasörüne TAŞINIR (kopyalanmaz), sonra
   * bu ekranın kendi öğeleri yeni adrese çevrilir.
   *
   * SIRA ÖNEMLİ: önce taşı, sonra adresleri çevir. Ortadaki bir hata en kötü
   * ihtimalle "rafta görünüyor ama benim ekranımda eski adres" bırakır — kırık
   * ekran değil. Ters sırada olsaydı adres çevrildiği an dosya henüz taşınmamış
   * olurdu ve perde kararırdı.
   */
  async function rafaKoy(it: ZoneItem) {
    if (!it.src || (it.kind !== "image" && it.kind !== "video")) return;
    setRafBusy(it.src);
    setErr(null);
    try {
      const oge = await rafaKoyUc({ src: it.src, kind: it.kind, name: it.name || "adsız", fromWall: vw.name });
      // Adres çevirme, taşımadan HEMEN sonra: bu ikisinin arasına başka bir
      // işlem girerse, hata durumunda öğe artık var olmayan bir adresi gösterir.
      onZones(adresDegistir(vw.zones, it.src, oge.src));
      // YAYIN da çevrilmeli: yalnız taslak çevrilirse yayındaki ekran artık var
      // olmayan adresi gösterir ve kütüphanede fotoğraf iki kez görünür.
      await fixLiveSrc(vw.id, vw.live, it.src, oge.src).catch(() => {});
      setRaf((r) => [oge, ...(r ?? [])]);
      setLibTab("ortak");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ortak rafa taşınamadı.");
    } finally {
      setRafBusy(null);
    }
  }

  /** Raftan KALICI sil — yalnız yönetici (sunucu da aynı kapıyı uygular). */
  async function rafSil(o: RafOgesi) {
    setRafBusy(o.src);
    setErr(null);
    try {
      await raftanSilUc(o.id);
      setRaf((r) => (r ?? []).filter((x) => x.id !== o.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Raftan silinemedi.");
    } finally {
      setRafBusy(null);
    }
  }

  /** Boyut/tür ön-kontrolü: geçenler + insanca ret nedenleri. */
  function precheck(files: File[]): { ok: File[]; rejected: string[] } {
    const ok: File[] = [];
    const rejected: string[] = [];
    for (const f of files) {
      const mb = f.size / (1024 * 1024);
      if (f.type.startsWith("image/")) {
        if (mb > MAX_IMAGE_MB) rejected.push(`${f.name} (görsel için sınır ~${MAX_IMAGE_MB} MB)`);
        else ok.push(f);
      } else if (f.type.startsWith("video/")) {
        if (mb > MAX_VIDEO_MB) rejected.push(`${f.name} (video için sınır ~${MAX_VIDEO_MB} MB)`);
        else ok.push(f);
      } else rejected.push(`${f.name} (desteklenmeyen tür)`);
    }
    return { ok, rejected };
  }

  async function uploadFiles(files: File[]) {
    setErr(null);
    const { ok, rejected } = precheck(files);
    const failed: string[] = [...rejected];
    const added: ZoneItem[] = [];
    for (let i = 0; i < ok.length; i++) {
      try {
        setQueue({ done: i, total: ok.length, pct: 0 });
        const res = await uploadMedia(ok[i], vw.id, (pct) => setQueue({ done: i, total: ok.length, pct }));
        added.push({ id: iid(), kind: res.type, src: res.url, name: ok[i].name.replace(/\.[^.]+$/, ""), durationSec: res.type === "image" ? 8 : undefined });
      } catch (e) {
        failed.push(`${ok[i].name} (${e instanceof Error ? e.message : "yükleme hatası"})`);
      }
    }
    setQueue(null);
    if (added.length) setItems([...zoneRef.current.items, ...added]);
    if (failed.length)
      setErr(`${added.length}/${added.length + failed.length} dosya yüklendi. Yüklenemeyenler: ${failed.join(" · ")}`);
    if (fileRef.current) fileRef.current.value = "";
  }

  /** ⇄ Değiştir: yeni dosya AYNI öğenin yerine geçer — sıra/takvim/süre korunur. */
  async function replaceFile(itemId: string, file: File) {
    setErr(null);
    const { ok, rejected } = precheck([file]);
    if (!ok.length) {
      setErr(`Değiştirilemedi: ${rejected[0]}`);
      return;
    }
    try {
      setQueue({ done: 0, total: 1, pct: 0 });
      const res = await uploadMedia(ok[0], vw.id, (pct) => setQueue({ done: 0, total: 1, pct }));
      setItems(
        zoneRef.current.items.map((it) =>
          it.id === itemId
            ? { ...it, kind: res.type, src: res.url, name: ok[0].name.replace(/\.[^.]+$/, ""), durationSec: res.type === "video" ? it.durationSec : it.durationSec ?? 8 }
            : it
        )
      );
    } catch (e) {
      setErr(`Değiştirilemedi: ${e instanceof Error ? e.message : "yükleme hatası"}`);
    } finally {
      setQueue(null);
      setReplacingId(null);
      if (replaceRef.current) replaceRef.current.value = "";
    }
  }

  // Gömülebilirlik kontrolü: site iframe'i reddediyorsa kullanıcıyı EKLERKEN uyar.
  async function warnIfNotEmbeddable(src: string) {
    try {
      const r = await fetch(`/api/embed-check?url=${encodeURIComponent(src)}`);
      const d = (await r.json()) as { verdict: string; host?: string };
      if (d.verdict === "blocked") {
        setErr(`⚠ ${d.host ?? "Bu site"} başka sayfaya gömülmeye izin vermiyor — videowall'da boş görünür. (Google/YouTube gibi büyük siteler bunu yasaklar; pano/dashboard siteleri genelde izin verir.)`);
      }
    } catch {}
  }

  function submitUrl() {
    if (!urlForm) return;
    const src = urlForm.src.trim();
    // Güvenlik: yalnız http(s) — javascript:/data: perde iframe'inde script çalıştırır.
    if (!/^https?:\/\//i.test(src)) {
      setErr("URL http:// veya https:// ile başlamalı.");
      return;
    }
    setErr(null);
    setItems([...zone.items, { id: iid(), kind: "url", src, name: urlForm.name.trim() || "Sayfa", durationSec: 15 }]);
    setUrlForm(null);
    void warnIfNotEmbeddable(src);
  }

  const addText = () => setItems([...zone.items, { id: iid(), kind: "text", title: "Başlık", text: "", bg: "#312e81", color: "#ffffff", durationSec: 10 }]);
  const addClock = () => setItems([...zone.items, { id: iid(), kind: "clock", bg: "#0d102f", color: "#ffffff", durationSec: 10 }]);
  /**
   * FOTO SAHNE ekle. Fotoğraflar öğenin KENDİ listesinde durur (alandaki gevşek
   * görsellerden ayrı) — yoksa aynı fotoğraf hem tek tek hem sahnede dönerdi.
   * Süre uzun başlar: modların ritmi saatlerce açık kalan bir perdeye göre;
   * 30 saniyede mod ısınamadan biter.
   */
  const addFotoSahne = () =>
    setItems([
      ...zone.items,
      { id: iid(), kind: "fotoSahne", name: "Foto sahne", fotolar: [], sahneModu: SAHNE_MODU_VARSAYILAN, durationSec: 300 },
    ]);

  /** Başka bir ekranı bu alana bağla — ADRESLE değil KİMLİKLE. */
  const addScreen = (hedef: Videowall) => {
    setItems([...zone.items, { id: iid(), kind: "screen", screenId: hedef.id, name: hedef.name }]);
    setScreenPick(false);
  };
  /**
   * Seçilen fotoğrafı AÇIK OLAN foto sahnenin listesine ekle. Pencere KAPANMAZ:
   * sahneye tek fotoğraf koyan yok, arka arkaya seçilir. Aynı fotoğraf iki kez
   * eklenmez — sahnede tekrar eden kare çirkin ve sebebi anlaşılmaz.
   */
  const sahneyeEkle = (src: string) => {
    if (!fotoSecici || !src) return;
    setItems(
      zone.items.map((x) =>
        x.id === fotoSecici && !(x.fotolar ?? []).includes(src)
          ? { ...x, fotolar: [...(x.fotolar ?? []), src] }
          : x
      )
    );
  };

  const addFromLib = (src: ZoneItem) => {
    // Yalnız dosyanın kendisi kopyalanır — eski öğenin takvimi/süresi GİZLİCE taşınmaz.
    setItems([
      ...zone.items,
      { id: iid(), kind: src.kind, src: src.src, name: src.name, durationSec: src.kind === "image" ? 8 : undefined },
    ]);
    setLibOpen(false);
  };

  const patchItem = (id: string, p: Partial<ZoneItem>) => setItems(zone.items.map((it) => (it.id === id ? { ...it, ...p } : it)));
  const removeItem = (id: string) => setItems(zone.items.filter((it) => it.id !== id));
  const toggleDay = (it: ZoneItem, d: number) => {
    const cur = it.days ?? [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
    patchItem(it.id, { days: next.length ? next : undefined });
  };
  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= zone.items.length) return;
    const arr = [...zone.items];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    setItems(arr);
  };
  const transition = zone.transition ?? "fade";

  // Alan ayarları BEKLEMEDE tutulur; Uygula'ya basılana kadar hiçbiri taslağa
  // yazılmaz (bölme ızgarayı katladığı için en çok o dert oluyordu).
  const [bekGecis, setBekGecis] = useState<"fade" | "cut" | "slide" | null>(null);
  const [bekZemin, setBekZemin] = useState<string | null>(null);
  const [bekBolme, setBekBolme] = useState<{ h: number | null; v: number | null }>({ h: null, v: null });
  const bekliyor = bekGecis !== null || bekZemin !== null || bekBolme.h !== null || bekBolme.v !== null;
  const bekleyenOzet =
    bekBolme.h || bekBolme.v
      ? `${bekBolme.h ?? 1} × ${bekBolme.v ?? 1} bölünecek — henüz uygulanmadı.`
      : "Seçimler henüz uygulanmadı.";
  const ayarlariAt = () => {
    setBekGecis(null);
    setBekZemin(null);
    setBekBolme({ h: null, v: null });
  };
  const ayarlariUygula = () => {
    const p: Partial<Zone> = {};
    if (bekGecis) p.transition = bekGecis;
    if (bekZemin) p.bg = bekZemin;
    const b = bekBolme;
    // TEK YAZIM. Eskiden önce patch() sonra onSplit() çağrılıyordu ve İKİSİ DE
    // aynı render'ın (bayat) vw.zones'unu okuyordu: bölme, hemen öncesinde
    // yazılan zemin/geçişi komple eziyordu. Kullanıcı "rengi seçtim, böldüm,
    // renk gitti" diyordu — üstelik panel kapandığı için doğrulayamıyordu bile.
    // Artık yama ÖNCE bellekte uygulanıp bölmeye o liste veriliyor.
    const yeni = Object.keys(p).length
      ? (vw.zones ?? []).map((z) => (z.id === zone.id ? { ...z, ...p } : z))
      : (vw.zones ?? []);
    ayarlariAt();
    if (b.h || b.v) onSplit(b.h ?? 1, b.v ?? 1, yeni);
    else if (Object.keys(p).length) onZones(yeni);
  };

  const allOutOfWindow = zone.items.length > 0 && zone.items.every((it) => !itemInWindow(it, now));

  // İkonlar SVG (online kopyayla aynı): işlevsel simge emoji olmaz — bu satır
  // uzun süre emojiyle kalmıştı ve iki kopya birbirinden ayrışmıştı.
  const ADD_BTNS: { label: string; icon: IconName; fn: () => void; disabled?: boolean; title?: string }[] = [
    { label: "Görsel / Video", icon: "image" as const, fn: () => fileRef.current?.click(), disabled: queue !== null },
    { label: "Kütüphane", icon: "folder" as const, fn: () => setLibOpen(true), disabled: library.length === 0 },
    { label: "URL", icon: "link" as const, fn: () => setUrlForm({ src: "", name: "" }) },
    { label: "Metin", icon: "pencil" as const, fn: addText },
    { label: "Saat", icon: "clock" as const, fn: addClock },
    { label: "Foto sahne", icon: "image" as const, fn: addFotoSahne },
    {
      label: "Ekran",
      icon: "monitor" as const,
      fn: () => setScreenPick(true),
      title: "Başka bir ekranı bu alana bağla (o ekranı başkası yönetebilir)",
    },
  ];

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setFileOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setFileOver(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files?.length) {
          e.preventDefault();
          setFileOver(false);
          uploadFiles(Array.from(e.dataTransfer.files));
        }
      }}
      className={`relative rounded-2xl border p-5 transition-colors ${fileOver ? "border-accent bg-accent-soft" : "border-line bg-white"}`}
    >
      {fileOver && (
        <div className="absolute inset-0 z-40 rounded-2xl border-2 border-dashed border-accent bg-white/80 grid place-items-center pointer-events-none">
          <p className="text-accent-dark font-semibold">Bırak → bu alana yükle</p>
        </div>
      )}

      {/* Başlık: alan adı + böl + kapat */}
      <div className="flex items-center gap-2 mb-4">
        <span className="shrink-0 w-8 h-8 rounded-lg bg-accent-soft text-accent-dark grid place-items-center text-sm font-bold">{index + 1}</span>
        <input
          defaultValue={zone.name ?? ""}
          placeholder={`Alan ${index + 1} — ad ver (ör. Giriş)`}
          onBlur={(e) => patch({ name: e.target.value.trim() || undefined })}
          className="flex-1 min-w-0 bg-transparent border-b border-line focus:border-accent focus:outline-none px-1 py-1.5 font-display font-semibold"
        />
        <button onClick={onClose} className="shrink-0 w-9 h-9 grid place-items-center rounded-xl text-muted hover:text-ink hover:bg-paper" aria-label="Paneli kapat">
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Hedef çözünürlük: içerik alana tam yayılır (stretch) → doğru boyutta
          hazırlansın diye alanın gerçek piksel ölçüsü söylenir */}
      <div className="mb-4 rounded-xl bg-accent-soft border border-accent/25 px-3 py-2 text-xs text-accent-dark">
        📐 Hedef çözünürlük:{" "}
        <b className="tabular-nums">{Math.round(vw.width * zone.w)} × {Math.round(vw.height * zone.h)} px</b>
      </div>

      {/* Tüm içerik takvim dışıysa uyarı — ekran boş görünür */}
      {allOutOfWindow && (
        <div className="mb-4 rounded-xl bg-brand-soft text-brand px-3 py-2 text-xs font-semibold">
          ⚠ Bu alanın tüm içeriği şu an takvim dışı — ekran bu alanda boş görünür.
        </div>
      )}

      {/* İçerik ekle */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {ADD_BTNS.map((b) => (
          <button
            key={b.label}
            onClick={b.fn}
            disabled={b.disabled}
            title={b.title}
            className="rounded-xl bg-paper border border-line hover:border-accent/60 hover:bg-accent-soft/40 px-2 py-3 text-sm font-semibold flex flex-col items-center gap-1 transition-colors disabled:opacity-40"
          >
            <Icon name={b.icon} size={20} />
            {b.label}
          </button>
        ))}
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => e.target.files && uploadFiles(Array.from(e.target.files))} />
        <input ref={replaceRef} type="file" accept="image/*,video/*" hidden onChange={(e) => e.target.files?.[0] && replacingId && replaceFile(replacingId, e.target.files[0])} />
      </div>

      {/* URL inline formu (prompt yerine — doğrulama gözünün önünde) */}
      {urlForm && (
        <div className="mb-4 rounded-xl bg-paper border border-accent/40 p-3 flex flex-col gap-2">
          <input
            autoFocus
            value={urlForm.src}
            onChange={(e) => setUrlForm({ ...urlForm, src: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && submitUrl()}
            placeholder="https://… (sayfa/dashboard adresi — iç ağ adresi de olur)"
            className={`${inputCls} px-3 py-2 text-sm`}
          />
          <input
            value={urlForm.name}
            onChange={(e) => setUrlForm({ ...urlForm, name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && submitUrl()}
            placeholder="Ad (opsiyonel)"
            className={`${inputCls} px-3 py-2 text-sm`}
          />
          {icAgAdresi(urlForm.src) && (
            <p className="text-[11px] text-[#8a6100] bg-[#eda100]/10 border border-[#eda100]/30 rounded-lg px-2.5 py-2">
              <b>İç ağ adresi.</b> Tarayıcı bu sayfayı gömerken bir kez &ldquo;yerel ağ erişimi&rdquo; izni
              sorar. Reddedilirse bir daha SORMAZ ve alan boş kalır; izni geri açmak için
              adres çubuğundaki site simgesi → Site ayarları → yerel ağ erişimi.
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={submitUrl} className="rounded-xl bg-accent hover:bg-accent-dark text-white px-4 py-2 text-sm font-semibold">Ekle</button>
            <button onClick={() => { setUrlForm(null); setErr(null); }} className="rounded-xl bg-white border border-line px-4 py-2 text-sm font-semibold hover:border-muted">Vazgeç</button>
            <span className="text-muted text-[11px]">
              Bazı siteler gömülmeye izin vermez — Önizle ile kontrol et.
              {onRehber && (
                <button onClick={() => onRehber("icerik")} className="ml-1 underline decoration-line hover:decoration-muted font-semibold">
                  Neden?
                </button>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Yüzde ve çubuk kalktı: küçük dosyalarda 0'da bekleyip birden 100 oluyor,
          arada "yüklenmiyor" hissi veriyordu. Dönen halka baştan sona hareket
          eder; DOSYA SAYACI kaldı, asıl ilerlemeyi o gösteriyor. */}
      {queue && (
        <div className="mb-4 flex items-center gap-3">
          <FlowSpinner
            size={72}
            center={<span className="text-[11px] font-bold tabular-nums text-ink">%{queue.pct}</span>}
          />
          {/* %100'de bir süre daha bekliyordu: baytlar gitti ama sunucu hâlâ
              işliyor (küçük görsellerde bu bekleme yüklemenin kendisinden uzun).
              Yüzdeyi kısmak yerine adı konuyor — kullanıcı neyi beklediğini bilsin. */}
          <p className="text-muted text-xs tabular-nums">
            {queue.pct >= 100 ? "İşleniyor…" : "Yükleniyor…"} {queue.done + 1}/{queue.total}
          </p>
        </div>
      )}
      {err && <p className="text-brand text-xs mb-3 font-semibold">{err}</p>}

      {/* Öğe listesi (sürükle-bırak + ▲▼) */}
      {zone.items.length === 0 ? (
        <div className="text-center py-10 text-muted border border-dashed border-line rounded-xl">
          <p className="text-3xl mb-2" aria-hidden>📺</p>
          <p className="text-sm">Bu alan boş. İçerik ekle ya da dosyayı buraya sürükle.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {zone.items.map((it, i) => {
            const takvim = itemTakvimDurumu(it, now);
            const outOfWindow = takvim !== "icinde";
            return (
              <li
                key={it.id}
                onDragOver={(e) => {
                  if (dragIdx === null) return;
                  e.preventDefault();
                  setOverIdx(i);
                }}
                onDrop={(e) => {
                  if (dragIdx === null) return;
                  e.preventDefault();
                  reorder(dragIdx, i);
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                className={`rounded-xl bg-paper border p-2.5 flex flex-col gap-2 transition-colors ${
                  overIdx === i && dragIdx !== null ? "border-accent" : "border-line"
                } ${dragIdx === i ? "opacity-40" : ""}`}
              >
                <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                  <span
                    draggable
                    onDragStart={() => setDragIdx(i)}
                    onDragEnd={() => {
                      setDragIdx(null);
                      setOverIdx(null);
                    }}
                    className="shrink-0 cursor-grab active:cursor-grabbing text-muted hover:text-ink px-1 py-2 select-none hidden sm:block"
                    title="Sürükle sırala"
                    aria-label="Sürükle sırala"
                  >
                    <Icon name="grip" size={16} />
                  </span>
                  {/* ▲▼ — dokunmatikte HTML5 sürükleme çalışmaz; tek dokunuşla sırala */}
                  <span className="shrink-0 flex flex-col">
                    <button onClick={() => reorder(i, i - 1)} disabled={i === 0} className="w-9 h-7 grid place-items-center text-muted hover:text-ink disabled:opacity-20" aria-label="Yukarı taşı"><Icon name="up" size={13} /></button>
                    <button onClick={() => reorder(i, i + 1)} disabled={i === zone.items.length - 1} className="w-9 h-7 grid place-items-center text-muted hover:text-ink disabled:opacity-20" aria-label="Aşağı taşı"><Icon name="down" size={13} /></button>
                  </span>
                  {/* SIRA NUMARASI — bu bir oynatma listesi ve asıl bilgi sıra:
                      "önce 3 sn görsel, sonra 9 sn video". Eskiden sırayı yalnız
                      satırların dizilişinden çıkarmak gerekiyordu; kaydırmalı uzun
                      listede "kaçıncıydı?" sorusunun cevabı yoktu. */}
                  <span className="shrink-0 w-6 h-6 rounded-full bg-wash border border-line grid place-items-center text-[11px] font-semibold text-muted tabular-nums">
                    {i + 1}
                  </span>
                  <ItemThumb item={it} />
                  {/* DAR EKRANDA KENDİ SATIRI. Telefonda ▲▼ + sıra no + minyatür +
                      ayar + sil sabit ~236px yer kaplıyor ve ada/rozetlere ~120px
                      kalıyordu: rozetler kutulara sıkışıp KARAKTER KARAKTER
                      sarıyordu ("9/sn", tarih dört satır). Artık ad ve rozetler
                      alta, tam genişliğe iner; sm+ ekranda eski tek satır düzeni
                      aynen kalır. (Rozetler ayrıca `truncate` — asla içeriden
                      kırılmaz, sığmazsa üç noktaya düşer.) */}
                  <div className="order-last basis-full sm:order-none sm:basis-auto flex-1 min-w-0">
                    {(() => {
                      // Bağlı ekranın adı, o ekranın GÜNCEL adıdır — bağlandığı
                      // andaki değil. Delege edilen kişi ekranını yeniden
                      // adlandırdığında burada eski ad kalmasın (bağ kimliğe
                      // kurulu, kopmuyor; yanıltan yalnız etiketti).
                      const taze = it.kind === "screen" ? screens?.find((v) => v.id === it.screenId)?.name : undefined;
                      const baslik =
                        it.kind === "text" ? it.title || "Metin" : it.kind === "clock" ? "Saat" : it.kind === "fotoSahne" ? `Foto sahne · ${(it.fotolar?.length ?? 0)} foto` : taze ?? it.name ?? it.src;
                      return (
                        <p className="text-sm font-semibold truncate" title={baslik}>
                          {baslik}
                        </p>
                      );
                    })()}
                    <span className="flex items-center gap-1.5 mt-1 flex-wrap min-w-0">
                      <span className="text-[10px] uppercase tracking-wider text-accent-dark bg-accent-soft rounded px-1.5 py-0.5 truncate max-w-full shrink-0">{KIND_LABEL[it.kind]}</span>
                      {/* Kompakt özet: ayrıntılar ⚙ ile açılır */}
                      <span className="text-[10px] text-muted bg-white border border-line rounded px-1.5 py-0.5 tabular-nums truncate max-w-full shrink-0">
                        ⏱ {it.kind === "video" && !it.durationSec ? "video sonu" : `${it.durationSec ?? 8} sn`}
                      </span>
                      {(it.from || it.to || it.days?.length || it.fromDate || it.toDate) && (
                        <span className="text-[10px] text-muted bg-white border border-line rounded px-1.5 py-0.5 tabular-nums truncate max-w-full shrink-0">
                          🗓 {it.fromDate || it.toDate ? `${(it.fromDate ?? "…").slice(5)} – ${(it.toDate ?? "…").slice(5)}` : "takvimli"}
                        </span>
                      )}
                      {it.kind === "url" && (it.zoom ?? 100) !== 100 && (
                        <span className="text-[10px] text-muted bg-white border border-line rounded px-1.5 py-0.5 truncate max-w-full shrink-0">🔍 %{it.zoom}</span>
                      )}
                      {takvim !== "icinde" && (
                        <span
                          className={`text-[10px] rounded px-1.5 py-0.5 truncate max-w-full shrink-0 ${
                            takvim === "doldu"
                              ? "bg-[#eda100]/12 text-[#8a6100] font-bold"
                              : takvim === "baslamadi"
                                ? "bg-accent-soft text-accent-dark"
                                : "text-ink/70 bg-line/60"
                          }`}
                        >
                          {takvim === "doldu" ? "süresi doldu" : takvim === "baslamadi" ? "henüz başlamadı" : "şu an takvim dışı"}
                        </span>
                      )}
                      {it.kind === "screen" && screens !== null && !screens.some((v) => v.id === it.screenId) && (
                        <span className="text-[10px] font-bold text-brand bg-brand-soft rounded px-1.5 py-0.5 truncate max-w-full shrink-0">⚠ bağlı ekran bulunamadı</span>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => setOpenItemId(openItemId === it.id ? null : it.id)}
                    className={`shrink-0 w-9 h-9 grid place-items-center rounded-lg hover:bg-white ${openItemId === it.id ? "text-accent-dark bg-white" : "text-muted hover:text-ink"}`}
                    title="Süre / takvim / ayarlar"
                    aria-label="Öğe ayarları"
                    aria-expanded={openItemId === it.id}
                  >
                    <Icon name="settings" size={15} />
                  </button>
                  <button onClick={() => removeItem(it.id)} className="shrink-0 w-9 h-9 grid place-items-center rounded-lg text-muted hover:text-brand hover:bg-brand-soft/50" aria-label="Sil">
                    <Icon name="trash" size={15} />
                  </button>
                </div>

                {/* Ayrıntılar yalnız ⚙ ile açılınca — panel kompakt kalır */}
                {openItemId === it.id && (
                  <>
                    {(it.kind === "image" || it.kind === "video" || it.kind === "url") && (
                      <div className="pl-9 flex flex-col gap-2">
                        {/* Yeniden adlandırma: kütüphanede/listede ayırt etmek için */}
                        <input
                          defaultValue={it.name ?? ""}
                          placeholder="Ad (ör. Yaz Kampanyası Afişi)"
                          onBlur={(e) => patchItem(it.id, { name: e.target.value.trim().slice(0, 60) || undefined })}
                          className={`${inputCls} px-3 py-2 text-sm w-full`}
                          aria-label="Öğe adı"
                        />
                        {/* "Dosyayı değiştir" SATIRDAN buraya indi: satırda üç ikon
                            düğmesi dar telefonda ada yer bırakmıyordu (ad "27 Tem…"
                            oluyordu). Nadir bir işlem, yeri ayrıntılar. */}
                        {(it.kind === "image" || it.kind === "video") && (
                          <button
                            onClick={() => {
                              setReplacingId(it.id);
                              replaceRef.current?.click();
                            }}
                            disabled={queue !== null}
                            className="self-start rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-muted hover:text-ink hover:border-muted disabled:opacity-30 inline-flex items-center gap-1.5"
                            title="Sıra ve takvim korunur"
                          >
                            <Icon name="swap" size={14} /> Dosyayı değiştir
                          </button>
                        )}
                        {/* Adres de düzenlenebilir — geçersizse eski değere döner */}
                        {it.kind === "url" && (
                          <input
                            defaultValue={it.src ?? ""}
                            placeholder="https://…"
                            inputMode="url"
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (/^https?:\/\//i.test(v) && v !== it.src) {
                                patchItem(it.id, { src: v });
                                void warnIfNotEmbeddable(v);
                              } else e.target.value = it.src ?? "";
                            }}
                            className={`${inputCls} px-3 py-2 text-xs w-full font-mono`}
                            aria-label="Sayfa adresi (URL)"
                          />
                        )}
                      </div>
                    )}
                    {it.kind === "fotoSahne" && (
                      <div className="flex flex-col gap-2.5 pl-9">
                        {/* MOD SEÇİCİ — modlar `lib/fotoSahne`ten türer, burada
                            elle liste yok: yeni mod eklenince seçici de rehber
                            de kendiliğinden güncellenir. */}
                        <div className="flex flex-wrap gap-1.5">
                          {SAHNE_MODLARI.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => patchItem(it.id, { sahneModu: m.id })}
                              title={m.ipucu}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                                (it.sahneModu ?? SAHNE_MODU_VARSAYILAN) === m.id
                                  ? "bg-ink text-white border-ink"
                                  : "bg-white border-line text-muted hover:border-muted"
                              }`}
                            >
                              {m.ad}
                            </button>
                          ))}
                        </div>
                        <p className="text-muted text-[11px]">
                          {SAHNE_MODLARI.find((m) => m.id === (it.sahneModu ?? SAHNE_MODU_VARSAYILAN))?.ipucu}
                        </p>

                        {/* SEÇİLİ FOTOĞRAFLAR — tıkla çıkar. */}
                        {(it.fotolar?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {(it.fotolar ?? []).map((f) => (
                              <button
                                key={f}
                                onClick={() => patchItem(it.id, { fotolar: (it.fotolar ?? []).filter((x) => x !== f) })}
                                title="Sahneden çıkar"
                                className="relative w-12 h-12 rounded-lg overflow-hidden border border-line hover:border-brand group"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={f} alt="" className="w-full h-full object-cover bg-black" />
                                <span className="absolute inset-0 bg-brand/70 opacity-0 group-hover:opacity-100 grid place-items-center text-white text-lg">×</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => setFotoSecici(it.id)}
                          className="self-start rounded-lg bg-paper border border-line px-3 py-1.5 text-xs font-semibold hover:border-muted inline-flex items-center gap-1.5"
                        >
                          <Icon name="image" size={13} /> Fotoğraf ekle ({it.fotolar?.length ?? 0})
                        </button>
                        {/* Süre uyarısı: modların ritmi uzun pencereye göre. */}
                        {(it.durationSec ?? 0) > 0 && (it.durationSec ?? 0) < 45 && (
                          <p className="text-[11px] font-semibold text-[#8a6100]">
                            ⚠ Süre kısa — sahne ısınmadan biter. 45 sn ve üstü önerilir.
                          </p>
                        )}
                      </div>
                    )}
                    {it.kind === "text" && (
                      <div className="flex flex-col gap-2 pl-9">
                        <input defaultValue={it.title ?? ""} placeholder="Başlık" onBlur={(e) => patchItem(it.id, { title: e.target.value })} className={`${inputCls} px-3 py-2 text-sm`} />
                        <textarea defaultValue={it.text ?? ""} placeholder="Mesaj (opsiyonel)" rows={2} onBlur={(e) => patchItem(it.id, { text: e.target.value })} className={`${inputCls} px-3 py-2 text-sm resize-y`} />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-9 text-xs text-muted">
                      {(it.kind === "text" || it.kind === "clock") && (
                        <>
                          <label className="flex items-center gap-1.5">Zemin <input type="color" defaultValue={it.bg ?? "#312e81"} onChange={(e) => patchItem(it.id, { bg: e.target.value })} className="w-7 h-7 rounded bg-transparent border border-line p-0.5 cursor-pointer" /></label>
                          <label className="flex items-center gap-1.5">Yazı <input type="color" defaultValue={it.color ?? "#ffffff"} onChange={(e) => patchItem(it.id, { color: e.target.value })} className="w-7 h-7 rounded bg-transparent border border-line p-0.5 cursor-pointer" /></label>
                        </>
                      )}
                      {it.kind === "url" && (
                        <label className="flex items-center gap-1.5" title="Sayfa daha büyük sanal pencerede açılıp ölçeklenir — dashboard grafikleri elle zoom gerekmeden sığar">
                          Yakınlaştırma
                          <select
                            defaultValue={it.zoom ?? 100}
                            onChange={(e) => patchItem(it.id, { zoom: Number(e.target.value) === 100 ? undefined : Number(e.target.value) })}
                            className={`${inputCls} px-2 py-1`}
                          >
                            {[25, 33, 50, 67, 75, 100, 125, 150].map((z) => (
                              <option key={z} value={z}>%{z}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      {it.kind === "url" && it.src && (
                        <a href={it.src} target="_blank" rel="noreferrer" className="text-accent hover:underline font-semibold" title="Sayfanın kendisi açılıyor mu diye hızlı kontrol">
                          Sayfayı yeni sekmede aç ↗
                        </a>
                      )}
                      <label className="flex items-center gap-1.5" title={it.kind === "video" ? "Boş bırakılırsa video sonuna kadar oynar" : undefined}>
                        {it.kind === "video" ? "Maks süre" : "Süre"}
                        <input
                          type="number"
                          min={2}
                          defaultValue={it.durationSec ?? (it.kind === "video" ? undefined : 8)}
                          placeholder={it.kind === "video" ? "video sonu" : "8"}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            patchItem(it.id, { durationSec: v >= 2 ? Math.round(v) : undefined });
                          }}
                          className={`w-20 ${inputCls} !px-2 !py-1 tabular-nums`}
                        />
                        sn
                      </label>
                      {/* DAR EKRANDA TAŞIYORDU: yerel tarih/saat girdilerinin
                          kendi asgari genişliği var ve etiketle birlikte tek
                          satırda ~380px istiyorlar; 360px telefonda ikinci girdi
                          ekranın dışında kalıyor, açılır oku kesiliyordu.
                          Etiket ayrı, girdi çifti tam genişlikte bir satır. */}
                      <label className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="shrink-0">Saat</span>
                        <span className="flex items-center gap-1.5 basis-full sm:basis-auto min-w-0">
                          <input type="time" defaultValue={it.from ?? ""} onBlur={(e) => patchItem(it.id, { from: e.target.value || undefined })} className={`${inputCls} px-2 py-1 min-w-0 flex-1`} />
                          –
                          <input type="time" defaultValue={it.to ?? ""} onBlur={(e) => patchItem(it.id, { to: e.target.value || undefined })} className={`${inputCls} px-2 py-1 min-w-0 flex-1`} />
                        </span>
                      </label>
                      {/* Kampanya aralığı: bitiş günü DAHİL; boş uç = sınırsız o yönde.
                          `min` ile GEÇMİŞ gün seçilemez (ölü doğan içerik) ve
                          bitiş başlangıcın gerisine alınamaz — aşağıdaki uyarı
                          yine de duruyor: `min` yalnız seçiciyi kısıtlar, elle
                          yazılan ya da eskiden kalan değeri engellemez. */}
                      <label className="flex flex-wrap items-center gap-1.5 min-w-0" title="Bu tarihler arasında döner, bitince kendiliğinden düşer (bitiş günü dahil)">
                        <span className="shrink-0">Tarih</span>
                        <span className="flex items-center gap-1.5 basis-full sm:basis-auto min-w-0">
                          <input type="date" min={enErken(it.fromDate, bugun)} defaultValue={it.fromDate ?? ""} onBlur={(e) => patchItem(it.id, { fromDate: e.target.value || undefined })} className={`${inputCls} px-2 py-1 min-w-0 flex-1`} />
                          –
                          <input type="date" min={[enErken(it.toDate, bugun), it.fromDate ?? ""].sort().pop()} defaultValue={it.toDate ?? ""} onBlur={(e) => patchItem(it.id, { toDate: e.target.value || undefined })} className={`${inputCls} px-2 py-1 min-w-0 flex-1`} />
                        </span>
                        {/* TERS ARALIK SESSİZ ÖLÜM. Başlangıç bitişten sonraysa
                            hiçbir gün iki koşulu birden sağlayamaz: içerik ASLA
                            dönmez ama rozet "henüz başlamadı" der ve kimse
                            sebebini anlamaz. Saatte ters aralık MEŞRU (22:00–06:00
                            geceyi aşar), tarihte her zaman hatadır. */}
                        {it.fromDate && it.toDate && it.fromDate > it.toDate && (
                          <span className="basis-full text-[11px] font-semibold text-brand">
                            ⚠ Başlangıç bitişten sonra — bu içerik hiç dönmez.
                          </span>
                        )}
                      </label>
                    </div>

                    {/* Günler (boşsa her gün) */}
                    <div className="flex items-center gap-1.5 pl-9 flex-wrap">
                      <span className="text-xs text-muted mr-1">Gün:</span>
                      {DAYS.map((d) => {
                        const active = it.days?.includes(d.v);
                        return (
                          <button
                            key={d.v}
                            onClick={() => toggleDay(it, d.v)}
                            className={`text-xs font-semibold rounded-full px-2.5 py-1.5 border ${active ? "bg-accent text-white border-accent" : "bg-white border-line text-muted hover:border-muted"}`}
                          >
                            {d.l}
                          </button>
                        );
                      })}
                      {!it.days?.length && <span className="text-[11px] text-muted ml-1">her gün</span>}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {/* Metindeki simge GERÇEK düğme ikonu olsun — "⚙" yazısı sliders ikonuyla
          uyuşmuyordu (iki uygulamada ikon farklı; bileşen ikisini de doğru gösterir). */}
      <p className="text-muted text-[11px] mt-3 inline-flex items-center gap-1">
        Süre ve takvim öğedeki <Icon name="settings" size={12} /> ile ayarlanır.
      </p>

      {/* ALAN AYARLARI — panelin EN ALTINDA ve UYGULA ile devreye girer.
          Üç karar, üçü de kullanıcıdan geldi:
           • YER: bunlar günlük iş değil, kurulum işi. Panelin tepesinde
             dururken içerik yüklemek isteyen kişi her açışta üstlerinden
             atlıyordu. Medya işinin altına indiler.
           • ZAMANLAMA: bölme, sayıya dokunulur dokunulmaz ızgarayı katlıyor ve
             diğer alanları ölçekliyordu — yanlış sayıya değmek geri alması zor
             bir değişiklikti. Seçimler artık BEKLEMEDE durur, Uygula devreye
             sokar, Vazgeç atar. Geçiş ve zemin de aynı kapıdan geçiyor ki
             "seçtim ama oldu mu?" belirsizliği doğmasın.
           • İKİ EKSEN BİRDEN: yan yana ve alt alta ayrı ayrı seçilip TEK
             hamlede uygulanır (3×2 gibi). İki ayrı bölme çağrısı ızgara değil
             merdiven üretiyordu — ayrıntı splitZoneInto'da. */}
      <div className="mt-6 pt-4 border-t border-line">
        <p className="text-xs font-semibold text-ink mb-3">Alan ayarları</p>

        <p className="text-xs text-muted mb-2">Bu alanı böl</p>
        <div className="flex flex-col gap-2">
          {([
            { axis: "h", label: "yan yana", icon: "⇄" },
            { axis: "v", label: "alt alta", icon: "⇅" },
          ] as const).map((dir) => (
            <div key={dir.axis} className="flex items-center gap-2">
              <span className="text-xs text-muted inline-flex items-center gap-1.5 w-24 shrink-0">
                <span aria-hidden>{dir.icon}</span>
                {dir.label}
              </span>
              {[2, 3, 4].map((n) => {
                const secili = bekBolme[dir.axis] === n;
                return (
                  <button
                    key={n}
                    onClick={() => setBekBolme((b) => ({ ...b, [dir.axis]: secili ? null : n }))}
                    aria-pressed={secili}
                    className={`w-9 h-9 rounded-xl border text-sm font-semibold ${secili ? "bg-ink text-white border-ink" : "border-line bg-white text-ink hover:border-accent hover:text-accent"}`}
                    title={`${dir.label} ${n} parçaya böl`}
                    aria-label={`${dir.label} ${n} parçaya böl`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <p className="text-muted text-[11px] mt-2">
          İçerik ilk parçada kalır. İkisini birden seçebilirsin.
        </p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs text-muted">
          <span className="flex items-center gap-2">
            Geçiş:
            {(["fade", "cut", "slide"] as const).map((tr) => (
              <button
                key={tr}
                onClick={() => setBekGecis(tr)}
                className={`px-2.5 py-1.5 rounded-full font-semibold border ${(bekGecis ?? transition) === tr ? "bg-ink text-white border-ink" : "bg-white border-line text-muted hover:border-muted"}`}
              >
                {tr === "fade" ? "Yumuşak" : tr === "cut" ? "Kesme" : "Kaydır"}
              </button>
            ))}
          </span>
          <label className="flex items-center gap-1.5">
            Alan zemini
            <input
              type="color"
              value={bekZemin ?? zone.bg ?? ZONE_BG_DEFAULT}
              onChange={(e) => setBekZemin(e.target.value)}
              className="w-7 h-7 rounded bg-transparent border border-line p-0.5 cursor-pointer"
            />
          </label>
        </div>

        {zone.items.length < 2 && (
          <p className="text-muted text-[11px] mt-2">
            Geçiş, yerleşim önizlemesinde ve perdede görünür — alanda en az 2 içerik olunca.
          </p>
        )}

        {bekliyor && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button onClick={ayarlariUygula} className="btn-primary !py-2 !px-4 text-xs">Uygula</button>
            <button onClick={ayarlariAt} className="btn-ghost !py-2 !px-3 text-xs">Vazgeç</button>
            <span className="text-muted text-[11px]">{bekleyenOzet}</span>
          </div>
        )}
      </div>

      {/* Medya kütüphanesi */}
      {(libOpen || fotoSecici) && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => { setLibOpen(false); setFotoSecici(null); }}>
          <div className="bg-white border border-line rounded-2xl p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-semibold">🗂 Medya kütüphanesi</p>
              <button onClick={() => { setLibOpen(false); setFotoSecici(null); }} className="w-9 h-9 grid place-items-center rounded-xl text-muted hover:text-ink hover:bg-paper" aria-label="Kapat"><Icon name="close" size={16} /></button>
            </div>
            {/* HATA BURADA DA GÖSTERİLİR. Panelin hata şeridi bu pencerenin
                ARKASINDA kalıyordu: kullanıcı "rafa koy" deyip hiçbir şey
                olmadığını görüyor, sebebini hiç öğrenemiyordu. Modal içindeki
                işlemin hatası modal içinde görünmeli. */}
            {err && (
              <div className="mb-3 rounded-xl bg-brand-soft text-brand px-3 py-2 text-xs font-semibold">{err}</div>
            )}

            {/* SEKMELER — "Bu ekran" ile "Ortak raf" AYRI iki havuz.
                Ortak raf bir depo değil DAĞITIM aracı: kurumsaldan gelen video
                bir kez rafa konur, herkes kendi ekranında oradan seçer (dosyayı
                aramak / USB'yle taşımak yok). Otomatik akmaz — paylaşmak bir
                EYLEMDİR, yoksa raf bir yılda çöplüğe döner. */}
            <div className="flex gap-1.5 mb-3">
              {([
                { v: "ekran", label: "Bu ekran", n: library.length },
                { v: "ortak", label: "Ortak raf", n: raf?.length ?? 0 },
              ] as const).map((t) => (
                <button
                  key={t.v}
                  onClick={() => setLibTab(t.v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    libTab === t.v ? "bg-ink text-white border-ink" : "bg-white border-line text-muted hover:border-muted"
                  }`}
                >
                  {t.label} ({t.n})
                </button>
              ))}
            </div>
            <p className="text-muted text-xs mb-3">
              {fotoSecici
                ? "Tıkla, foto sahneye ekle. Pencere açık kalır — birkaçını arka arkaya seçebilirsin."
                : libTab === "ekran"
                  ? "Bu ekrana yüklediğin medya (taslak + yayın). Tıkla, bu alana ekle."
                  : "Kurumun ortak medyası — herkes buradan seçebilir. Ekran silinse bile raf etkilenmez."}
            </p>

            {/* Tür sekmeleri: Tümü / Foto / Video */}
            <div className="flex gap-1.5 mb-3">
              {([
                { v: "all", label: "Tümü" },
                { v: "image", label: "📷 Foto" },
                { v: "video", label: "🎬 Video" },
              ] as const).map((t) => (
                <button
                  key={t.v}
                  onClick={() => setLibFilter(t.v)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    libFilter === t.v ? "bg-ink text-white border-ink" : "bg-white border-line text-muted hover:border-muted"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {libTab === "ekran" ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {library
                  .filter((it) => libFilter === "all" || it.kind === libFilter)
                  .map((it) => (
                    // Kart ARTIK düğme değil: içinde ikinci bir eylem var
                    // (rafa koy) ve iç içe düğme geçersiz HTML.
                    <div key={it.src} className="relative rounded-lg overflow-hidden border border-line hover:border-accent">
                      <button onClick={() => (fotoSecici ? sahneyeEkle(it.src!) : addFromLib(it))} className="block w-full text-left" title={fotoSecici ? "Sahneye ekle" : "Bu alana ekle"}>
                        <span className="block aspect-square relative">
                          {it.kind === "video" ? (
                            <span className="w-full h-full grid place-items-center bg-black text-2xl">🎬</span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.src} alt="" className="w-full h-full object-cover bg-black" />
                          )}
                        </span>
                        <span className="block px-1.5 py-1 text-[10px] text-muted truncate bg-paper">{it.name || "adsız"}</span>
                      </button>
                      {/* RAFA KOY — herkese açık (kullanıcı kararı). Köşede
                          durur, kartın asıl işini (alana ekle) gölgelemez. */}
                      <button
                        onClick={() => rafaKoy(it)}
                        disabled={rafBusy === it.src}
                        title="Ortak rafa koy — herkes kendi ekranında kullanabilsin"
                        aria-label="Ortak rafa koy"
                        className="absolute top-1 left-1 w-7 h-7 grid place-items-center rounded-lg bg-white/90 backdrop-blur border border-line text-muted hover:text-accent hover:border-accent disabled:opacity-40"
                      >
                        {rafBusy === it.src ? <FlowSpinner size={12} /> : <Icon name="upload" size={12} />}
                      </button>
                    </div>
                  ))}
              </div>
            ) : raf === null ? (
              <p className="text-muted text-sm text-center py-8">Raf okunuyor…</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {raf
                  .filter((o) => libFilter === "all" || o.kind === libFilter)
                  .map((o) => (
                    <div key={o.id} className="relative rounded-lg overflow-hidden border border-line hover:border-accent">
                      <button onClick={() => (fotoSecici ? sahneyeEkle(o.src) : addFromLib({ id: o.id, kind: o.kind, src: o.src, name: o.name }))} className="block w-full text-left" title={fotoSecici ? "Sahneye ekle" : "Bu alana ekle"}>
                        <span className="block aspect-square relative">
                          {o.kind === "video" ? (
                            <span className="w-full h-full grid place-items-center bg-black text-2xl">🎬</span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={o.src} alt="" className="w-full h-full object-cover bg-black" />
                          )}
                        </span>
                        <span className="block px-1.5 py-1 text-[10px] text-muted truncate bg-paper" title={o.by ? `Rafa koyan: ${o.by}` : undefined}>
                          {o.name || "adsız"}
                        </span>
                      </button>
                      {/* SİLME YALNIZ YÖNETİCİDE. Başkasının ekranında dönen
                          bir dosyayı silmek o duvarı karartır; koymak ucuz ve
                          geri alınabilir, silmek değil. */}
                      {isAdmin && (
                        <button
                          onClick={() => rafSil(o)}
                          disabled={rafBusy === o.src}
                          title="Raftan KALICI sil (başka ekranlar kullanıyor olabilir)"
                          aria-label="Raftan sil"
                          className="absolute top-1 left-1 w-7 h-7 grid place-items-center rounded-lg bg-white/90 backdrop-blur border border-line text-muted hover:text-brand hover:border-brand disabled:opacity-40"
                        >
                          {rafBusy === o.src ? <FlowSpinner size={12} /> : <Icon name="trash" size={12} />}
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}
            {(libTab === "ekran" ? library : raf ?? []).filter((o) => libFilter === "all" || o.kind === libFilter).length === 0 && (
              <p className="text-muted text-sm text-center py-8">
                {libTab === "ekran"
                  ? "Bu türde medya yok."
                  : "Ortak raf boş. Bir dosyayı \u201cBu ekran\u201d sekmesinden rafa koyabilirsin."}
              </p>
            )}
          </div>
        </div>
      )}
      {/* EKRAN SEÇİCİ — ekranın bir bölümünü başkasına yönettirmenin yolu.
          Adres değil KİMLİK saklanır: o kişi ekranının adını değiştirse de bağ
          kopmaz. Perde bağlı ekranın YAYININI çizer, taslağını değil — yani
          delege ettiğin kişi "Kaydet & Yayınla" demeden senin duvarında hiçbir
          şey değişmez. */}
      {screenPick && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => setScreenPick(false)}>
          <div className="bg-white border border-line rounded-2xl p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-display font-semibold inline-flex items-center gap-2"><Icon name="monitor" size={16} /> Ekran bağla</p>
              <button onClick={() => setScreenPick(false)} className="w-9 h-9 grid place-items-center rounded-xl text-muted hover:text-ink hover:bg-paper" aria-label="Kapat"><Icon name="close" size={16} /></button>
            </div>
            <p className="text-muted text-xs mb-4">
              Bu alan seçtiğin ekranın yayınını gösterir. O ekranı başkası yönetebilir — seninkine dokunamaz.
              Tasarımın ezilmemesi için o ekranın ölçüsü <b className="tabular-nums">{Math.round(vw.width * zone.w)}×{Math.round(vw.height * zone.h)}</b> olmalı.
            </p>
            {screens === null ? (
              <p className="text-muted text-sm text-center py-8">Yükleniyor…</p>
            ) : screens.length === 0 ? (
              <p className="text-muted text-sm text-center py-8">Bağlanabilecek başka ekran yok.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {screens.map((v) => (
                  <li key={v.id}>
                    <button
                      onClick={() => addScreen(v)}
                      className="w-full text-left rounded-xl border border-line hover:border-accent hover:bg-accent-soft/40 px-3 py-2.5"
                    >
                      <p className="font-semibold text-sm truncate">{v.name}</p>
                      <p className="text-muted text-xs tabular-nums">
                        {v.width}×{v.height}
                                                {v.live ? "" : " · henüz yayınlanmamış"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

