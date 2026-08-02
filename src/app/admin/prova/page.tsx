"use client";

/**
 * Yönetici → "Prova & sağlık".
 *
 * Sağlık: canlı ortamın AYARLARINI tek tek dener (bkz. lib/health.ts). Bu
 * ürünün en pahalı arızaları koddan değil ayardan çıktı ve hepsi sessizdi;
 * burası onları saniyede görünür kılar.
 *
 * Prova: simülatör buraya taşındı. Eskiden /dev/sim gizli linkti ve anahtarı
 * istemci paketinin içindeydi — yani kapı değildi. Artık gerçek kapı: sayfa
 * yönetici kontrolünden geçiyor, rules aynı kuralı sunucuda uyguluyor.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AdminTabs from "@/components/AdminTabs";
import Logo from "@/components/Logo";
import FlowSpinner from "@/components/FlowSpinner";
import { Icon } from "@/components/Icon";
import { useAuthUser } from "@/lib/hooks";
import { ADMIN_EMAIL, getUserRecord, isAdminUser } from "@/lib/users";
import { Kontrol, saglikTara } from "@/lib/health";
import { listPulses } from "@/lib/pulses";
import { Pulse } from "@/lib/types";
import { usePlayTarget } from "@/lib/usePlayTarget";

const RENK: Record<Kontrol["durum"], string> = {
  ok: "bg-[#1baf7a]/12 border-[#1baf7a]/35 text-[#0f7a55]",
  uyari: "bg-[#eda100]/12 border-[#eda100]/40 text-[#8a6100]",
  hata: "bg-brand-soft border-brand/30 text-brand",
  bilinmiyor: "bg-paper border-line text-muted",
};
const IKON: Record<Kontrol["durum"], "check" | "warning" | "close" | "help"> = {
  ok: "check",
  uyari: "warning",
  hata: "close",
  bilinmiyor: "help",
};

export default function ProvaPage() {
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [kontroller, setKontroller] = useState<Kontrol[] | null>(null);
  const [tarali, setTarali] = useState(false);
  const [kod, setKod] = useState("");
  const [noktalar, setNoktalar] = useState<Pulse[] | null>(null);
  const [nokta, setNokta] = useState("");
  const hedef = usePlayTarget();

  // Nabız noktaları: kod yok, kimlikle açılır → kendi noktalarını listele.
  useEffect(() => {
    if (!allowed || !user) return;
    listPulses(user.uid)
      .then((p) => {
        setNoktalar(p);
        setNokta((s) => s || p[0]?.id || "");
      })
      .catch(() => setNoktalar([]));
  }, [allowed, user]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    if (user.email === ADMIN_EMAIL) {
      setAllowed(true);
      return;
    }
    getUserRecord(user.uid)
      .then((r) => setAllowed(isAdminUser(user, r)))
      .catch(() => setAllowed(false));
  }, [user]);

  const tara = useCallback(async () => {
    if (!user) return;
    setTarali(true);
    setKontroller(null);
    try {
      setKontroller(await saglikTara(user.uid));
    } finally {
      setTarali(false);
    }
  }, [user]);

  // Sayfa açılır açılmaz tara — yönetici buraya "bir sorun mu var?" diye gelir.
  useEffect(() => {
    if (allowed && user && kontroller === null && !tarali) void tara();
  }, [allowed, user, kontroller, tarali, tara]);

  if (loading || allowed === null) {
    return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;
  }
  if (!allowed) {
    return (
      <main className="min-h-screen grid place-items-center bg-wash text-center px-6">
        <div>
          <p className="text-xl font-bold mb-1">Yetki yok</p>
          <p className="text-muted">Bu sayfa sadece yöneticilere açık.</p>
        </div>
      </main>
    );
  }

  const sorunlu = (kontroller ?? []).filter((k) => k.durum === "hata" || k.durum === "uyari").length;

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/dashboard" className="text-muted hover:text-ink shrink-0 text-lg" aria-label="Panele dön">←</Link>
          <Logo size="sm" />
          <span className="eyebrow hidden sm:inline">Yönetici paneli</span>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-8">
        <AdminTabs />
        <h1 className="font-display text-3xl font-semibold tracking-tight">Prova &amp; sağlık</h1>
        <p className="text-muted text-sm mb-6">Canlı ortamın ayarlarını dener; sorun varsa nerede düzeltileceğini yazar.</p>

        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <p className="eyebrow">Sağlık</p>
            <button onClick={() => void tara()} disabled={tarali} className="btn-ghost !py-1.5 !px-3 text-xs">
              <Icon name="refresh" size={13} /> {tarali ? "Deneniyor…" : "Yeniden dene"}
            </button>
          </div>

          {tarali && !kontroller && (
            <div className="flex items-center gap-3 py-4">
              <FlowSpinner size={28} />
              <p className="text-muted text-sm">Ayarlar deneniyor…</p>
            </div>
          )}

          {kontroller && (
            <>
              <p className={`text-sm font-semibold mb-3 ${sorunlu ? "text-brand" : "text-[#0f7a55]"}`}>
                {sorunlu ? `${sorunlu} başlıkta dikkat gerekiyor` : "Her şey yolunda"}
              </p>
              <div className="flex flex-col gap-2">
                {kontroller.map((k) => (
                  <div key={k.id} className={`rounded-2xl border px-4 py-3 ${RENK[k.durum]}`}>
                    <p className="font-semibold text-sm flex items-center gap-2">
                      <Icon name={IKON[k.durum]} size={14} /> {k.baslik}
                    </p>
                    <p className="text-xs mt-0.5 opacity-90 break-words">{k.detay}</p>
                    {k.ipucu && <p className="text-xs mt-1.5 opacity-80 break-words">→ {k.ipucu}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <p className="text-muted text-xs mt-4">
          Kontroller oturumunu bozmaz: anonim giriş denemesi ayrı bir bağlantıda yapılır ve açılan hesap hemen silinir.
        </p>

        {/* PROVA — simülatör buraya taşındı. Eskiden /dev/sim gizli linkti ve
            anahtarı istemci paketinin içindeydi (yani kapı değildi).
            Dört ürünün de provası burada: her biri ürünün GERÇEK yazma yolunu
            kullanır, kurallar hiç gevşetilmez. */}
        <div className="card p-5 mt-6">
          <p className="eyebrow mb-1">Prova</p>
          <p className="text-muted text-xs mb-4">
            Botlar gerçek izleyici gibi <b>anonim</b> yazar — kurallar değişmez, yani gerçek yol denenir.
            Kendi içeriğinde dene; canlı etkinlikte kullanma.
          </p>

          <label className="text-xs font-semibold text-muted">Sunum / duvar · katılım kodu ya da kimlik</label>
          <input
            value={kod}
            onChange={(e) => setKod(e.target.value.trim())}
            placeholder="6 haneli kod"
            className="input-base !py-2 mt-1 text-sm"
          />
          <div className="flex gap-2 mt-3 flex-wrap">
            {kod ? (
              <>
                <Link href={`/admin/prova/${kod}`} target={hedef} className="btn-primary !py-2 !px-4 text-sm">
                  Sunum provası
                </Link>
                <Link href={`/admin/prova/duvar/${kod}`} target={hedef} className="btn-ghost !py-2 !px-4 text-sm">
                  Duvara örnek medya
                </Link>
              </>
            ) : (
              <>
                <span className="btn-primary !py-2 !px-4 text-sm opacity-40 pointer-events-none">Sunum provası</span>
                <span className="btn-ghost !py-2 !px-4 text-sm opacity-40 pointer-events-none">Duvara örnek medya</span>
              </>
            )}
          </div>

          {/* Nabız noktalarının katılım kodu yoktur — kendi noktalarından seçilir. */}
          <div className="border-t border-line mt-5 pt-5">
            <label className="text-xs font-semibold text-muted">Nabız · nokta seç</label>
            {noktalar === null ? (
              <p className="text-muted text-sm mt-1">Yükleniyor…</p>
            ) : noktalar.length === 0 ? (
              <p className="text-muted text-sm mt-1">Henüz nabız noktan yok.</p>
            ) : (
              <div className="flex gap-2 mt-1 flex-wrap items-center">
                <select
                  value={nokta}
                  onChange={(e) => setNokta(e.target.value)}
                  className="input-base !py-2 text-sm !w-auto min-w-[12rem] max-w-full"
                >
                  {noktalar.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <Link href={`/admin/prova/nabiz/${nokta}`} target={hedef} className="btn-ghost !py-2 !px-4 text-sm">
                  Nabız provası
                </Link>
              </div>
            )}
          </div>

          {/* Sign'da izleyici yazımı yok: prova kendi ekranını açar, var olan
              tabelalara dokunmaz (sahadaki 7/24 ekranı bozmamak için). */}
          <div className="border-t border-line mt-5 pt-5">
            <label className="text-xs font-semibold text-muted">Tabela</label>
            <p className="text-muted text-xs mt-0.5 mb-2">
              Kendi prova ekranını açar (2×2 yerleşim, dört öğe türü); var olan ekranlara dokunmaz.
            </p>
            <Link href="/admin/prova/tabela" className="btn-ghost !py-2 !px-4 text-sm inline-block">
              Tabela provası
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
