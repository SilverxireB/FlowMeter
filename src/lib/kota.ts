/**
 * MEDYA KOTASI — Cloudinary `usage` yanıtının SAF şekillendirmesi.
 *
 * Neden ayrı dosya: bu mantık plana göre dallanıyor ve sınanabilir olmalı.
 * Cloudinary iki farklı şema döndürüyor ve hangisinin geleceğini biz seçmiyoruz:
 *  - kredi tabanlı planlar `credits: {usage, limit, used_percent}` verir,
 *  - eski/kotalı planlar her ölçüye kendi `limit`ini koyar, `credits` yoktur,
 *  - bazı planlar hiç üst sınır bildirmez (yüzde hesaplanamaz).
 * Yalnız birini tanıyan kod, plan değişince sessizce "bilinmiyor" derdi — ve
 * sağlık panelinde sessiz "bilinmiyor", kotanın dolduğunu görmemek demektir.
 *
 * Sınav: `node tests/kota-okuma.test.mjs`
 */

export interface KotaOlcu {
  ad: string;
  kullanim: number | null;
  limit: number | null;
  yuzde: number | null;
  /** Değer bayt mı (GB/MB olarak yazılır) yoksa adet mi. */
  bayt: boolean;
}

export interface KotaOzeti {
  plan: string | null;
  /** Cloudinary rakamı GÜNLÜK toparlar — "şu an" değildir, tarihi yazılır. */
  guncellendi: string | null;
  kredi: { kullanilan: number | null; limit: number | null; yuzde: number | null } | null;
  olculer: KotaOlcu[];
  dosya: number | null;
}

interface HamOlcu {
  usage?: number;
  limit?: number;
  used_percent?: number;
}

/** Yüzde: önce Cloudinary'nin hazır `used_percent`i, yoksa usage/limit. */
export function olcuYuzde(o: HamOlcu | undefined | null): number | null {
  if (!o) return null;
  if (typeof o.used_percent === "number") return o.used_percent;
  if (typeof o.usage === "number" && typeof o.limit === "number" && o.limit > 0) return (o.usage / o.limit) * 100;
  return null;
}

/** Ham `usage` yanıtı → panelin gösterdiği özet. */
export function kotaOzeti(u: Record<string, unknown>): KotaOzeti {
  const al = (k: string) => u[k] as HamOlcu | undefined;
  const kredi = al("credits");
  const tanimlar: { ad: string; anahtar: string; bayt: boolean }[] = [
    { ad: "Depolama", anahtar: "storage", bayt: true },
    { ad: "Bant genişliği", anahtar: "bandwidth", bayt: true },
    { ad: "Dönüşüm", anahtar: "transformations", bayt: false },
  ];
  return {
    plan: typeof u.plan === "string" ? u.plan : null,
    guncellendi: typeof u.last_updated === "string" ? u.last_updated : null,
    kredi: kredi ? { kullanilan: kredi.usage ?? null, limit: kredi.limit ?? null, yuzde: olcuYuzde(kredi) } : null,
    olculer: tanimlar
      .map((t) => ({ t, o: al(t.anahtar) }))
      .filter((x) => Boolean(x.o))
      .map(({ t, o }) => ({
        ad: t.ad,
        kullanim: o!.usage ?? null,
        limit: o!.limit ?? null,
        yuzde: olcuYuzde(o),
        bayt: t.bayt,
      })),
    dosya: typeof u.resources === "number" ? u.resources : null,
  };
}

/**
 * Panelin bakacağı TEK sayı: en dolu ölçü. Krediyle ölçüleri birlikte değerlendirir
 * — kredi %10'dayken bant genişliği %95 olabilir ve asıl duracak yer odur.
 * Hiçbir ölçü üst sınır bildirmiyorsa null (uydurma yüzde yazılmaz).
 */
export function enDoluYuzde(o: KotaOzeti): number | null {
  const hepsi = [o.kredi?.yuzde ?? null, ...o.olculer.map((m) => m.yuzde)].filter(
    (y): y is number => typeof y === "number"
  );
  return hepsi.length ? Math.max(...hepsi) : null;
}

/**
 * Doluluk → panel rengi. DİKKAT: bu bir SKOR DEĞİL. Ürünün skor semantiğinde
 * büyük sayı iyidir (yeşil ≥70); kotada büyük sayı KÖTÜDÜR, o yüzden eşikler
 * ters çalışır. Ayrı bir işlev olması şart: sağlık paneliyle sınav aynı sayıya
 * baksın, biri "iyileştirirken" eşiği sessizce kaydırmasın.
 */
export function kotaDurumu(yuzde: number | null): "ok" | "uyari" | "hata" | "bilinmiyor" {
  if (yuzde === null) return "bilinmiyor";
  if (yuzde >= 90) return "hata";
  if (yuzde >= 70) return "uyari";
  return "ok";
}

/** Bayt → "1,4 GB" / "820 MB" (küçük değerler GB'de sıfır görünüyordu). */
export function bayt(n: number): string {
  const gb = n / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(gb < 10 ? 1 : 0).replace(".", ",")} GB`;
  const mb = n / 1024 ** 2;
  return `${mb.toFixed(mb < 10 ? 1 : 0).replace(".", ",")} MB`;
}
