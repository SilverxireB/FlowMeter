"use client";

/**
 * UYGULAMA AYARLARI — kurulumun panelden görünen yüzü.
 *
 * Neden ayrı sayfa: kurum adı, kök adresin gideceği ekran, yükleme sınırı
 * bugüne dek KODA gömülüydü; değiştirmek için yazılımcı gerekiyordu.
 *
 * İki tür satır var ve ayrımı görünür tutmak ÖNEMLİ:
 *  - düzenlenebilir  → BT ayarlar,
 *  - düzenlenemez    → kurulumun gerçeği (veri klasörü, sürüm, nabız). Dolgu
 *    değil: veri klasörünü bilmeyen sistem yöneticisi yedek alamaz. Görünür
 *    ama değiştirilemez; "neden değiştiremiyorum" sorusuna satırın kendisi
 *    cevap verir (açıklamada nerede değiştirileceği yazar).
 *
 * Her satır KİMİN NE ZAMAN değiştirdiğini taşır — fabrikada personel değişiyor
 * ve sorulan soru hep aynı.
 */
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { PublicUser } from "@/lib/types";

interface AyarSatiri {
  anahtar: string;
  ad: string;
  aciklama: string;
  duzenlenebilir: boolean;
  tur: "metin" | "sayi";
  deger: string;
  enAz?: number;
  enCok?: number;
  degistiren?: string;
  degistirilme?: number;
}

const tarih = (ms?: number) =>
  ms
    ? new Date(ms).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<PublicUser | null>(null);
  const [satirlar, setSatirlar] = useState<AyarSatiri[] | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [taslak, setTaslak] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const yukle = useCallback(async () => {
    const [a, u] = await Promise.all([fetch("/api/settings"), fetch("/api/users")]);
    if (a.status === 401) {
      router.replace("/login?next=/settings");
      return;
    }
    setSatirlar((await a.json()).ayarlar ?? []);
    if (u.ok) setMe((await u.json()).me ?? null);
  }, [router]);

  useEffect(() => {
    yukle().catch(() => setErr("Ayarlar okunamadı."));
  }, [yukle]);

  const admin = me?.role === "admin";

  async function kaydet(s: AyarSatiri) {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anahtar: s.anahtar, deger: taslak }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Kaydedilemedi");
      setSatirlar(j.ayarlar);
      setDuzenlenen(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  if (!satirlar)
    return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/screens" className="text-muted hover:text-ink shrink-0 text-lg" aria-label="Ekranlara dön">←</Link>
          <span className="inline-flex items-center gap-1.5 shrink-0" role="img" aria-label="FlowSign">
            <Image src="/logo.png" alt="" width={140} height={40} className="h-7 w-auto" priority />
            <span aria-hidden className="font-display font-semibold text-[26px] leading-none tracking-[0.03em] text-[#001e64]">SIGN</span>
          </span>
        </div>
        <span className="chip text-muted text-xs min-w-0 max-w-[45vw]">
          <span className="truncate min-w-0">{me?.label || me?.name}</span>
        </span>
      </header>

      <section className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-1">Uygulama ayarları</h1>
        <p className="text-muted text-sm mb-6">
          {admin
            ? "Kurulumun panelden değiştirilebilen kısmı. Gri satırlar bilgi içindir."
            : "Kurulumun geçerli ayarları. Değiştirmek yöneticiye özeldir."}
        </p>

        {err && <div className="mb-5 rounded-2xl bg-brand-soft text-brand px-4 py-3 text-sm font-semibold">{err}</div>}

        <ul className="flex flex-col gap-2.5">
          {satirlar.map((s) => {
            const acik = duzenlenen === s.anahtar;
            return (
              <li
                key={s.anahtar}
                className={`card p-4 ${s.duzenlenebilir ? "" : "bg-paper/60"}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                      {s.ad}
                      {!s.duzenlenebilir && (
                        <span className="chip !py-0.5 !px-2 text-[10px] text-muted">değiştirilemez</span>
                      )}
                    </p>
                    <p className="text-muted text-xs mt-0.5 leading-relaxed">{s.aciklama}</p>
                  </div>
                  {/* Düzenle düğmesi yalnız yöneticide ve yalnız düzenlenebilir
                      satırda: yetkisi olmayana tıklanıp reddedilen düğme gösterme. */}
                  {admin && s.duzenlenebilir && !acik && (
                    <button
                      onClick={() => {
                        setDuzenlenen(s.anahtar);
                        setTaslak(s.deger);
                      }}
                      className="btn-ghost shrink-0 !px-3 !py-1.5 text-xs inline-flex items-center gap-1.5"
                    >
                      <Icon name="settings" size={13} /> Düzenle
                    </button>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {acik ? (
                    <>
                      <input
                        autoFocus
                        type={s.tur === "sayi" ? "number" : "text"}
                        min={s.enAz}
                        max={s.enCok}
                        value={taslak}
                        onChange={(e) => setTaslak(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void kaydet(s);
                          if (e.key === "Escape") setDuzenlenen(null);
                        }}
                        className="input-base !rounded-lg px-3 py-1.5 text-sm flex-1 min-w-0 basis-full sm:basis-auto"
                      />
                      <button onClick={() => void kaydet(s)} disabled={busy} className="btn-primary !px-4 !py-1.5 text-xs">
                        Kaydet
                      </button>
                      <button onClick={() => setDuzenlenen(null)} className="btn-ghost !px-3 !py-1.5 text-xs">
                        Vazgeç
                      </button>
                    </>
                  ) : (
                    <code className="text-sm font-mono bg-wash border border-line rounded-lg px-2.5 py-1 break-all">
                      {s.deger || <span className="text-muted font-sans not-italic">— boş —</span>}
                    </code>
                  )}
                </div>

                {/* DENETİM İZİ: "bunu kim değiştirdi" sorusunun cevabı. Hiç
                    değiştirilmemiş satırda satır hiç yazılmaz — boş "—" gürültü. */}
                {s.degistiren && (
                  <p className="text-muted text-[11px] mt-2.5">
                    Son değiştiren: <span className="font-semibold">{s.degistiren}</span> · {tarih(s.degistirilme)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
