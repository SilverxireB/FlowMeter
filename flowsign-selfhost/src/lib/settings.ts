/**
 * FlowSign self-host — UYGULAMA AYARLARI (`data/settings.json`).
 *
 * Neden var: paketi kuran BT ile onu günlük kullanan kişi AYNI kişi değil.
 * Kurumun adı, kök adresin hangi ekrana gideceği, yükleme sınırı — bunlar
 * bugüne dek koda gömülüydü, yani değiştirmek için yazılımcı gerekiyordu.
 *
 * TASARIM: parametre KAYIT DEFTERİ. Her satır kendi adını, ne işe yaradığını
 * ve DÜZENLENEBİLİR olup olmadığını taşır. Düzenlenemeyen satırlar dolgu değil,
 * kurulumun gerçeğidir: veri klasörünü bilmeyen bir sistem yöneticisi yedek
 * alamaz, sürümü bilmeyen destek isteyemez. Görünür ama değiştirilemez.
 *
 * DENETİM İZİ: her değişiklik KİMİN ve NE ZAMAN yaptığını yazar. Fabrikada
 * personel değişiyor ve sorulan soru hep aynı: "bunu kim değiştirdi?".
 *
 * Depolama: veritabanı yok — atomik JSON (elektrik kesilse yarım dosya kalmaz),
 * paketin geri kalanıyla aynı desen.
 */
import { promises as fs } from "fs";
import path from "path";
import { DATA_DIR } from "./store";
import { BEAT_MS } from "./zones";

export interface AyarKaydi {
  deger: string;
  /** Denetim izi — son değiştiren kişinin giriş adı ve zamanı (ms). */
  degistiren?: string;
  degistirilme?: number;
}

export type Ayarlar = Record<string, AyarKaydi>;

/** Bir parametrenin ne olduğu — değer değil, TANIM. */
export interface AyarTanim {
  anahtar: string;
  ad: string;
  aciklama: string;
  /** false = kurulumun gerçeği; gösterilir ama panelden değiştirilmez. */
  duzenlenebilir: boolean;
  tur: "metin" | "sayi";
  varsayilan: string;
  /** Sayı parametreleri için makul sınırlar (panel de bunu uygular). */
  enAz?: number;
  enCok?: number;
}

/**
 * KAYIT DEFTERİ. Buraya eklenmeyen ayar yoktur — panel bu listeden çizilir,
 * sunucu bu listeyle doğrular. Tek kaynak olması şart: iki liste tutulsaydı
 * panelde görünen ama sunucunun tanımadığı (ya da tersi) ayarlar çıkardı.
 */
export const TANIMLAR: AyarTanim[] = [
  {
    anahtar: "kurumAdi",
    ad: "Kurum adı",
    aciklama: "Kokpit başlığında ürün adının yanında görünür. Boş bırakılırsa yalnız ürün adı yazar.",
    duzenlenebilir: true,
    tur: "metin",
    varsayilan: "",
  },
  {
    anahtar: "varsayilanEkran",
    ad: "Varsayılan ekran",
    aciklama:
      "Sunucunun kök adresi (http://sunucu/) bu ekranın yayınına gider. Bir televizyonu adres yazmadan açmak için kullanılır. Ekranın kısa adı (slug) yazılır; boşsa ekran listesine gider.",
    duzenlenebilir: true,
    tur: "metin",
    varsayilan: "",
  },
  {
    anahtar: "maxGorselMB",
    ad: "Görsel boyut sınırı (MB)",
    aciklama: "Bundan büyük görsel yüklenmez. Sunucu diski dolmasın diye vardır; iç ağda cömert olabilir.",
    duzenlenebilir: true,
    tur: "sayi",
    varsayilan: "25",
    enAz: 1,
    enCok: 500,
  },
  {
    anahtar: "maxVideoMB",
    ad: "Video boyut sınırı (MB)",
    aciklama: "Bundan büyük video yüklenmez. Uzun tanıtım filmleri için yükseltilebilir.",
    duzenlenebilir: true,
    tur: "sayi",
    varsayilan: "500",
    enAz: 1,
    enCok: 5000,
  },
  // ── Kurulumun gerçeği: gösterilir, değiştirilmez ────────────────────────────
  {
    anahtar: "veriKlasoru",
    ad: "Veri klasörü",
    aciklama:
      "Ekranlar, medya ve kullanıcı defteri bu klasörde durur. YEDEK ALINACAK YER BURASIDIR. Değiştirmek için sunucudaki SIGN_DATA_DIR ortam değişkeni kullanılır.",
    duzenlenebilir: false,
    tur: "metin",
    varsayilan: "",
  },
  {
    anahtar: "nabizDk",
    ad: "Ekran nabzı (dakika)",
    aciklama:
      "Yayındaki her ekran bu sıklıkta 'canlıyım' yazar; kokpitteki çevrimiçi göstergesi ve yayın süresi buna dayanır. Kod sabitidir.",
    duzenlenebilir: false,
    tur: "sayi",
    varsayilan: "",
  },
  {
    anahtar: "surum",
    ad: "Paket sürümü",
    aciklama: "Destek isterken bu numarayı bildirin.",
    duzenlenebilir: false,
    tur: "metin",
    varsayilan: "",
  },
];

