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
import { Icon, IconName } from "@/components/Icon";
import ProfilTamamla from "./ProfilTamamla";

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

  const yonetici = rol === "admin" || rol === "kantinci";
  const sekmeler: Sekme[] = [
    { href: "/kantin/menu", label: "Menü", ikon: "list" },
    { href: "/kantin/siparisim", label: "Siparişim", ikon: "receipt" },
    ...(yonetici
      ? ([
          { href: "/kantin/tezgah", label: "Tezgâh", ikon: "grid" },
          { href: "/kantin/pano", label: "Pano", ikon: "monitor" },
          { href: "/kantin/rapor", label: "Rapor", ikon: "chart" },
          { href: "/kantin/ayarlar", label: "Ayarlar", ikon: "settings" },
        ] as Sekme[])
      : []),
    ...(rol === "admin" ? ([{ href: "/kantin/kisiler", label: "Kişiler", ikon: "users" }] as Sekme[]) : []),
  ];

  if (!user) return <>{children}</>;
  // Hesabı var ama kişi kaydı yok → önce ad/sicil (bkz. ProfilTamamla).
  if (kisiYok) return <ProfilTamamla />;
  // Pano TAM EKRAN bir yüzey (kantindeki TV): başlık/sekme çerçevesi olmaz.
  if (path === "/kantin/pano") return <>{children}</>;

  const hazirVar = acikSiparisler.some((s) => s.durum === "hazir");
  const altCubuk = !yonetici; // personel telefonda: başparmak alt çubuğa yetişir

  return (
    <div className="min-h-screen bg-wash">
      {!cevrimici && (
        <p className="bg-[#8a6100] text-white text-xs text-center py-1.5 px-4">
          Bağlantı yok — durum güncellenmiyor olabilir.
        </p>
      )}

      <header className="bg-white/85 backdrop-blur border-b border-line px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
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
            <span className="text-muted text-xs truncate hidden sm:inline">{kisi?.ad ?? user.email}</span>
            <button
              onClick={() => void cikisYap().then(() => router.replace("/kantin/giris"))}
              className="btn-ghost !py-1.5 !px-3 text-xs shrink-0"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      {/* Siparişin hazır — her sayfada, tek dokunuşla siparişe götürür */}
      {hazirVar && path !== "/kantin/siparisim" && (
        <Link
          href="/kantin/siparisim"
          className="block bg-[#1baf7a] text-white px-4 py-2.5 text-sm font-semibold text-center animate-pop"
        >
          Siparişin hazır — tezgâhtan alabilirsin →
        </Link>
      )}

      {/* Üst sekmeler: görevli/yönetici (tablet) */}
      {!altCubuk && (
        <nav className="max-w-5xl mx-auto px-4 sm:px-6 pt-4">
          <div className="flex gap-1.5 overflow-x-auto">
            {sekmeler.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className={`chip !py-1.5 shrink-0 whitespace-nowrap ${
                  path === s.href ? "!bg-ink !text-white !border-ink" : "text-muted hover:border-muted"
                }`}
              >
                {s.label}
                {s.href === "/kantin/siparisim" && acikSiparisler.length > 0 && (
                  <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-accent align-middle" />
                )}
              </Link>
            ))}
          </div>
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
          <div className="max-w-md mx-auto flex">
            {sekmeler.map((s) => {
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
