/**
 * YETKİ MATRİSİ DIŞA AKTARMA — "kim hangi ekranda ne yapabiliyor" tablosu.
 *
 * Neden var: fabrikada iç denetim/ISO sorusu tam olarak budur ve bugüne dek
 * cevabı ekrandan tek tek okumaktı. Dosya olarak verilebilmesi gerekiyor.
 *
 * ÜÇ TUZAK — üçü de dosya açılana kadar görünmez:
 *  1. AYIRICI. Excel'in kolon ayırıcısı işletim sistemi diline bağlı; Türkçe
 *     Windows'ta NOKTALI VİRGÜL. Virgülle yazılan dosya tek sütun olarak açılır
 *     ve "bozuk" sanılır. Noktalı virgül kullanılır.
 *  2. BOM. UTF-8 dosyayı Excel BOM'suz açınca "Üretim" → "Ãœretim" olur.
 *     Başa `﻿` konur.
 *  3. KAÇIŞ. Ekran adında noktalı virgül, tırnak ya da satır sonu olabilir
 *     ("Giriş; ana kapı"). Kaçırılmazsa sütunlar kayar ve tablo SESSİZCE
 *     yanlış okunur — denetim dosyasında en kötü hata türü.
 *
 * Dosyada YALNIZ en az bir yetkisi olan satırlar bulunur: soru "kim erişebilir",
 * cevabın içinde 800 satırlık "kimse erişemiyor" gürültüsü olmamalı.
 *
 * Sınav: `node tests/yetki-csv.test.mjs`
 */

export interface YetkiSatiri {
  kisi: string;
  girisAdi: string;
  ekran: string;
  view: boolean;
  edit: boolean;
  copy: boolean;
  delete: boolean;
  /** Yetki nereden geliyor: oluşturan / açık kayıt. */
  kaynak: string;
  /** Denetim izi — yetkiyi son değiştiren ve zamanı. */
  veren?: string;
  tarih?: number;
}

export const CSV_AYIRICI = ";";

/** Tek alanı kaçır: ayırıcı, tırnak ya da satır sonu varsa tırnakla ve içteki tırnağı ikile. */
export function csvAlan(v: string | number | undefined | null): string {
  const s = v === undefined || v === null ? "" : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const BASLIKLAR = [
  "Kişi", "Giriş adı", "Ekran", "Görüntüle", "Düzenle", "Kopyala", "Sil", "Kaynak", "Yetkilendiren", "Tarih",
];

const evetHayir = (b: boolean) => (b ? "Evet" : "Hayır");

const tarihYaz = (ms?: number) =>
  ms
    ? new Date(ms).toLocaleString("tr-TR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "";

/** Satırlar → Excel'in doğru açtığı CSV metni (BOM dahil). */
export function yetkiCsv(satirlar: YetkiSatiri[]): string {
  const govde = satirlar.map((s) =>
    [
      s.kisi, s.girisAdi, s.ekran,
      evetHayir(s.view), evetHayir(s.edit), evetHayir(s.copy), evetHayir(s.delete),
      s.kaynak, s.veren ?? "", tarihYaz(s.tarih),
    ]
      .map(csvAlan)
      .join(CSV_AYIRICI)
  );
  // ﻿ = BOM. Satır sonu CRLF: Excel'in beklediği budur (tek \n ile bazı
  // sürümler son sütunu bitişik okuyor).
  return `﻿${[BASLIKLAR.map(csvAlan).join(CSV_AYIRICI), ...govde].join("\r\n")}\r\n`;
}

/** Dosya adı: "sign-yetkileri-2026-08-04.csv" (tarih sıralanabilir olsun). */
export function yetkiDosyaAdi(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `sign-yetkileri-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.csv`;
}

/** Tarayıcıda indir — dış servis yok, dosya bellekte üretilir. */
export function csvIndir(metin: string, dosyaAdi: string): void {
  const url = URL.createObjectURL(new Blob([metin], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = dosyaAdi;
  a.click();
  // Sekme açık kaldıkça Blob bellekte tutulur; bırakılmazsa her dışa aktarma
  // birikir (uzun açık kalan kokpitte fark ediliyor).
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
