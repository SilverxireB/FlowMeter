"use client";

/**
 * AYARLAR — kantin tanımı + menü. Kantinci kendi kantinini yönetir; yönetici
 * hepsini ve yeni kantin açabilir (iki kantin bugün, daha fazlası yarın —
 * model baştan çok kantinli).
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  izleMenu,
  kantinAc,
  kantinGuncelle,
  kantinSil,
  urunEkle,
  urunGuncelle,
  urunSil,
} from "@/lib/kantin/api";
import { useKantin } from "@/lib/kantin/oturum";
import { MenuUrun } from "@/lib/kantin/types";
import { useConfirm } from "@/components/ConfirmDialog";

export default function KantinAyarlarPage() {
  const { user, rol, hazir, seciliId, seciliKantin } = useKantin();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [menu, setMenu] = useState<MenuUrun[]>([]);
  const [yeniAd, setYeniAd] = useState("");
  const [yeniKantin, setYeniKantin] = useState("");
  const [yeniYer, setYeniYer] = useState("");

  useEffect(() => {
    if (hazir && !user) router.replace("/kantin/giris");
  }, [hazir, user, router]);
  useEffect(() => {
    if (!seciliId) return;
    return izleMenu(seciliId, setMenu);
  }, [seciliId]);

  if (!hazir || !user) return <Bekle />;
  if (rol === "personel") {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-xl font-bold mb-1">Yetki yok</p>
        <p className="text-muted">Ayarlar kantin görevlileri içindir.</p>
      </main>
    );
  }

  const urunEkleGonder = async () => {
    if (!yeniAd.trim() || !seciliId) return;
    await urunEkle(seciliId, {
      ad: yeniAd.trim().slice(0, 60),
      aktif: true,
      sira: (menu[menu.length - 1]?.sira ?? 0) + 1,
    });
    setYeniAd("");
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {dialog}
      <h1 className="font-display text-2xl font-semibold mb-4">Ayarlar</h1>

      {seciliKantin && (
        <div className="card p-5">
          <p className="eyebrow mb-3">{seciliKantin.ad}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Alan
              etiket="Kantin adı"
              deger={seciliKantin.ad}
              onKaydet={(v) => kantinGuncelle(seciliId, { ad: v.slice(0, 60) })}
            />
            <Alan
              etiket="Yeri"
              deger={seciliKantin.yer ?? ""}
              onKaydet={(v) => kantinGuncelle(seciliId, { yer: v.slice(0, 80) })}
            />
            <Sayi
              etiket="Aynı anda hazırlanabilir"
              ipucu="Bekleme tahmini bundan çıkar"
              deger={seciliKantin.kapasite ?? 4}
              min={1}
              max={50}
              onKaydet={(v) => kantinGuncelle(seciliId, { kapasite: v })}
            />
            <Sayi
              etiket="Hazırlık süresi (dk)"
              deger={seciliKantin.hazirlikDk ?? 3}
              min={1}
              max={60}
              onKaydet={(v) => kantinGuncelle(seciliId, { hazirlikDk: v })}
            />
            <Sayi
              etiket="Kişi başı açık sipariş"
              deger={seciliKantin.kisiBasiLimit ?? 1}
              min={1}
              max={5}
              onKaydet={(v) => kantinGuncelle(seciliId, { kisiBasiLimit: v })}
            />
          </div>
        </div>
      )}

      <div className="card p-5 mt-5">
        <p className="eyebrow mb-3">Menü</p>
        <div className="flex gap-2 mb-4">
          <input
            value={yeniAd}
            onChange={(e) => setYeniAd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void urunEkleGonder()}
            placeholder="Ürün adı"
            className="input-base !py-2 text-sm"
          />
          <button onClick={() => void urunEkleGonder()} disabled={!yeniAd.trim()} className="btn-primary !py-2 !px-4 text-sm shrink-0">
            Ekle
          </button>
        </div>

        {menu.length === 0 ? (
          <p className="text-muted text-sm">Menü boş.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {menu.map((u) => (
              <div key={u.id} className="rounded-2xl border border-line p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    key={`ad-${u.id}-${u.ad}`}
                    defaultValue={u.ad}
                    onBlur={(e) => e.target.value.trim() && urunGuncelle(seciliId, u.id, { ad: e.target.value.trim().slice(0, 60) })}
                    className="input-base !py-1.5 text-sm flex-1 min-w-[8rem]"
                  />
                  <label className="flex items-center gap-1.5 text-xs shrink-0">
                    <input
                      type="checkbox"
                      checked={u.aktif}
                      onChange={(e) => urunGuncelle(seciliId, u.id, { aktif: e.target.checked })}
                      className="w-4 h-4 accent-[#4f46e5]"
                    />
                    Menüde
                  </label>
                  <button
                    onClick={() =>
                      confirm(
                        { title: "Ürün silinsin mi?", message: `"${u.ad}" menüden kalkar.`, confirmLabel: "Sil", danger: true },
                        () => void urunSil(seciliId, u.id)
                      )
                    }
                    className="btn-ghost !py-1.5 !px-3 text-xs !text-brand !border-brand/40 shrink-0"
                  >
                    Sil
                  </button>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <input
                    key={`ac-${u.id}-${u.aciklama}`}
                    defaultValue={u.aciklama ?? ""}
                    onBlur={(e) => urunGuncelle(seciliId, u.id, { aciklama: e.target.value.trim().slice(0, 90) })}
                    placeholder="Açıklama"
                    className="input-base !py-1.5 text-xs flex-1 min-w-[8rem]"
                  />
                  <input
                    key={`f-${u.id}-${u.fiyat}`}
                    defaultValue={u.fiyat ?? ""}
                    onBlur={(e) => urunGuncelle(seciliId, u.id, { fiyat: Math.max(0, Number(e.target.value) || 0) })}
                    placeholder="Fiyat ₺"
                    inputMode="numeric"
                    className="input-base !py-1.5 text-xs !w-24"
                  />
                  <input
                    key={`s-${u.id}-${u.gunlukStok}`}
                    defaultValue={u.gunlukStok ?? ""}
                    onBlur={(e) =>
                      urunGuncelle(seciliId, u.id, {
                        gunlukStok: e.target.value.trim() ? Math.max(0, Number(e.target.value) || 0) : undefined,
                      })
                    }
                    placeholder="Günlük stok"
                    inputMode="numeric"
                    className="input-base !py-1.5 text-xs !w-28"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-muted text-xs mt-3">Fiyat yalnız bilgidir — ödeme tezgâhta. Stok boşsa sınırsız.</p>
      </div>

      {rol === "admin" && (
        <div className="card p-5 mt-5">
          <p className="eyebrow mb-3">Kantinler</p>
          <div className="flex gap-2 flex-wrap">
            <input value={yeniKantin} onChange={(e) => setYeniKantin(e.target.value)} placeholder="Kantin adı" className="input-base !py-2 text-sm flex-1 min-w-[8rem]" />
            <input value={yeniYer} onChange={(e) => setYeniYer(e.target.value)} placeholder="Yeri" className="input-base !py-2 text-sm flex-1 min-w-[8rem]" />
            <button
              onClick={() => {
                if (!yeniKantin.trim()) return;
                void kantinAc(yeniKantin, yeniYer).then(() => {
                  setYeniKantin("");
                  setYeniYer("");
                });
              }}
              className="btn-primary !py-2 !px-4 text-sm shrink-0"
            >
              Kantin aç
            </button>
          </div>
          {seciliKantin && (
            <button
              onClick={() =>
                confirm(
                  {
                    title: "Kantin silinsin mi?",
                    message: `"${seciliKantin.ad}", menüsü ve tüm siparişleri silinir. Geri alınamaz.`,
                    confirmLabel: "Sil",
                    danger: true,
                  },
                  () => void kantinSil(seciliId)
                )
              }
              className="btn-ghost !py-2 !px-4 text-sm mt-3 !text-brand !border-brand/40"
            >
              &ldquo;{seciliKantin.ad}&rdquo; kantinini sil
            </button>
          )}
        </div>
      )}
    </main>
  );
}

function Alan({ etiket, deger, onKaydet }: { etiket: string; deger: string; onKaydet: (v: string) => void }) {
  return (
    <label className="text-sm flex flex-col gap-1">
      <span className="text-muted text-xs">{etiket}</span>
      <input key={deger} defaultValue={deger} onBlur={(e) => e.target.value.trim() !== deger && onKaydet(e.target.value.trim())} className="input-base !py-2 text-sm" />
    </label>
  );
}

function Sayi({
  etiket,
  ipucu,
  deger,
  min,
  max,
  onKaydet,
}: {
  etiket: string;
  ipucu?: string;
  deger: number;
  min: number;
  max: number;
  onKaydet: (v: number) => void;
}) {
  return (
    <label className="text-sm flex flex-col gap-1">
      <span className="text-muted text-xs">
        {etiket}
        {ipucu && <span className="opacity-70"> · {ipucu}</span>}
      </span>
      <input
        key={deger}
        type="number"
        min={min}
        max={max}
        defaultValue={deger}
        onBlur={(e) => onKaydet(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
        className="input-base !py-2 text-sm"
      />
    </label>
  );
}

function Bekle() {
  return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;
}
