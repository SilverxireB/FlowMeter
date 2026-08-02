"use client";

/**
 * MENÜ + SİPARİŞ — personelin ana ekranı.
 *
 * Tasarım kararı: mola 10 dakika. O yüzden ekran "katalog" değil, iki dokunuşluk
 * bir sipariş: ürüne bas, sepet altta birikir, tek düğmeyle gönder. Verilen söz
 * (tahmini hazır olma süresi) kuyruğa göre hesaplanır ve İYİMSER DEĞİLDİR —
 * tutmayan süre, bu ürünü ilk günde çöpe atar.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  beklemeDk,
  gunKey,
  izleGunSiparisleri,
  izleMenu,
  satilanAdet,
  siparisVer,
  yasakli,
} from "@/lib/kantin/api";
import { useKantin } from "@/lib/kantin/oturum";
import { ACIK_DURUMLAR, MenuUrun, Siparis, SiparisSatir } from "@/lib/kantin/types";

export default function KantinMenuPage() {
  const { user, kisi, hazir, seciliKantin, seciliId } = useKantin();
  const router = useRouter();
  const [menu, setMenu] = useState<MenuUrun[]>([]);
  const [bugun, setBugun] = useState<Siparis[]>([]);
  const [sepet, setSepet] = useState<Record<string, number>>({});
  const [not, setNot] = useState("");
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState("");

  useEffect(() => {
    if (hazir && !user) router.replace("/kantin/giris");
  }, [hazir, user, router]);

  useEffect(() => {
    if (!seciliId) return;
    return izleMenu(seciliId, setMenu);
  }, [seciliId]);
  useEffect(() => {
    if (!seciliId) return;
    return izleGunSiparisleri(seciliId, gunKey(), setBugun);
  }, [seciliId]);

  const acikSiparisim = bugun.filter((s) => s.uid === user?.uid && ACIK_DURUMLAR.includes(s.durum));
  const kuyruk = bugun.filter((s) => s.durum === "yeni" || s.durum === "hazirlaniyor").length;
  const tahmin = seciliKantin ? beklemeDk(seciliKantin, kuyruk) : 0;

  const satirlar: SiparisSatir[] = useMemo(
    () =>
      Object.entries(sepet)
        .filter(([, adet]) => adet > 0)
        .map(([urunId, adet]) => ({ urunId, adet, ad: menu.find((u) => u.id === urunId)?.ad ?? "Ürün" })),
    [sepet, menu]
  );
  const toplamAdet = satirlar.reduce((a, s) => a + s.adet, 0);

  const kalanStok = (u: MenuUrun): number | null =>
    u.gunlukStok == null ? null : Math.max(0, u.gunlukStok - satilanAdet(bugun, u.id));

  const ekle = (u: MenuUrun, delta: number) => {
    setHata("");
    setSepet((s) => {
      const yeni = Math.max(0, (s[u.id] ?? 0) + delta);
      const kalan = kalanStok(u);
      return { ...s, [u.id]: kalan == null ? Math.min(10, yeni) : Math.min(10, kalan, yeni) };
    });
  };

  const gonder = async () => {
    if (!kisi || !seciliKantin || !satirlar.length || busy) return;
    setBusy(true);
    setHata("");
    try {
      await siparisVer(seciliId, kisi, satirlar, not);
      setSepet({});
      setNot("");
      router.push("/kantin/siparisim");
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Sipariş verilemedi.");
    } finally {
      setBusy(false);
    }
  };

  if (!hazir || !user) return <Bekle />;
  if (!seciliKantin) {
    return (
      <Sayfa>
        <p className="text-muted">Henüz kantin tanımlı değil.</p>
      </Sayfa>
    );
  }

  const yasak = yasakli(kisi);
  const limit = seciliKantin.kisiBasiLimit ?? 1;
  const limitDoldu = acikSiparisim.length >= limit;
  const kapali = !seciliKantin.acik;

  return (
    <Sayfa>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">{seciliKantin.ad}</h1>
          {seciliKantin.yer && <p className="text-muted text-sm">{seciliKantin.yer}</p>}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            kapali ? "bg-brand-soft text-brand" : "bg-[#1baf7a]/12 text-[#0f7a55]"
          }`}
        >
          {kapali ? "Sipariş kapalı" : `Şu an ~${tahmin} dk`}
        </span>
      </div>

      {yasak && (
        <p className="card p-4 mt-4 text-sm text-brand">
          Siparişin geçici olarak kapalı. Aldığın siparişleri teslim almadığın için kısa bir süre bekleyeceksin.
        </p>
      )}
      {!yasak && limitDoldu && (
        <p className="card p-4 mt-4 text-sm">
          Açık bir siparişin var.{" "}
          <Link href="/kantin/siparisim" className="text-accent font-semibold">
            Siparişim
          </Link>{" "}
          sayfasından takip et.
        </p>
      )}

      <div className="flex flex-col gap-2 mt-4">
        {menu.filter((u) => u.aktif).length === 0 && (
          <p className="text-muted text-sm py-6 text-center">Bugün menüde ürün yok.</p>
        )}
        {menu
          .filter((u) => u.aktif)
          .map((u) => {
            const kalan = kalanStok(u);
            const tukendi = kalan === 0;
            const adet = sepet[u.id] ?? 0;
            return (
              <div key={u.id} className={`card p-4 flex items-center gap-3 ${tukendi ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">{u.ad}</p>
                  {u.aciklama && <p className="text-muted text-xs mt-0.5">{u.aciklama}</p>}
                  <p className="text-muted text-xs mt-0.5">
                    {u.fiyat ? `${u.fiyat} ₺` : ""}
                    {u.fiyat && kalan != null ? " · " : ""}
                    {kalan != null ? (tukendi ? "tükendi" : `${kalan} adet kaldı`) : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => ekle(u, -1)}
                    disabled={adet === 0}
                    aria-label={`${u.ad} azalt`}
                    className="w-10 h-10 rounded-full border border-line disabled:opacity-30 text-lg leading-none"
                  >
                    −
                  </button>
                  <span className="w-6 text-center tabular-nums font-semibold">{adet}</span>
                  <button
                    onClick={() => ekle(u, 1)}
                    disabled={tukendi || kapali || yasak || limitDoldu}
                    aria-label={`${u.ad} ekle`}
                    className="w-10 h-10 rounded-full border border-line disabled:opacity-30 text-lg leading-none"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {toplamAdet > 0 && (
        <div className="sticky bottom-3 mt-4">
          <div className="card p-4 shadow-lg">
            <p className="text-sm font-semibold mb-2">
              {toplamAdet} ürün · tahmini hazır: ~{tahmin} dk
            </p>
            <input
              value={not}
              onChange={(e) => setNot(e.target.value)}
              placeholder="Not (isteğe bağlı) — ör. çay şekersiz"
              className="input-base !py-2 text-sm mb-2"
            />
            {hata && <p className="text-brand text-xs mb-2">{hata}</p>}
            <button
              onClick={() => void gonder()}
              disabled={busy || kapali || yasak || limitDoldu}
              className="btn-primary w-full !py-2.5 text-sm"
            >
              {busy ? "Gönderiliyor…" : "Siparişi gönder"}
            </button>
          </div>
        </div>
      )}
    </Sayfa>
  );
}

function Sayfa({ children }: { children: React.ReactNode }) {
  return <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">{children}</main>;
}
function Bekle() {
  return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;
}
