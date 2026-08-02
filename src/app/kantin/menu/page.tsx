"use client";

/**
 * MENÜ + SİPARİŞ — personelin ana ekranı.
 *
 * Mola 10 dakika. Ekran "katalog" değil, iki dokunuşluk bir sipariş:
 *  - YİNE AYNISI: fabrika kantininde sipariş neredeyse her gün aynıdır. Son
 *    siparişi tek dokunuşla tekrarlamak, bu üründe kazanılacak en büyük zaman.
 *  - FOTOĞRAF: molada kimse okumaz, bakar.
 *  - KATEGORİ/ARAMA yalnız gerektiğinde görünür; küçük menüde boş bir filtre
 *    satırı gürültüden başka bir şey değil.
 *  - SEPET altta sabit; "Gönder" ayrı düğme — sepeti açmadan da gönderilir.
 *  - Verilen süre İYİMSER DEĞİL (bkz. beklemeDk) — tutmayan söz ürünü bitirir.
 *
 * KUYRUK BİLGİSİ TEK BELGEDEN gelir (`gunler/{gun}`): eskiden günün TÜM
 * siparişleri dinleniyordu; hem herkes herkesin ne yediğini görüyordu hem de
 * her yeni siparişte her telefona okuma faturalanıyordu.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  beklemeDk,
  bugunTukendi,
  gunKey,
  izleBugunOzet,
  izleMenu,
  kantinHata,
  siparisAcikMi,
  siparisVer,
  sonrakiAcilis,
  yasakli,
} from "@/lib/kantin/api";
import { useKantin } from "@/lib/kantin/oturum";
import { GunOzet, MenuUrun, Siparis, SiparisSatir } from "@/lib/kantin/types";
import { cldThumb } from "@/lib/cloudinary";
import { Icon } from "@/components/Icon";
import { SkelBox } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import BosDurum from "@/components/kantin/BosDurum";

export default function KantinMenuPage() {
  const { user, kisi, hazir, seciliKantin, seciliId, kantinler, acikSiparisler, siparislerim } = useKantin();
  const router = useRouter();
  const { show, toast } = useToast();
  const [menu, setMenu] = useState<MenuUrun[] | null>(null);
  const [ozet, setOzet] = useState<GunOzet | null>(null);
  const [sepet, setSepet] = useState<Record<string, number>>({});
  const [kategori, setKategori] = useState("");
  const [arama, setArama] = useState("");
  const [not, setNot] = useState("");
  const [sepetAcik, setSepetAcik] = useState(false);
  const [busy, setBusy] = useState(false);
  // CLAUDE.md kuralı: kayıt açan aksiyonda kilit REF ile — state kilidi iki hızlı
  // dokunuşta yarışı kaybediyor.
  const kilitRef = useRef(false);

  useEffect(() => {
    if (hazir && !user) router.replace("/kantin/giris");
  }, [hazir, user, router]);

  useEffect(() => {
    if (!seciliId) return;
    setMenu(null);
    return izleMenu(seciliId, setMenu);
  }, [seciliId]);
  useEffect(() => {
    if (!seciliId) return;
    return izleBugunOzet(seciliId, setOzet);
  }, [seciliId]);
  // Kantin değişince sepet sıfırlanır: başka kantinin ürünü sepette kalamaz.
  useEffect(() => {
    setSepet({});
    setKategori("");
    setArama("");
  }, [seciliId]);

  const kuyruk = ozet?.acik ?? 0;
  const tahmin = seciliKantin ? beklemeDk(seciliKantin, kuyruk) : 0;

  const aktifMenu = useMemo(() => (menu ?? []).filter((u) => u.aktif), [menu]);
  const kategoriler = useMemo(
    () => [...new Set(aktifMenu.map((u) => u.kategori?.trim()).filter(Boolean) as string[])],
    [aktifMenu]
  );
  const q = arama.trim().toLowerCase();
  const gosterilen = aktifMenu.filter(
    (u) =>
      (!kategori || u.kategori?.trim() === kategori) &&
      (!q || `${u.ad} ${u.aciklama ?? ""}`.toLowerCase().includes(q))
  );

  const satirlar: SiparisSatir[] = useMemo(
    () =>
      Object.entries(sepet)
        .filter(([, adet]) => adet > 0)
        .map(([urunId, adet]) => ({ urunId, adet, ad: (menu ?? []).find((u) => u.id === urunId)?.ad ?? "Ürün" })),
    [sepet, menu]
  );
  const toplamAdet = satirlar.reduce((a, s) => a + s.adet, 0);
  const tutar = (l: SiparisSatir[]) =>
    l.reduce((a, s) => a + ((menu ?? []).find((u) => u.id === s.urunId)?.fiyat ?? 0) * s.adet, 0);

  const yasak = yasakli(kisi);
  const limit = seciliKantin?.kisiBasiLimit ?? 1;
  const limitDoldu = acikSiparisler.length >= limit;
  const acikMi = siparisAcikMi(seciliKantin);
  const engel = yasak || limitDoldu || !acikMi;
  const engelSebep = yasak
    ? "Siparişin geçici olarak kapalı."
    : limitDoldu
      ? "Zaten açık bir siparişin var."
      : !acikMi
        ? "Kantin şu an sipariş almıyor."
        : "";

  // Bugün kaçıncı sipariş — belge kimliğindeki sıra (sunucu tavanı 5).
  const bugunSayim = siparislerim.filter((s) => s.gun === gunKey()).length;

  const ekle = (u: MenuUrun, delta: number) =>
    setSepet((s) => ({ ...s, [u.id]: Math.max(0, Math.min(10, (s[u.id] ?? 0) + delta)) }));

  const gonder = async (gonderilecek: SiparisSatir[], gonderNot?: string) => {
    if (!kisi || !seciliKantin || !gonderilecek.length) return;
    if (kilitRef.current) return;
    kilitRef.current = true;
    setBusy(true);
    show("Sipariş gönderiliyor…", "busy");
    try {
      await siparisVer(seciliId, kisi, gonderilecek, gonderNot, bugunSayim + 1);
      setSepet({});
      setNot("");
      setSepetAcik(false);
      show("Siparişin alındı");
      router.push("/kantin/siparisim");
    } catch (e) {
      show(kantinHata(e), "error");
    } finally {
      kilitRef.current = false;
      setBusy(false);
    }
  };

  /** Son tamamlanmış/hazır sipariş — "yine aynısı" kısayolunun kaynağı. */
  const sonSiparis: Siparis | null = useMemo(
    () => siparislerim.find((s) => s.durum === "alindi" || s.durum === "hazir") ?? null,
    [siparislerim]
  );
  const tekrarSatirlar = useMemo(() => {
    if (!sonSiparis || !menu) return [];
    // Menüden düşmüş/tükenmiş ürünü sessizce taşıma — kişi tezgâhta öğrenmesin.
    return sonSiparis.satirlar.filter((x) => {
      const u = menu.find((m) => m.id === x.urunId);
      return !!u && u.aktif && !bugunTukendi(u);
    });
  }, [sonSiparis, menu]);
  const tekrarEksik = !!sonSiparis && tekrarSatirlar.length !== sonSiparis.satirlar.length;

  if (!hazir || !user) return <Bekle />;

  if (!seciliKantin) {
    return (
      <Sayfa>
        <BosDurum
          ikon="shield"
          baslik="Henüz kantin tanımlı değil"
          metin={
            kantinler.length === 0
              ? "Yönetici Ayarlar'dan kantin açınca burada görünecek."
              : "Üstteki listeden bir kantin seç."
          }
        />
      </Sayfa>
    );
  }

  const acilis = sonrakiAcilis(seciliKantin);

  return (
    <Sayfa>
      {toast}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold truncate">{seciliKantin.ad}</h1>
          {seciliKantin.yer && <p className="text-muted text-sm">{seciliKantin.yer}</p>}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
            !acikMi ? "bg-brand-soft text-brand" : "bg-[#1baf7a]/12 text-[#0f7a55]"
          }`}
        >
          <Icon name={!acikMi ? "lock" : "timer"} size={13} />
          {!acikMi ? (acilis ? `${acilis}'te açılıyor` : "Sipariş kapalı") : `~${tahmin} dk`}
        </span>
      </div>

      {yasak && (
        <Uyari
          tur="hata"
          metin="Siparişin geçici olarak kapalı — aldığın siparişleri teslim almadığın için kısa bir süre bekleyeceksin."
        />
      )}
      {!yasak && limitDoldu && (
        <Uyari
          tur="bilgi"
          metin={
            <>
              Açık bir siparişin var.{" "}
              <Link href="/kantin/siparisim" className="text-accent font-semibold underline underline-offset-2">
                Takip et
              </Link>
            </>
          }
        />
      )}
      {!yasak && !limitDoldu && !acikMi && (
        <Uyari
          tur="hata"
          metin={acilis ? `Kantin şu an kapalı — ${acilis}'te açılıyor.` : "Kantin şu an sipariş almıyor."}
        />
      )}

      {/* YİNE AYNISI — tek dokunuşluk tekrar sipariş */}
      {!engel && tekrarSatirlar.length > 0 && toplamAdet === 0 && (
        <div className="card p-4 mt-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-accent-soft text-accent grid place-items-center shrink-0">
            <Icon name="refresh" size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">Yine aynısı</p>
            <p className="text-muted text-xs truncate">
              {tekrarSatirlar.map((x) => `${x.adet}× ${x.ad}`).join(", ")}
              {tutar(tekrarSatirlar) > 0 ? ` · ${tutar(tekrarSatirlar)} ₺` : ""}
            </p>
            {tekrarEksik && <p className="text-[#8a6100] text-[11px] mt-0.5">Bugün olmayan ürünler çıkarıldı.</p>}
          </div>
          <button
            onClick={() => void gonder(tekrarSatirlar, sonSiparis?.not)}
            disabled={busy}
            className="btn-primary !py-2 !px-4 text-sm shrink-0"
          >
            Gönder
          </button>
        </div>
      )}

      {kategoriler.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto mt-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          <Cip aktif={kategori === ""} onClick={() => setKategori("")}>
            Hepsi
          </Cip>
          {kategoriler.map((k) => (
            <Cip key={k} aktif={kategori === k} onClick={() => setKategori(k)}>
              {k}
            </Cip>
          ))}
        </div>
      )}

      {aktifMenu.length > 10 && (
        <input
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Menüde ara"
          className="input-base !py-2 text-sm mt-3"
        />
      )}

      <div className="grid gap-3 mt-4 sm:grid-cols-2" style={{ paddingBottom: toplamAdet ? 104 : 0 }}>
        {menu === null && [0, 1, 2, 3].map((i) => <SkelBox key={i} className="h-24" />)}
        {menu !== null && gosterilen.length === 0 && (
          <div className="sm:col-span-2">
            <BosDurum
              ikon="list"
              baslik={q || kategori ? "Eşleşen ürün yok" : "Bugün menüde ürün yok"}
              metin={q || kategori ? "Aramayı değiştir." : "Kantin görevlisi ürün ekleyince burada görünür."}
            />
          </div>
        )}
        {gosterilen.map((u) => {
          const tukendi = bugunTukendi(u);
          const adet = sepet[u.id] ?? 0;
          return (
            <div
              key={u.id}
              className={`card overflow-hidden flex ${tukendi ? "opacity-55" : ""} ${adet > 0 ? "ring-2 ring-accent/40" : ""}`}
            >
              {u.gorselUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cldThumb(u.gorselUrl, 220, 220)}
                  alt=""
                  loading="lazy"
                  className="w-24 h-auto self-stretch object-cover shrink-0 bg-paper"
                />
              )}
              <div className="p-4 flex items-center gap-3 flex-1 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">{u.ad}</p>
                  {u.aciklama && <p className="text-muted text-xs mt-0.5 line-clamp-2">{u.aciklama}</p>}
                  <p className="text-muted text-xs mt-1 flex items-center gap-1.5 flex-wrap">
                    {!!u.fiyat && <span className="font-semibold text-ink">{u.fiyat} ₺</span>}
                    {tukendi && <span className="text-brand font-semibold">bugünlük bitti</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {adet > 0 && (
                    <>
                      <button
                        onClick={() => ekle(u, -1)}
                        aria-label={`${u.ad} azalt`}
                        className="w-11 h-11 rounded-full border border-line grid place-items-center transform-gpu active:scale-95 transition-transform"
                      >
                        <Icon name="minus" size={16} />
                      </button>
                      <span className="w-6 text-center tabular-nums font-bold">{adet}</span>
                    </>
                  )}
                  <button
                    onClick={() => ekle(u, 1)}
                    disabled={tukendi || engel}
                    aria-label={`${u.ad} ekle`}
                    className={`w-11 h-11 rounded-full grid place-items-center disabled:opacity-30 transform-gpu active:scale-95 transition-transform ${
                      adet > 0 ? "bg-accent text-white" : "border border-line"
                    }`}
                  >
                    <Icon name="plus" size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {toplamAdet > 0 && (
        <>
          <div
            className="fixed inset-x-0 bottom-0 z-40 p-3 pointer-events-none"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <div className="max-w-3xl mx-auto pointer-events-auto flex gap-2">
              <button
                onClick={() => setSepetAcik(true)}
                className="card shadow-lg p-3 flex items-center gap-3 text-left flex-1 min-w-0 transform-gpu active:scale-[0.99] transition-transform"
              >
                <span className="w-10 h-10 rounded-full bg-accent text-white grid place-items-center font-bold tabular-nums shrink-0">
                  {toplamAdet}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-sm">Sepeti gör</span>
                  <span className="block text-muted text-xs">
                    ~{tahmin} dk{tutar(satirlar) > 0 ? ` · ${tutar(satirlar)} ₺` : ""}
                  </span>
                </span>
              </button>
              <button
                onClick={() => void gonder(satirlar, not)}
                disabled={busy || engel}
                className="btn-primary !py-3 !px-6 text-sm shadow-lg shrink-0"
              >
                {busy ? "…" : "Gönder"}
              </button>
            </div>
          </div>

          {sepetAcik && (
            <div
              className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6"
              onClick={() => setSepetAcik(false)}
            >
              <div
                className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 animate-pop max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="font-display text-xl font-semibold">Siparişin</p>
                  <button
                    onClick={() => setSepetAcik(false)}
                    aria-label="Kapat"
                    className="w-11 h-11 rounded-full border border-line grid place-items-center"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>

                <div className="divide-y divide-line">
                  {satirlar.map((s) => {
                    const u = (menu ?? []).find((x) => x.id === s.urunId);
                    return (
                      <div key={s.urunId} className="py-2.5 flex items-center gap-3">
                        <span className="min-w-0 flex-1 text-sm">{s.ad}</span>
                        {!!u?.fiyat && <span className="text-muted text-xs tabular-nums">{u.fiyat * s.adet} ₺</span>}
                        <span className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => u && ekle(u, -1)}
                            aria-label="azalt"
                            className="w-11 h-11 rounded-full border border-line grid place-items-center"
                          >
                            <Icon name="minus" size={15} />
                          </button>
                          <span className="w-5 text-center tabular-nums font-semibold">{s.adet}</span>
                          <button
                            onClick={() => u && ekle(u, 1)}
                            aria-label="artır"
                            className="w-11 h-11 rounded-full border border-line grid place-items-center"
                          >
                            <Icon name="plus" size={15} />
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>

                <input
                  value={not}
                  onChange={(e) => setNot(e.target.value)}
                  placeholder="Not (isteğe bağlı) — ör. çay şekersiz"
                  maxLength={120}
                  className="input-base !py-2.5 text-sm mt-4"
                />
                <p className="text-muted text-xs mt-2">
                  Tahmini hazır: <b>~{tahmin} dk</b>
                  {tutar(satirlar) > 0 && (
                    <>
                      {" "}
                      · ödeme tezgâhta: <b>{tutar(satirlar)} ₺</b>
                    </>
                  )}
                </p>
                {engel && <p className="text-brand text-xs mt-1.5 font-semibold">{engelSebep}</p>}
                <button
                  onClick={() => void gonder(satirlar, not)}
                  disabled={busy || engel}
                  className="btn-primary w-full !py-3 text-sm mt-3"
                >
                  {busy ? "Gönderiliyor…" : "Siparişi gönder"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Sayfa>
  );
}

function Cip({ aktif, onClick, children }: { aktif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`chip !py-1.5 shrink-0 whitespace-nowrap ${aktif ? "!bg-ink !text-white !border-ink" : "text-muted"}`}
    >
      {children}
    </button>
  );
}

function Uyari({ tur, metin }: { tur: "hata" | "bilgi"; metin: React.ReactNode }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 mt-4 text-sm ${
        tur === "hata" ? "bg-brand-soft border-brand/30 text-brand" : "bg-accent-soft border-accent/25"
      }`}
    >
      {metin}
    </div>
  );
}

function Sayfa({ children }: { children: React.ReactNode }) {
  return <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">{children}</main>;
}
function Bekle() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <SkelBox className="h-8 w-48 mb-4" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <SkelBox key={i} className="h-24" />
        ))}
      </div>
    </main>
  );
}
