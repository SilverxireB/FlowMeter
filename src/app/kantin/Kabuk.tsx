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
 *  3. Gezinme EKRANA göre: telefonda alt çubuk (başparmak oraya yetişir),
 *     tablet/masaüstünde üstte segment şeridi. Role göre DEĞİL — telefonundan
 *     bakan yönetici de vardı ve altı sekmeyi yatay kaydırıyordu.
 */
import Link from "next/link";
import { useState } from "react";
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
  const [dahaAcik, setDahaAcik] = useState(false);

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
  // Gezinme biçimi EKRAN GENİŞLİĞİNE göre seçilir, role göre değil. Eskiden
  // "görevliler tablet kullanır" varsayımıyla role bağlıydı: telefonundan bakan
  // yönetici altı sekmeyi yatay kaydırmak zorunda kalıyordu. Seçim artık saf
  // CSS (sm kırılımı) — JS'te rol dalı yok, iki çubuk da doğru yerde.
  //
  // Telefonda alt çubuğa en fazla 4 sekme + "Daha" sığar; gerisi sayfaya
  // yayılmak yerine bir sayfaya (Daha) toplanır.
  const sekmeler: Sekme[] = yonetici
    ? [...yonetimSekmeleri, ...siparisSekmeleri] // görevlide iş önce gelir
    : siparisSekmeleri;
  const altGorunen = sekmeler.length > 5 ? sekmeler.slice(0, 4) : sekmeler;
  const altKalan = sekmeler.slice(altGorunen.length);
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
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          {/* min-w-0 + flex-1: kantin seçici DARALABİLSİN. Seçim öğelerinin
              doğal bir en-az genişliği var; daralamayınca telefonda kişinin
              adının üstüne biniyordu (iki yazı iç içe geçiyordu). */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
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
                className="input-base !py-1 !px-2 text-xs min-w-0 flex-1 max-w-[11rem]"
              >
                {kantinler.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.ad}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Ad geniş ekranda; telefonda yerine ROL rozeti kalır — "neden bu
                sekmeleri görüyorum" sorusunun cevabı, addan daha çok işe yarıyor
                ve ad zaten Kişiler ekranında yazıyor. (Rozet eskiden `xs:`
                kırılımıyla yazılmıştı; Tailwind'de öyle bir kırılım yok, yani
                rozet hiçbir ekranda görünmüyordu.) */}
            <span className="text-muted text-xs truncate max-w-[9rem] hidden sm:inline">
              {kisi?.ad ?? user.email}
            </span>
            <span className="chip !py-0.5 !px-2 text-[11px] text-muted shrink-0">{ROL_ETIKET[rol]}</span>
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

      {/* Üst sekmeler: tablet/masaüstü (sm ve üstü) — telefonda alt çubuk var */}
      {sekmeler.length > 0 && (
        <nav className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 hidden sm:flex items-center gap-3 flex-wrap">
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

      {/* Alt çubuğun payı saf CSS: telefonda ayrılır, sm'de sıfırlanır. */}
      <div className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-0">{children}</div>

      {/* Alt çubuk: TELEFON (sm altı) — rolden bağımsız. Başparmak oraya yetişir. */}
      {sekmeler.length > 0 && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur border-t border-line sm:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className={`mx-auto flex ${altGorunen.length + (altKalan.length ? 1 : 0) <= 2 ? "max-w-xs" : "max-w-md"}`}>
            {altGorunen.map((s) => (
              <AltSekme
                key={s.href}
                sekme={s}
                aktif={path === s.href}
                rozet={s.href === "/kantin/siparisim" && acikSiparisler.length > 0}
                rozetHazir={hazirVar}
              />
            ))}
            {altKalan.length > 0 && (
              <button
                onClick={() => setDahaAcik(true)}
                aria-expanded={dahaAcik}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 min-h-[56px] justify-center ${
                  altKalan.some((s) => s.href === path) ? "text-accent" : "text-muted"
                }`}
              >
                <Icon name="dots" size={20} />
                <span className="text-[11px] font-semibold">Daha</span>
              </button>
            )}
          </div>
        </nav>
      )}

      {/* "Daha" sayfası — telefonda beşten fazla sekme alt çubuğa sığmıyor.
          Yatay kaydırılan bir şerit yerine tam boy hedefler: yönetici telefondan
          bakarken altı sekmeyi parmakla süpürmek zorunda kalmasın. */}
      {dahaAcik && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:hidden" onClick={() => setDahaAcik(false)}>
          <div
            className="bg-white w-full rounded-t-3xl p-3 animate-pop"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            {altKalan.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                onClick={() => setDahaAcik(false)}
                className={`flex items-center gap-3 px-3 min-h-[52px] rounded-2xl ${
                  path === s.href ? "bg-wash text-accent font-semibold" : "text-ink"
                }`}
              >
                <Icon name={s.ikon} size={19} />
                <span className="text-sm font-semibold">{s.label}</span>
              </Link>
            ))}
            {yonetici && (
              <a
                href={panoHref}
                target={panoHedef}
                rel={panoHedef ? "noopener" : undefined}
                onClick={() => setDahaAcik(false)}
                className="flex items-center gap-3 px-3 min-h-[52px] rounded-2xl text-ink border-t border-line mt-1 pt-1"
              >
                <Icon name="monitor" size={19} />
                <span className="text-sm font-semibold">Panoyu aç</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Alt çubuğun tek sekmesi (telefon). */
function AltSekme({
  sekme,
  aktif,
  rozet,
  rozetHazir,
}: {
  sekme: Sekme;
  aktif: boolean;
  rozet?: boolean;
  rozetHazir?: boolean;
}) {
  return (
    <Link
      href={sekme.href}
      aria-current={aktif ? "page" : undefined}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 min-h-[56px] justify-center relative ${
        aktif ? "text-accent" : "text-muted"
      }`}
    >
      <Icon name={sekme.ikon} size={20} />
      <span className="text-[11px] font-semibold">{sekme.label}</span>
      {rozet && (
        <>
          <span
            className={`absolute top-1.5 right-[calc(50%-1.35rem)] w-2.5 h-2.5 rounded-full ${
              rozetHazir ? "bg-[#1baf7a]" : "bg-accent"
            }`}
            aria-hidden
          />
          <span className="sr-only">açık siparişin var</span>
        </>
      )}
    </Link>
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
