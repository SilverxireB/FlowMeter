"use client";

/**
 * KANTİN kabuğu — Flow Studio'dan TAMAMEN ayrı bir uygulama yüzeyi.
 * Studio'nun başlığı, logosu, sekmeleri burada YOK; ortak olan yalnız çekirdek
 * (Firebase, tasarım sistemi sınıfları). Kaldırmak = `src/app/kantin` +
 * `src/lib/kantin` klasörlerini silmek.
 *
 * Kabuğun üç işi var:
 *  1. "Siparişin hazır" şeridi — hangi sayfada olursan ol görünür. Uyarı da
 *     kabuk düzeyinde (bkz. lib/kantin/oturum): sayfa değiştirince susmasın.
 *  2. Çevrimdışı şeridi — sessizce eskiyen ekran, yanlış bilgi veren ekrandır.
 *  3. Gezinme: personelde telefonda ALT çubuk (başparmak oraya yetişir),
 *     görevlide üstte sekmeler (onlar tablet kullanıyor).
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cikisYap } from "@/lib/kantin/api";
import { KantinOturum, useKantin } from "@/lib/kantin/oturum";
import { KantinRol } from "@/lib/kantin/types";
import { Icon, IconName } from "@/components/Icon";
import { usePlayTarget } from "@/lib/usePlayTarget";
import ProfilTamamla from "./ProfilTamamla";

/** Rol rozeti: "neden bu sekmeleri görüyorum" sorusunun tek kelimelik cevabı. */
const ROL_ETIKET: Record<KantinRol, string> = {
  admin: "Yönetici",
  kantinci: "Görevli",
  personel: "Personel",
};

export default function KantinKabuk({ children }: { children: React.ReactNode }) {
  return (
    <KantinOturum>
      <Icerik>{children}</Icerik>
    </KantinOturum>
  );
}

interface Sekme {
  href: string;
  label: string;
  ikon: IconName;
}

