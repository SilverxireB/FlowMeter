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
import { KONTROLLER, Kontrol } from "@/lib/health";
import { listPulses } from "@/lib/pulses";
import { listPresentations } from "@/lib/presentations";
import { listWalls } from "@/lib/walls";
import { Presentation, Pulse, Wall } from "@/lib/types";
import { usePlayTarget } from "@/lib/usePlayTarget";
import { loginYolu } from "@/lib/girisYolu";

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
  // Kontroller AÇILIR KAPANIR: bir kutuyu açmak yalnız o kontrolü tetikler.
  // Panel açılır açılmaz hepsini koşturmak her ziyarette anonim giriş denemesi +
  // Cloudinary isteği + Firestore yazımı demekti; oysa çoğu zaman merak edilen
  // tek bir başlık oluyor.
  const [acik, setAcik] = useState<string | null>(null);
  const [sonuclar, setSonuclar] = useState<Record<string, Kontrol[] | "calisiyor">>({});
  const [kod, setKod] = useState("");
  const [sunumlar, setSunumlar] = useState<Presentation[] | null>(null);
  const [sunum, setSunum] = useState("");
  const [duvarlar, setDuvarlar] = useState<Wall[] | null>(null);
  const [duvar, setDuvar] = useState("");
  const [noktalar, setNoktalar] = useState<Pulse[] | null>(null);
  const [nokta, setNokta] = useState("");
  const hedef = usePlayTarget();

  // Her ürün için KENDİ içeriğini listele: kod ezberlemek yerine seçmek.
  // (Nabız noktalarının zaten katılım kodu yok.)
  useEffect(() => {
    if (!allowed || !user) return;
    listPresentations(user.uid)
      .then((p) => {
        setSunumlar(p);
        setSunum((s) => s || p[0]?.id || "");
      })
      .catch(() => setSunumlar([]));
    listWalls(user.uid)
      .then((w) => {
        setDuvarlar(w);
        setDuvar((s) => s || w[0]?.id || "");
      })
      .catch(() => setDuvarlar([]));
    listPulses(user.uid)
      .then((p) => {
        setNoktalar(p);
        setNokta((s) => s || p[0]?.id || "");
      })
      .catch(() => setNoktalar([]));
  }, [allowed, user]);

  useEffect(() => {
    if (!loading && !user) router.replace(loginYolu());
  }, [loading, user, router]);

  useEffect(() => {
    // Oturum DÜŞERSE yetki kapısı da kapanmalı. Eskiden `if (!user) return`
    // deyip çıkılıyordu: `allowed` bir önceki oturumdan TRUE kalıyor, sayfa
    // çizilmeye ve sorgulamaya devam ediyordu. Oturum sessizce anonime dönerse
    // (FlowWall misafir sayfası varsayılan uygulamada anonim giriş açıyor ve
    // Auth oturumu tüm sekmelerde paylaşılıyor) ekran giriş istemek yerine
    // arka arkaya "yetkiniz yok" veriyordu — kullanıcının gördüğü "her şey
    // gitti" tablosu buydu.
    if (!user) {
      setAllowed(false);
      return;
    }
    if (user.email === ADMIN_EMAIL) {
      setAllowed(true);
      return;
    }
    getUserRecord(user.uid)
      .then((r) => setAllowed(isAdminUser(user, r)))
      .catch(() => setAllowed(false));
  }, [user]);

  const calistir = useCallback(
    async (id: string, zorla = false) => {
      const t = KONTROLLER.find((k) => k.id === id);
      if (!t) return;
      if (!zorla && sonuclar[id] && sonuclar[id] !== "calisiyor") return;
      setSonuclar((s) => ({ ...s, [id]: "calisiyor" }));
      try {
        const cikti = await t.calistir(user?.uid);
        setSonuclar((s) => ({ ...s, [id]: cikti }));
      } catch (e) {
        setSonuclar((s) => ({
          ...s,
          [id]: [
            {
              id: t.id,
              baslik: t.baslik,
              durum: "bilinmiyor",
              detay: e instanceof Error ? e.message : "Kontrol çalıştırılamadı.",
            },
          ],
        }));
      }
    },
    [sonuclar, user]
  );

  const ac = useCallback(
    (id: string) => {
      setAcik((a) => (a === id ? null : id));
      if (acik !== id) void calistir(id);
    },
    [acik, calistir]
  );

  const hepsi = useCallback(async () => {
    for (const t of KONTROLLER) await calistir(t.id, true);
  }, [calistir]);

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

  const calisan = Object.values(sonuclar).some((v) => v === "calisiyor");

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/dashboard" className="text-muted hover:text-ink shrink-0 text-lg" aria-label="Panele dön">←</Link>
          <Logo size="sm" variant="studio" />
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
            <button onClick={() => void hepsi()} disabled={calisan} className="btn-ghost !py-1.5 !px-3 text-xs">
              <Icon name="refresh" size={13} /> {calisan ? "Deneniyor…" : "Hepsini dene"}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {KONTROLLER.map((t) => {
              const sonuc = sonuclar[t.id];
              const calisiyor = sonuc === "calisiyor";
              const liste = calisiyor ? [] : (sonuc as Kontrol[] | undefined);
              const durum: Kontrol["durum"] | null = liste?.length
                ? (liste.find((k) => k.durum === "hata")?.durum ??
                   liste.find((k) => k.durum === "uyari")?.durum ??
                   liste.find((k) => k.durum === "bilinmiyor")?.durum ??
                   "ok")
                : null;
              const kutuAcik = acik === t.id;
              return (
                <div key={t.id} className={`rounded-2xl border ${durum ? RENK[durum] : "bg-paper border-line"}`}>
                  <button
                    onClick={() => ac(t.id)}
                    aria-expanded={kutuAcik}
                    className="w-full text-left px-4 py-3 flex items-center gap-2.5 min-h-[44px]"
                  >
                    <span className="shrink-0">
                      {calisiyor ? (
                        <FlowSpinner size={16} />
                      ) : durum ? (
                        <Icon name={IKON[durum]} size={14} />
                      ) : (
                        <span className="block w-2.5 h-2.5 rounded-full bg-muted/35" />
                      )}
                    </span>
                    <span className="font-semibold text-sm min-w-0 flex-1">{t.baslik}</span>
                    <span className={`text-muted text-xs shrink-0 transition-transform ${kutuAcik ? "rotate-180" : ""}`}>
                      <Icon name="down" size={14} />
                    </span>
                  </button>
                  {kutuAcik && (
                    <div className="px-4 pb-3 -mt-0.5">
                      <p className="text-xs opacity-80 break-words">{t.ozet}</p>
                      {calisiyor && <p className="text-xs mt-2 opacity-70">Deneniyor…</p>}
                      {liste?.map((k) => (
                        <div key={k.id} className="mt-2.5">
                          {liste.length > 1 && <p className="text-xs font-semibold">{k.baslik}</p>}
                          <p className="text-xs mt-0.5 break-words">{k.detay}</p>
                          {k.ipucu && <p className="text-xs mt-1 opacity-80 break-words">→ {k.ipucu}</p>}
                        </div>
                      ))}
                      {!calisiyor && (
                        <button onClick={() => void calistir(t.id, true)} className="btn-ghost !py-1 !px-2.5 text-[11px] mt-3">
                          <Icon name="refresh" size={11} /> Yeniden dene
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

          <Secim
            baslik="Sunum"
            aciklama="İzleyici botları katılır, oy verir, soru sorar, sohbet eder."
            liste={sunumlar?.map((p) => ({ id: p.id, ad: p.title })) ?? null}
            bos="Henüz sunumun yok."
            secili={sunum}
            setSecili={setSunum}
            href={`/admin/prova/${sunum}`}
            etiket="Sunum provası"
            hedef={hedef}
            birincil
          />

          <div className="border-t border-line mt-5 pt-5">
            <Secim
              baslik="Duvar"
              aciklama="Misafirler medya gönderir, tepki yağdırır, beğenir, dilek bırakır; çekiliş/yarışma açıkken kaydolur ve oy verir."
              liste={duvarlar?.map((w) => ({ id: w.id, ad: w.title })) ?? null}
              bos="Henüz duvarın yok."
              secili={duvar}
              setSecili={setDuvar}
              href={`/admin/prova/duvar/${duvar}`}
              etiket="Duvar provası"
              hedef={hedef}
            />
          </div>

          <div className="border-t border-line mt-5 pt-5">
            <Secim
              baslik="Nabız"
              aciklama="Anonim oy + yorum akar; geçmiş gün üretip trendi de doldurabilirsin."
              liste={noktalar?.map((p) => ({ id: p.id, ad: p.title })) ?? null}
              bos="Henüz nabız noktan yok."
              secili={nokta}
              setSecili={setNokta}
              href={`/admin/prova/nabiz/${nokta}`}
              etiket="Nabız provası"
              hedef={hedef}
            />
          </div>

          {/* Sign'da izleyici yazımı yok: prova kendi ekranını açar, var olan
              tabelalara dokunmaz (sahadaki 7/24 ekranı bozmamak için). */}
          <div className="border-t border-line mt-5 pt-5">
            <label className="text-xs font-semibold text-muted">Videowall</label>
            <p className="text-muted text-xs mt-0.5 mb-2">
              Kendi prova ekranını açar (2×2 yerleşim, dört öğe türü); var olan ekranlara dokunmaz.
            </p>
            <Link href="/admin/prova/tabela" className="btn-ghost !py-2 !px-4 text-sm inline-block">
              Videowall provası
            </Link>
          </div>

          {/* Başkasının içeriği: canlı bir etkinlikte sorun ararken kod elde olur,
              kimlik olmaz — bu yüzden kod kapısı duruyor. */}
          <div className="border-t border-line mt-5 pt-5">
            <label className="text-xs font-semibold text-muted">Başkasının sunumu/duvarı · katılım kodu</label>
            <div className="flex gap-2 mt-1 flex-wrap items-center">
              <input
                value={kod}
                onChange={(e) => setKod(e.target.value.trim())}
                placeholder="6 haneli kod"
                className="input-base !py-2 text-sm !w-auto min-w-[10rem]"
              />
              {kod ? (
                <>
                  <Link href={`/admin/prova/${kod}`} target={hedef} className="btn-ghost !py-2 !px-4 text-sm">
                    Sunum
                  </Link>
                  <Link href={`/admin/prova/duvar/${kod}`} target={hedef} className="btn-ghost !py-2 !px-4 text-sm">
                    Duvar
                  </Link>
                </>
              ) : (
                <>
                  <span className="btn-ghost !py-2 !px-4 text-sm opacity-40 pointer-events-none">Sunum</span>
                  <span className="btn-ghost !py-2 !px-4 text-sm opacity-40 pointer-events-none">Duvar</span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/** Ürün başına "kendi içeriğinden seç + provayı aç" satırı. */
function Secim({
  baslik,
  aciklama,
  liste,
  bos,
  secili,
  setSecili,
  href,
  etiket,
  hedef,
  birincil,
}: {
  baslik: string;
  aciklama: string;
  liste: { id: string; ad: string }[] | null;
  bos: string;
  secili: string;
  setSecili: (v: string) => void;
  href: string;
  etiket: string;
  hedef: "_blank" | undefined;
  birincil?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{baslik}</p>
      <p className="text-muted text-xs mt-0.5 mb-2">{aciklama}</p>
      {liste === null ? (
        <p className="text-muted text-sm">Yükleniyor…</p>
      ) : liste.length === 0 ? (
        <p className="text-muted text-sm">{bos}</p>
      ) : (
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={secili}
            onChange={(e) => setSecili(e.target.value)}
            className="input-base !py-2 text-sm !w-auto min-w-[11rem] max-w-full"
          >
            {liste.map((o) => (
              <option key={o.id} value={o.id}>
                {o.ad}
              </option>
            ))}
          </select>
          <Link href={href} target={hedef} className={`${birincil ? "btn-primary" : "btn-ghost"} !py-2 !px-4 text-sm`}>
            {etiket}
          </Link>
        </div>
      )}
    </div>
  );
}