const AYAR_DOSYA = path.join(DATA_DIR, "settings.json");

async function oku(): Promise<Ayarlar> {
  try {
    return JSON.parse(await fs.readFile(AYAR_DOSYA, "utf8")) as Ayarlar;
  } catch {
    return {};
  }
}

async function yaz(a: Ayarlar): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const gecici = `${AYAR_DOSYA}.${process.pid}.tmp`;
  await fs.writeFile(gecici, JSON.stringify(a, null, 2), "utf8");
  await fs.rename(gecici, AYAR_DOSYA);
}

/**
 * Düzenlenemeyen satırların değeri diske YAZILMAZ, çalışma anında okunur —
 * yoksa sürüm yükseltilince paneldeki sürüm eski kalırdı (ve kimse fark etmezdi).
 */
function calismaAniDeger(anahtar: string): string | null {
  if (anahtar === "veriKlasoru") return DATA_DIR;
  if (anahtar === "nabizDk") return String(Math.round(BEAT_MS / 60_000));
  if (anahtar === "surum") return process.env.npm_package_version ?? "1.0.0";
  return null;
}

/** Panelin gördüğü tam tablo: tanım + geçerli değer + denetim izi. */
export async function ayarTablosu(): Promise<
  (AyarTanim & { deger: string; degistiren?: string; degistirilme?: number })[]
> {
  const kayit = await oku();
  return TANIMLAR.map((t) => ({
    ...t,
    deger: calismaAniDeger(t.anahtar) ?? kayit[t.anahtar]?.deger ?? t.varsayilan,
    degistiren: kayit[t.anahtar]?.degistiren,
    degistirilme: kayit[t.anahtar]?.degistirilme,
  }));
}

/** Tek ayarın değeri (sunucu tarafı kullanım). */
export async function ayar(anahtar: string): Promise<string> {
  const t = TANIMLAR.find((x) => x.anahtar === anahtar);
  return calismaAniDeger(anahtar) ?? (await oku())[anahtar]?.deger ?? t?.varsayilan ?? "";
}

/** Sayı ayarı — bozuk/eksik değerde varsayılana düşer (panel asla çökmez). */
export async function ayarSayi(anahtar: string): Promise<number> {
  const t = TANIMLAR.find((x) => x.anahtar === anahtar);
  const n = Number(await ayar(anahtar));
  return Number.isFinite(n) && n > 0 ? n : Number(t?.varsayilan ?? 0);
}

/**
 * Ayar yaz. Doğrulama SUNUCUDA: panel kapatılıp uca elle istek atılabilir,
 * o yüzden "düzenlenebilir mi" ve sayı sınırları burada da kontrol edilir.
 */
export async function ayarYaz(anahtar: string, deger: string, kim: string): Promise<void> {
  const t = TANIMLAR.find((x) => x.anahtar === anahtar);
  if (!t) throw new Error("Bilinmeyen ayar");
  if (!t.duzenlenebilir) throw new Error("Bu ayar panelden değiştirilemez");
  let temiz = String(deger).trim().slice(0, 200);
  if (t.tur === "sayi") {
    const n = Math.round(Number(temiz));
    if (!Number.isFinite(n)) throw new Error("Sayı bekleniyor");
    if (t.enAz !== undefined && n < t.enAz) throw new Error(`En az ${t.enAz} olabilir`);
    if (t.enCok !== undefined && n > t.enCok) throw new Error(`En çok ${t.enCok} olabilir`);
    temiz = String(n);
  }
  const kayit = await oku();
  kayit[anahtar] = { deger: temiz, degistiren: kim, degistirilme: Date.now() };
  await yaz(kayit);
}