function Icerik({ children }: { children: React.ReactNode }) {
  const { user, kisi, kisiYok, rol, kantinler, seciliId, secKantin, acikSiparisler, cevrimici } = useKantin();
  const path = usePathname();
  const router = useRouter();
  // Erken return'lerin ÜSTÜNDE: kanca sırası koşula bağlanamaz.
  const panoHedef = usePlayTarget();

  const yonetici = rol === "admin" || rol === "kantinci";
  // Sekmeler İKİ öbek: kişinin kendi siparişi ve kantini yönetmek. Eskiden hepsi
  // tek sırada gevşek çiplerdi — yedi çip yan yana dizilince hangisinin ne işe
  // yaradığı kayboluyordu. Öbek ayracı "burada rolüm değişiyor" diyor.
  //
  // Kantinci sipariş VERMEZ, hazırlar: tezgâhın arkasındaki kişiye "Menü" ve
  // "Siparişim" göstermek dört sekmelik işi altı sekme gibi gösteriyordu.
  const siparisSekmeleri: Sekme[] =
    rol === "kantinci"
      ? []
      : [
          { href: "/kantin/menu", label: "Menü", ikon: "list" },
          { href: "/kantin/siparisim", label: "Siparişim", ikon: "receipt" },
        ];
  const yonetimSekmeleri: Sekme[] = yonetici
    ? ([
        { href: "/kantin/tezgah", label: "Tezgâh", ikon: "grid" },
        { href: "/kantin/rapor", label: "Rapor", ikon: "chart" },
        { href: "/kantin/ayarlar", label: "Ayarlar", ikon: "settings" },
        ...(rol === "admin" ? [{ href: "/kantin/kisiler", label: "Kişiler", ikon: "users" }] : []),
      ] as Sekme[])
    : [];

  if (!user) return <>{children}</>;
  // Hesabı var ama kişi kaydı yok → önce ad/sicil (bkz. ProfilTamamla).
  if (kisiYok) return <ProfilTamamla />;
  // Pano TAM EKRAN bir yüzey (kantindeki TV): başlık/sekme çerçevesi olmaz.
  if (path === "/kantin/pano") return <>{children}</>;

  const hazirVar = acikSiparisler.some((s) => s.durum === "hazir");
  const altCubuk = !yonetici; // personel telefonda: başparmak alt çubuğa yetişir
  // Kantin kimliği bağlantıya işlenir: pano TV'de tek URL olarak sabitlenebilsin
  // (o ekranda kabuk gizli, dolayısıyla kantin seçici de yok).
  const panoHref = seciliId ? `/kantin/pano?kantin=${seciliId}` : "/kantin/pano";

  return (
    // touch-action: tezgâhta ıslak/hızlı dokunuş çift dokunuşla sayfayı
    // yakınlaştırıyordu. Bu, yakınlaştırmayı tümden kapatmadan (WCAG) yalnız
    // çift-dokunuş zoom'unu kaldırır; parmakla büyütme çalışmaya devam eder.
    <div className="min-h-screen bg-wash [touch-action:manipulation]">
      {!cevrimici && (
        <p className="bg-[#8a6100] text-white text-xs text-center py-1.5 px-4">
          Bağlantı yok — durum güncellenmiyor olabilir.
        </p>
      )}

      <header className="bg-white/85 backdrop-blur border-b border-line px-4 sm:px-6 py-3 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Ana ekrana eklenen simgenin AYNISI: uygulamayı açan kişi aynı
                işareti görsün, "doğru yerdeyim" sorusu hiç doğmasın. */}
            <img src="/kantin-icon-192.png" alt="" width={32} height={32} className="w-8 h-8 rounded-xl shrink-0" />
            <span className="font-display text-lg font-semibold tracking-tight shrink-0">Kantin</span>
            {/* Kantinci kendi kantinine bağlıdır — seçim yalnız diğerlerinde. */}
            {kantinler.length > 1 && rol !== "kantinci" && (
              <select
                value={seciliId}
                onChange={(e) => secKantin(e.target.value)}
                aria-label="Kantin seç"
                className="input-base !py-1 !px-2 text-xs !w-auto max-w-[10rem]"
              >
                {kantinler.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.ad}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            {/* Ad telefonda da GÖRÜNÜR: eskiden `hidden sm:inline` idi, telefonda
                kimin hesabıyla girildiği hiçbir yerde yazmıyordu. */}
            <span className="text-muted text-xs truncate max-w-[6.5rem] sm:max-w-none">
              {kisi?.ad ?? user.email}
            </span>
            <span className="chip !py-0.5 !px-2 text-[11px] text-muted shrink-0 hidden xs:inline-flex sm:inline-flex">
              {ROL_ETIKET[rol]}
            </span>
            <button
              onClick={() => void cikisYap().then(() => router.replace("/kantin/giris"))}
              className="btn-ghost !py-1.5 !px-3 text-xs shrink-0 min-h-[40px]"
              aria-label="Çıkış yap"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      {/* Siparişin hazır — her sayfada, tek dokunuşla siparişe götürür */}
      {/* Kantinci'ye gösterilmez: onun sipariş sekmesi yok, şerit çıkmaz sokağa
          götürürdü — üstelik tezgâhta zaten tüm siparişleri görüyor. */}
      {hazirVar && rol !== "kantinci" && path !== "/kantin/siparisim" && (
        <Link
          href="/kantin/siparisim"
          className="block bg-[#1baf7a] text-white px-4 py-2.5 text-sm font-semibold text-center animate-pop"
        >
          Siparişin hazır — tezgâhtan alabilirsin →
        </Link>
      )}

      {/* Üst sekmeler: görevli/yönetici (tablet) */}
      {!altCubuk && (
        <nav className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-1 rounded-full bg-wash border border-line p-1 overflow-x-auto max-w-full">
            {siparisSekmeleri.map((s) => (
              <SekmeDugmesi key={s.href} sekme={s} aktif={path === s.href} rozet={s.href === "/kantin/siparisim" && acikSiparisler.length > 0} />
            ))}
            {siparisSekmeleri.length > 0 && yonetimSekmeleri.length > 0 && (
              <span className="w-px h-5 bg-line mx-1 shrink-0" aria-hidden />
            )}
            {yonetimSekmeleri.map((s) => (
              <SekmeDugmesi key={s.href} sekme={s} aktif={path === s.href} />
            ))}
          </div>
          {/* Pano bir SEKME değil, açılan bir ekran (kantindeki TV). Suite kuralı:
              tam ekran yüzeyler usePlayTarget ile açılır — masaüstünde yeni
              sekme, telefon/PWA'da aynı pencere (geri tuşu uygulamayı kapatmasın). */}
          {yonetici && (
            <a
              href={panoHref}
              target={panoHedef}
              rel={panoHedef ? "noopener" : undefined}
              className="btn-ghost !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 shrink-0"
            >
              <Icon name="monitor" size={15} />
              Panoyu aç
              {panoHedef && <span aria-hidden>↗</span>}
            </a>
          )}
        </nav>
      )}

      <div style={altCubuk ? { paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom))" } : undefined}>
        {children}
      </div>

      {/* Alt çubuk: personel (telefon) */}
      {altCubuk && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur border-t border-line"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="max-w-xs mx-auto flex">
            {siparisSekmeleri.map((s) => {
              const aktif = path === s.href;
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 min-h-[56px] justify-center relative ${
                    aktif ? "text-accent" : "text-muted"
                  }`}
                >
                  <Icon name={s.ikon} size={20} />
                  <span className="text-[11px] font-semibold">{s.label}</span>
                  {s.href === "/kantin/siparisim" && acikSiparisler.length > 0 && (
                    <span
                      className={`absolute top-1.5 right-[calc(50%-1.35rem)] w-2.5 h-2.5 rounded-full ${
                        hazirVar ? "bg-[#1baf7a]" : "bg-accent"
                      }`}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

/**
 * Segment şeridinin tek düğmesi. Şerit bir "ray" üstünde durduğu için aktif
 * olan kabarık, diğerleri sessiz — yedi gevşek çipte kaybolan "neredeyim"
 * bilgisi böyle tek bakışta okunuyor.
 *
 * Aktif sekme BİLEREK dolu ink değil: dolu ink bu uygulamada FİLTRE dili
 * (menü kategorisi, rapor aralığı). İkisi aynı görünürse "Tezgâh" sekmesi ile
 * "7 gün" filtresi ekranda ayırt edilemiyordu. Gezinme = beyaz kabartma.
 */
function SekmeDugmesi({ sekme, aktif, rozet }: { sekme: Sekme; aktif: boolean; rozet?: boolean }) {
  return (
    <Link
      href={sekme.href}
      aria-current={aktif ? "page" : undefined}
      className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 min-h-[42px] text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
        aktif ? "bg-white text-accent shadow-sm" : "text-muted hover:text-ink"
      }`}
    >
      <Icon name={sekme.ikon} size={16} />
      {sekme.label}
      {rozet && (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />
          <span className="sr-only">açık siparişin var</span>
        </>
      )}
    </Link>
  );
}
