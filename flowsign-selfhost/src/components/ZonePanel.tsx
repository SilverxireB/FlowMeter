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
import { listWalls } from "@/lib/client";
import { RafDosyasi, rafListesi, rafaKoy, raftanSil, uploadMedia, uploadRafMedia } from "@/lib/media";
import { useSession } from "@/lib/useSession";
import { icAgAdresi, itemInWindow, itemTakvimDurumu, ZONE_BG_DEFAULT } from "@/lib/zones";
import { eslesir } from "@/lib/arama";
import ConfirmDialog from "@/components/ConfirmDialog";
import { MedyaKaydi, Videowall, Zone, ZoneItem } from "@/lib/types";

/** Kütüphane satırı: `kayit` = medya[] kaydı (yalnız bunlar silinebilir); `used` = bir alanda geçiyor. */
type LibEntry = { key: string; kind: "image" | "video"; src: string; name?: string; kayit?: MedyaKaydi; used: boolean };

const iid = () => `it-${Math.random().toString(36).slice(2, 9)}`;
const KIND_LABEL = { image: "Görsel", video: "Video", url: "URL", text: "Metin", clock: "Saat", screen: "Ekran" } as const;
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
  onZones,
  onSplit,
  onClose,
  onRehber,
}: {
  vw: Videowall;
  zone: Zone;
  index: number;
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
  const [libAra, setLibAra] = useState("");
  const [silOnay, setSilOnay] = useState<LibEntry | null>(null);
  const [silBusy, setSilBusy] = useState<string | null>(null);
  // Ortak raf: tüm ekranların havuzu. null = henüz okunmadı (sekme açılınca
  // sunucu gerçeğinden çekilir; her işlemden sonra null'a dönüp tazelenir).
  const [libKaynak, setLibKaynak] = useState<"ekran" | "raf">("ekran");
  const [raf, setRaf] = useState<RafDosyasi[] | null>(null);
  const [rafHata, setRafHata] = useState<string | null>(null);
  const [koyBusy, setKoyBusy] = useState<string | null>(null);
  const [rafSilOnay, setRafSilOnay] = useState<RafDosyasi | null>(null);
  const adminMi = useSession().me?.role === "admin";
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

  // Kütüphane: ekranın KENDİ medya[] listesi (kalıcı kayıt — alandan silinse de
  // kütüphanede durur; sunucu upload'da yazar) ∪ alanlardan türetilen eski medya
  // (eski ekranlar göç gerekmeden çalışır). medya[] önce ve son yüklenen ÜSTTE.
  const library = useMemo<LibEntry[]>(() => {
    const pools = [...(vw.zones ?? []), ...(vw.live?.zones ?? [])];
    const usedSrcs = new Set<string>();
    for (const z of pools) for (const it of z.items ?? []) if (it.src) usedSrcs.add(it.src);
    const seen = new Set<string>();
    const out: LibEntry[] = [];
    for (const m of [...(vw.medya ?? [])].reverse())
      if (m.src && !seen.has(m.src)) {
        seen.add(m.src);
        out.push({ key: m.id, kind: m.kind, src: m.src, name: m.name, kayit: m, used: usedSrcs.has(m.src) });
      }
    for (const z of pools)
      for (const it of z.items ?? [])
        if ((it.kind === "image" || it.kind === "video") && it.src && !seen.has(it.src)) {
          seen.add(it.src);
          out.push({ key: it.id, kind: it.kind, src: it.src, name: it.name, used: true });
        }
    return out;
  }, [vw.medya, vw.zones, vw.live?.zones]);
  const libGoster = library.filter((it) => (libFilter === "all" || it.kind === libFilter) && eslesir(it.name ?? "", libAra));
  const rafGoster = (raf ?? []).filter((it) => (libFilter === "all" || it.kind === libFilter) && eslesir(it.name, libAra));

  // Raf sekmesi açılınca listeyi SUNUCU GERÇEĞİNDEN çek (kayıt yok — klasör listelenir).
  useEffect(() => {
    if (!libOpen || libKaynak !== "raf" || raf !== null) return;
    setRafHata(null);
    rafListesi()
      .then(setRaf)
      .catch((e) => setRafHata(e instanceof Error ? e.message : "raf okunamadı"));
  }, [libOpen, libKaynak, raf]);

  /** Ekranın dosyasını rafa KOPYALA (taşıma değil) — sonra rafı göster. */
  async function rafaKoyTikla(m: LibEntry) {
    setErr(null);
    setKoyBusy(m.src);
    try {
      await rafaKoy(m.src);
      setRaf(null); // tazele
      setLibKaynak("raf"); // kullanıcı sonucu görsün
    } catch (hata) {
      setErr(`Rafa koyulamadı: ${hata instanceof Error ? hata.message : "bilinmeyen hata"}`);
    } finally {
      setKoyBusy(null);
    }
  }

  async function raftanSilTikla(d: RafDosyasi) {
    setErr(null);
    setSilBusy(d.publicId);
    try {
      await raftanSil(d);
      setRaf(null); // tazele
    } catch (hata) {
      setErr(`Silinemedi: ${hata instanceof Error ? hata.message : "bilinmeyen hata"}`);
    } finally {
      setSilBusy(null);
    }
  }

  /** Cihazdan doğrudan ORTAK RAFA yükleme — ekrana/alana yazmaz, raf tazelenir. */
  async function uploadFilesRaf(files: File[]) {
    setErr(null);
    const { ok, rejected } = precheck(files);
    const failed: string[] = [...rejected];
    let yuklendi = 0;
    for (let i = 0; i < ok.length; i++) {
      try {
        setQueue({ done: i, total: ok.length, pct: 0 });
        await uploadRafMedia(ok[i], (pct) => setQueue({ done: i, total: ok.length, pct }));
        yuklendi++;
      } catch (e) {
        failed.push(`${ok[i].name} (${e instanceof Error ? e.message : "yükleme hatası"})`);
      }
    }
    setQueue(null);
    if (yuklendi) setRaf(null); // sunucu gerçeğinden tazele
    if (failed.length)
      setErr(`${yuklendi}/${yuklendi + failed.length} dosya yüklendi. Yüklenemeyenler: ${failed.join(" · ")}`);
    if (fileRef.current) fileRef.current.value = "";
  }

  /** Kütüphaneden sil: sunucu kayıt + disk dosyasını birlikte düşürür;
   *  kullanımdaki dosyayı reddeder (perde kırık görselle kalmasın). */
  async function medyaSil(e: LibEntry) {
    if (!e.kayit) return;
    setErr(null);
    setSilBusy(e.kayit.id);
    try {
      const r = await fetch(`/api/upload?wall=${encodeURIComponent(vw.id)}&medya=${encodeURIComponent(e.kayit.id)}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `sunucu ${r.status}`);
    } catch (hata) {
      setErr(`Silinemedi: ${hata instanceof Error ? hata.message : "bilinmeyen hata"}`);
    } finally {
      setSilBusy(null);
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

  /**
   * hedef "kutuphane": pencereden yükleme — dosya KÜTÜPHANEYE girer (kaydı
   * sunucu upload rotası yazar), alana yerleştirme tıklamayla.
   * hedef "alan": panele sürükle-bırak — eskisi gibi hem kütüphaneye hem alana.
   */
  async function uploadFiles(files: File[], hedef: "kutuphane" | "alan" = "alan") {
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
    if (added.length && hedef === "alan") setItems([...zoneRef.current.items, ...added]);
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
  /** Başka bir ekranı bu alana bağla — ADRESLE değil KİMLİKLE. */
  const addScreen = (hedef: Videowall) => {
    setItems([...zone.items, { id: iid(), kind: "screen", screenId: hedef.id, name: hedef.name }]);
    setScreenPick(false);
  };
  const addFromLib = (m: LibEntry) => {
    // Yalnız dosyanın kendisi kopyalanır — eski öğenin takvimi/süresi GİZLİCE taşınmaz.
    setItems([
      ...zone.items,
      { id: iid(), kind: m.kind, src: m.src, name: m.name, durationSec: m.kind === "image" ? 8 : undefined },
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
    // "Görsel / Video" ayrı düğme değil (kullanıcı kararı): veri merkezi
    // KÜTÜPHANE — almak isteyen oraya girer, yüklemek isteyen oradan yükler.
    { label: "Kütüphane", icon: "folder" as const, fn: () => setLibOpen(true) },
    { label: "URL", icon: "link" as const, fn: () => setUrlForm({ src: "", name: "" }) },
    { label: "Metin", icon: "pencil" as const, fn: addText },
    { label: "Saat", icon: "clock" as const, fn: addClock },
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
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) =>
            e.target.files &&
            (libKaynak === "raf" ? uploadFilesRaf(Array.from(e.target.files)) : uploadFiles(Array.from(e.target.files), "kutuphane"))
          }
        />
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
          eder; DOSYA SAYACI kaldı, asıl ilerlemeyi o gösteriyor. Kütüphane
          penceresi açıkken gösterge ORADA — burada ikinci kopya çizilmez. */}
      {queue && !libOpen && (
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
                        it.kind === "text" ? it.title || "Metin" : it.kind === "clock" ? "Saat" : taze ?? it.name ?? it.src;
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
      {libOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => setLibOpen(false)}>
          <div className="bg-white border border-line rounded-2xl p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-semibold">🗂 Medya kütüphanesi</p>
              <button onClick={() => setLibOpen(false)} className="w-9 h-9 grid place-items-center rounded-xl text-muted hover:text-ink hover:bg-paper" aria-label="Kapat"><Icon name="close" size={16} /></button>
            </div>
            {/* İKİ KAYNAK: "Bu ekran" (medya[] kaydı) ve "Ortak raf" (tüm
                ekranların havuzu — data/media/ortak, ekran klasörlerinden YAPISAL
                olarak ayrı: ekran silme rafa değemez bile). Rafa koymak KOPYA,
                taşıma değil — ilk raf denemesi taşıma yüzünden çökmüştü. */}
            <div className="flex gap-1.5 mb-3">
              {(["ekran", "raf"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setLibKaynak(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 ${
                    libKaynak === k ? "bg-accent text-white border-accent" : "bg-white border-line text-muted hover:border-muted"
                  }`}
                >
                  <Icon name={k === "ekran" ? "monitor" : "folder"} size={13} />
                  {k === "ekran" ? "Bu ekran" : "Ortak raf"}
                </button>
              ))}
            </div>

            {/* YÜKLEME KAPISI BURADA (kullanıcı kararı): veri merkezi kütüphane —
                almak isteyen buraya girer, yüklemek isteyen BURADAN yükler.
                Adım 2: yüklenen dosya KÜTÜPHANEYE (ekranın medya[] kaydına)
                girer, alana yerleştirme tıklamayla. Panele sürükle-bırak ise
                eskisi gibi hem yükler hem alana koyar. Raf sekmesindeyken hedef RAFTIR. */}
            {queue ? (
              <div className="w-full mb-3 rounded-xl border-2 border-dashed border-accent/40 bg-accent-soft/30 px-3 py-4 flex items-center justify-center gap-3">
                <FlowSpinner
                  size={48}
                  center={<span className="text-[10px] font-bold tabular-nums text-ink">%{queue.pct}</span>}
                />
                <div>
                  {/* %100'de sunucu hâlâ işliyor olabilir — adı konur, kullanıcı neyi beklediğini bilir. */}
                  <p className="text-sm font-semibold text-ink">{queue.pct >= 100 ? "İşleniyor…" : "Yükleniyor…"}</p>
                  <p className="text-muted text-xs tabular-nums">
                    Dosya {queue.done + 1}/{queue.total} — bitince {libKaynak === "raf" ? "rafta" : "kütüphanede"} en üstte
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full mb-3 rounded-xl border-2 border-dashed border-line hover:border-accent hover:bg-accent-soft/20 text-muted hover:text-accent px-3 py-4 flex flex-col items-center gap-1.5 transition-colors disabled:opacity-40 group"
              >
                <span className="w-10 h-10 rounded-full bg-paper group-hover:bg-accent-soft grid place-items-center transition-colors">
                  <Icon name="upload" size={17} />
                </span>
                <span className="text-sm font-semibold text-ink">Cihazdan yükle</span>
                <span className="text-[11px]">
                  {libKaynak === "raf"
                    ? "Görsel veya video — ORTAK rafa eklenir, tüm ekranlar kullanır"
                    : "Görsel veya video — kütüphaneye eklenir, tıklayınca alana girer"}
                </span>
              </button>
            )}

            {/* Hata MODALIN İÇİNDE — paneldeki şerit bu pencerenin arkasında kalıyor. */}
            {err && <p className="text-brand text-xs mb-3 font-semibold">{err}</p>}

            {/* Arama + tür sekmeleri (Türkçe duyarlı — lib/arama); iki kaynakta da çalışır */}
            {(libKaynak === "raf" ? (raf ?? []) : library).length > 0 && (
              <div className="relative mb-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                  <Icon name="search" size={14} />
                </span>
                <input
                  value={libAra}
                  onChange={(e) => setLibAra(e.target.value)}
                  placeholder="Medyada ara…"
                  className={`${inputCls} !pl-9 w-full px-3 py-2 text-sm`}
                  aria-label="Kütüphanede medya ara"
                />
              </div>
            )}
            <div className="flex gap-1.5 mb-3">
              {(() => {
                const liste: { kind: "image" | "video" }[] = libKaynak === "raf" ? (raf ?? []) : library;
                return ([
                  { v: "all", label: `Tümü (${liste.length})` },
                  { v: "image", label: `📷 Foto (${liste.filter((i) => i.kind === "image").length})` },
                  { v: "video", label: `🎬 Video (${liste.filter((i) => i.kind === "video").length})` },
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
                ));
              })()}
            </div>

            {libKaynak === "ekran" ? (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {libGoster.map((it) => (
                    <div
                      key={it.key}
                      className={`relative rounded-lg overflow-hidden border border-line hover:border-accent ${
                        silBusy === it.kayit?.id || koyBusy === it.src ? "opacity-50" : ""
                      }`}
                    >
                      <button onClick={() => addFromLib(it)} className="block w-full text-left" disabled={silBusy !== null || koyBusy !== null}>
                        <span className="block aspect-square relative">
                          {it.kind === "video" ? (
                            <span className="w-full h-full grid place-items-center bg-black text-2xl">🎬</span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.src} alt="" className="w-full h-full object-cover bg-black" />
                          )}
                          {/* Hiçbir alanda geçmiyor → temizlik adayı (rozet + silinebilir) */}
                          {!it.used && (
                            <span className="absolute bottom-1 left-1 rounded bg-amber-100 text-amber-800 text-[9px] font-semibold px-1 py-0.5">
                              kullanılmıyor
                            </span>
                          )}
                        </span>
                        {/* Dosya adı — hangi dosya olduğu görünsün */}
                        <span className="block px-1.5 py-1 text-[10px] text-muted truncate bg-paper">
                          {it.name || "adsız"}
                        </span>
                      </button>
                      {/* Ortak rafa koy = KOPYA — dosya bu ekrandan gitmez, raftaki
                          kopyanın adresi ayrıdır (ekran silinse de raf yaşar). */}
                      <button
                        onClick={() => rafaKoyTikla(it)}
                        disabled={silBusy !== null || koyBusy !== null}
                        className="absolute top-1 left-1 w-6 h-6 grid place-items-center rounded-md bg-white/90 border border-line text-muted hover:text-accent hover:border-accent/40 disabled:opacity-40"
                        aria-label={`${it.name || "adsız"} dosyasını ortak rafa koy`}
                        title="Ortak rafa koy (kopyalar — buradan silmez)"
                      >
                        <Icon name="folder" size={12} />
                      </button>
                      {/* Silme yalnız KULLANILMAYAN kayıtlarda: kullanılan dosyayı silmek
                          perdeyi kırık görselle bırakır — önce alandan çıkarılır. */}
                      {it.kayit && !it.used && (
                        <button
                          onClick={() => setSilOnay(it)}
                          disabled={silBusy !== null || koyBusy !== null}
                          className="absolute top-1 right-1 w-6 h-6 grid place-items-center rounded-md bg-white/90 border border-line text-muted hover:text-brand hover:border-brand/40 disabled:opacity-40"
                          aria-label={`${it.name || "adsız"} dosyasını kütüphaneden sil`}
                          title="Kütüphaneden sil"
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {libGoster.length === 0 && (
                  <p className="text-muted text-sm text-center py-8">
                    {library.length === 0
                      ? "Henüz medya yok — yukarıdan Cihazdan yükle ile başla."
                      : libAra
                        ? "Aramaya uyan medya yok."
                        : "Bu türde medya yok."}
                  </p>
                )}
              </>
            ) : raf === null && !rafHata ? (
              <p className="text-muted text-sm text-center py-8">Raf okunuyor…</p>
            ) : rafHata ? (
              <p className="text-brand text-sm text-center py-8">
                Raf okunamadı: {rafHata}{" "}
                <button onClick={() => setRaf(null)} className="underline font-semibold">
                  Yeniden dene
                </button>
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {rafGoster.map((d) => (
                    <div
                      key={d.publicId}
                      className={`relative rounded-lg overflow-hidden border border-line hover:border-accent ${silBusy === d.publicId ? "opacity-50" : ""}`}
                    >
                      <button
                        onClick={() => addFromLib({ key: d.publicId, kind: d.kind, src: d.src, name: d.name, used: true })}
                        className="block w-full text-left"
                        disabled={silBusy !== null}
                      >
                        <span className="block aspect-square relative">
                          {d.kind === "video" ? (
                            <span className="w-full h-full grid place-items-center bg-black text-2xl">🎬</span>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={d.src} alt="" className="w-full h-full object-cover bg-black" />
                          )}
                        </span>
                        <span className="block px-1.5 py-1 text-[10px] text-muted truncate bg-paper">{d.name || "adsız"}</span>
                      </button>
                      {/* Raftan silme YALNIZ yönetici — herkes ekler, temizliğe tek el karar verir. */}
                      {adminMi && (
                        <button
                          onClick={() => setRafSilOnay(d)}
                          disabled={silBusy !== null}
                          className="absolute top-1 right-1 w-6 h-6 grid place-items-center rounded-md bg-white/90 border border-line text-muted hover:text-brand hover:border-brand/40 disabled:opacity-40"
                          aria-label={`${d.name || "adsız"} dosyasını raftan sil`}
                          title="Raftan sil (yönetici)"
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {rafGoster.length === 0 && (
                  <p className="text-muted text-sm text-center py-8">
                    {(raf ?? []).length === 0
                      ? "Ortak raf boş — Cihazdan yükle ya da bir ekranın dosyasını rafa koy."
                      : libAra
                        ? "Aramaya uyan medya yok."
                        : "Bu türde medya yok."}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {silOnay && (
        <ConfirmDialog
          title="Kütüphaneden sil"
          message={`"${silOnay.name || "adsız"}" kalıcı olarak silinecek — diskteki dosya da gider. Bu işlem geri alınamaz.`}
          confirmLabel="Sil"
          danger
          onConfirm={() => {
            const e = silOnay;
            setSilOnay(null);
            void medyaSil(e);
          }}
          onCancel={() => setSilOnay(null)}
        />
      )}

      {rafSilOnay && (
        <ConfirmDialog
          title="Ortak raftan sil"
          message={`"${rafSilOnay.name || "adsız"}" raftan kalıcı olarak silinecek. Başka ekranlar bu dosyayı kullanıyor olabilir — oralarda görüntü kırılır. Bu işlem geri alınamaz.`}
          confirmLabel="Sil"
          danger
          onConfirm={() => {
            const d = rafSilOnay;
            setRafSilOnay(null);
            void raftanSilTikla(d);
          }}
          onCancel={() => setRafSilOnay(null)}
        />
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

