"use client";

/**
 * KANTİN kabuğu — Flow Studio'dan TAMAMEN ayrı bir uygulama yüzeyi.
 * Studio'nun başlığı, logosu, sekmeleri burada YOK; ortak olan yalnız çekirdek
 * (Firebase, tasarım sistemi sınıfları). Kaldırmak = `src/app/kantin` +
 * `src/lib/kantin` klasörlerini silmek.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cikisYap } from "@/lib/kantin/api";
import { KantinOturum, useKantin } from "@/lib/kantin/oturum";
import ProfilTamamla from "./ProfilTamamla";

export default function KantinLayout({ children }: { children: React.ReactNode }) {
  return (
    <KantinOturum>
      <Kabuk>{children}</Kabuk>
    </KantinOturum>
  );
}

function Kabuk({ children }: { children: React.ReactNode }) {
  const { user, kisi, kisiYok, rol, kantinler, seciliId, secKantin } = useKantin();
  const path = usePathname();
  const router = useRouter();

  const yonetici = rol === "admin" || rol === "kantinci";
  // Sekmeler ROLE göre: personel yalnız menü + kendi siparişini görür.
  const sekmeler = [
    { href: "/kantin/menu", label: "Menü" },
    { href: "/kantin/siparisim", label: "Siparişim" },
    ...(yonetici
      ? [
          { href: "/kantin/tezgah", label: "Tezgâh" },
          { href: "/kantin/pano", label: "Pano" },
          { href: "/kantin/rapor", label: "Rapor" },
          { href: "/kantin/ayarlar", label: "Ayarlar" },
        ]
      : []),
    ...(rol === "admin" ? [{ href: "/kantin/kisiler", label: "Kişiler" }] : []),
  ];

  if (!user) return <>{children}</>;
  // Hesabı var ama kişi kaydı yok → önce ad/sicil (bkz. ProfilTamamla).
  if (kisiYok) return <ProfilTamamla />;
  // Pano TAM EKRAN bir yüzey (kantindeki TV): başlık/sekme çerçevesi olmaz.
  if (path === "/kantin/pano") return <>{children}</>;

  return (
    <div className="min-h-screen bg-wash">
      <header className="bg-white/85 backdrop-blur border-b border-line px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-display text-lg font-semibold tracking-tight shrink-0">Kantin</span>
            {/* Kantinci kendi kantinine bağlıdır — seçim yalnız diğerlerinde. */}
            {kantinler.length > 1 && rol !== "kantinci" && (
              <select
                value={seciliId}
                onChange={(e) => secKantin(e.target.value)}
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

      <nav className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
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
            </Link>
          ))}
        </div>
      </nav>

      {children}
    </div>
  );
}
