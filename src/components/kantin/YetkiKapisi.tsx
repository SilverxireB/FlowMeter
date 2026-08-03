"use client";

/**
 * Yetki kapısı — Tezgâh, Rapor, Ayarlar, Kişiler ve Pano'nun ortak girişi.
 *
 * Neden tek yerde: aynı ekran dört sayfada elle kopyalanmıştı, dördü de tasarım
 * sistemi dışı tipografiyle (`text-xl font-bold`) ve hiçbiri rolün YÜKLENMESİNİ
 * beklemiyordu. Kişi kaydı gelene kadar rol "personel"e düştüğü için görevli her
 * yenilemede önce "Yetki yok" görüyor, sonra ekran açılıyordu.
 *
 * Üç hâli ayırmak şart: "daha bilmiyorum" (bekle), "yetkin yok" (söyle),
 * "kantin atanmamış" (yöneticinin düzeltmesi gereken ayrı bir arıza — kişiye
 * yetki suçlaması gibi göstermek yanlış yere baktırıyordu).
 */
import { Icon, IconName } from "@/components/Icon";

export type KapiDurum = "bekle" | "yetkiYok" | "kantinYok" | "acik";

export function kapiDurumu({
  hazir,
  user,
  rolHazir,
  yetkili,
  seciliId,
  kantinGerekli = true,
}: {
  hazir: boolean;
  user: unknown;
  rolHazir: boolean;
  yetkili: boolean;
  seciliId?: string;
  kantinGerekli?: boolean;
}): KapiDurum {
  if (!hazir || !user || !rolHazir) return "bekle";
  if (!yetkili) return "yetkiYok";
  if (kantinGerekli && !seciliId) return "kantinYok";
  return "acik";
}

const METIN: Record<Exclude<KapiDurum, "acik">, { ikon: IconName; baslik: string; alt: string }> = {
  bekle: { ikon: "hourglass", baslik: "", alt: "" },
  yetkiYok: {
    ikon: "lock",
    baslik: "Bu ekran kantin görevlilerine açık",
    alt: "Yetki gerekiyorsa yöneticine söyle.",
  },
  kantinYok: {
    ikon: "warning",
    baslik: "Sana kantin atanmamış",
    alt: "Yönetici Kişiler ekranından atayınca burası çalışmaya başlar.",
  },
};

/** Aydınlık kokpit sayfaları için. */
export function YetkiKapisi({ durum }: { durum: Exclude<KapiDurum, "acik"> }) {
  if (durum === "bekle") {
    return <main className="min-h-[60vh] grid place-items-center bg-wash" aria-busy="true" />;
  }
  const m = METIN[durum];
  return (
    <main className="max-w-md mx-auto px-4 py-20 text-center">
      <span className="inline-grid place-items-center w-12 h-12 rounded-2xl bg-wash text-muted mb-3">
        <Icon name={m.ikon} size={22} />
      </span>
      <p className="font-display text-xl font-semibold">{m.baslik}</p>
      <p className="text-muted text-sm mt-1">{m.alt}</p>
    </main>
  );
}

/** Pano gibi KOYU tam ekran yüzeyler için aynı metin, koyu zemin. */
export function YetkiKapisiKoyu({ durum }: { durum: Exclude<KapiDurum, "acik"> }) {
  if (durum === "bekle") {
    return (
      <main className="fixed inset-0 bg-[#0b1020] grid place-items-center text-white/30 [color-scheme:dark]" aria-busy="true">
        <p className="text-lg animate-pulse">Bağlanıyor…</p>
      </main>
    );
  }
  const m = METIN[durum];
  return (
    <main className="fixed inset-0 bg-[#0b1020] grid place-items-center text-center px-6 [color-scheme:dark]">
      <div>
        <span className="inline-grid place-items-center w-12 h-12 rounded-2xl bg-white/8 text-white/60 mb-3">
          <Icon name={m.ikon} size={22} />
        </span>
        <p className="font-display text-2xl font-semibold text-white">{m.baslik}</p>
        <p className="text-white/50 text-sm mt-1">{m.alt}</p>
      </div>
    </main>
  );
}
