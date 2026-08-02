"use client";

/**
 * AYARLAR — kantin tanımı + menü. Kantinci kendi kantinini yönetir; yönetici
 * hepsini ve yeni kantin açabilir (iki kantin bugün, daha fazlası yarın —
 * model baştan çok kantinli).
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { izleMenu, kantinAc, kantinGuncelle, kantinHata, kantinSil, urunEkle } from "@/lib/kantin/api";
import { useKantin } from "@/lib/kantin/oturum";
import { Kantin, MenuUrun } from "@/lib/kantin/types";
import { useConfirm } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import UrunSatiri from "@/components/kantin/UrunSatiri";

export default function KantinAyarlarPage() {
  const { user, rol, hazir, seciliId, seciliKantin } = useKantin();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { show, toast } = useToast();
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

  // CLAUDE.md kuralı: kayıt açan aksiyonda kilit REF ile — iki hızlı dokunuş
  // aynı ürünü/kantini iki kez açıyordu.
  const urunKilit = useRef(false);
  const kantinKilit = useRef(false);

  const urunEkleGonder = async () => {
    if (!yeniAd.trim() || !seciliId || urunKilit.current) return;
    urunKilit.current = true;
    try {
      await urunEkle(seciliId, {
        ad: yeniAd.trim().slice(0, 60),
        aktif: true,
        sira: (menu[menu.length - 1]?.sira ?? 0) + 1,
      });
      setYeniAd("");
    } catch (e) {
      show(kantinHata(e), "error");
    } finally {
      urunKilit.current = false;
    }
  };

  const kantinAcGonder = async () => {
    if (!yeniKantin.trim() || kantinKilit.current) return;
    kantinKilit.current = true;
    try {
      await kantinAc(yeniKantin, yeniYer);
      setYeniKantin("");
      setYeniYer("");
      show("Kantin açıldı");
    } catch (e) {
      show(kantinHata(e), "error");
    } finally {
      kantinKilit.current = false;
    }
  };

  const yaz = (patch: Partial<Kantin>) =>
    kantinGuncelle(seciliId, patch).catch((e) => show(kantinHata(e), "error"));

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {dialog}
      {toast}
      <h1 className="font-display text-2xl font-semibold mb-4">Ayarlar</h1>

      {seciliKantin && (
        <div className="card p-5">
          <p className="eyebrow mb-3">{seciliKantin.ad}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Alan
              etiket="Kantin adı"
              deger={seciliKantin.ad}
              onKaydet={(v) => void yaz({ ad: v.slice(0, 60) })}
            />
            <Alan
              etiket="Yeri"
              deger={seciliKantin.yer ?? ""}
              onKaydet={(v) => void yaz({ yer: v.slice(0, 80) })}
            />
            <Sayi
              etiket="Aynı anda hazırlanabilir"
              ipucu="Bekleme tahmini bundan çıkar"
              deger={seciliKantin.kapasite ?? 4}
              min={1}
              max={50}
              onKaydet={(v) => void yaz({ kapasite: v })}
            />
            <Sayi
              etiket="Hazırlık süresi (dk)"
              deger={seciliKantin.hazirlikDk ?? 3}
              min={1}
              max={60}
              onKaydet={(v) => void yaz({ hazirlikDk: v })}
            />
            <Sayi
              etiket="Kişi başı açık sipariş"
              deger={seciliKantin.kisiBasiLimit ?? 1}
              min={1}
              max={5}
              onKaydet={(v) => void yaz({ kisiBasiLimit: v })}
            />
          </div>
          <Saatler kantin={seciliKantin} onKaydet={(v) => void yaz({ saatler: v })} />
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
              <UrunSatiri key={u.id} kantinId={seciliId} urun={u} onSil={confirm} onHata={(m) => show(m, "error")} />
            ))}
          </div>
        )}
        <p className="text-muted text-xs mt-3">Görsele dokunup fotoğraf yükleyebilirsin. Fiyat yalnız bilgidir — ödeme tezgâhta; stok boşsa sınırsız.</p>
      </div>

      {rol === "admin" && (
        <div className="card p-5 mt-5">
          <p className="eyebrow mb-3">Kantinler</p>
          <div className="flex gap-2 flex-wrap">
            <input value={yeniKantin} onChange={(e) => setYeniKantin(e.target.value)} placeholder="Kantin adı" className="input-base !py-2 text-sm flex-1 min-w-[8rem]" />
            <input value={yeniYer} onChange={(e) => setYeniYer(e.target.value)} placeholder="Yeri" className="input-base !py-2 text-sm flex-1 min-w-[8rem]" />
            <button onClick={() => void kantinAcGonder()} className="btn-primary !py-2 !px-4 text-sm shrink-0">
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
                  () =>
                    void user
                      ?.getIdToken()
                      .catch(() => undefined)
                      .then((t) => kantinSil(seciliId, t ?? undefined))
                      .then(() => show("Kantin silindi"))
                      .catch((e) => show(kantinHata(e), "error"))
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

/**
 * Çalışma pencereleri. Kantinci akşam kapatmayı unutunca gece vardiyası boşuna
 * sipariş veriyordu; saat penceresi bu sessiz arızayı kapatır. Boş bırakılırsa
 * eskisi gibi yalnız elle açılıp kapanır.
 */
function Saatler({ kantin, onKaydet }: { kantin: Kantin; onKaydet: (v: { bas: string; bit: string }[]) => void }) {
  const mevcut = kantin.saatler ?? [];
  const [liste, setListe] = useState<{ bas: string; bit: string }[]>(mevcut);
  useEffect(() => setListe(kantin.saatler ?? []), [kantin.id, kantin.saatler]);

  const kaydet = (v: { bas: string; bit: string }[]) => {
    setListe(v);
    onKaydet(v.filter((x) => x.bas && x.bit));
  };

  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="text-muted text-xs mb-2">
        Çalışma saatleri — <b>boşsa</b> hep açık (yalnız elle kapatılır).
      </p>
      <div className="flex flex-col gap-2">
        {liste.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="time"
              value={p.bas}
              onChange={(e) => kaydet(liste.map((x, j) => (j === i ? { ...x, bas: e.target.value } : x)))}
              className="input-base !py-2 text-sm !w-auto"
            />
            <span className="text-muted text-sm">–</span>
            <input
              type="time"
              value={p.bit}
              onChange={(e) => kaydet(liste.map((x, j) => (j === i ? { ...x, bit: e.target.value } : x)))}
              className="input-base !py-2 text-sm !w-auto"
            />
            <button
              onClick={() => kaydet(liste.filter((_, j) => j !== i))}
              aria-label="Kaldır"
              className="w-10 h-10 rounded-full border border-line grid place-items-center text-muted shrink-0"
            >
              <Icon name="close" size={13} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => kaydet([...liste, { bas: "08:00", bit: "17:00" }])}
        className="btn-ghost !py-1.5 !px-3 text-xs mt-2"
      >
        <Icon name="plus" size={12} /> Saat aralığı ekle
      </button>
    </div>
  );
}
