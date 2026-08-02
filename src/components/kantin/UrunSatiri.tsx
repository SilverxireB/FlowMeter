"use client";

/**
 * Menü ürünü düzenleme satırı.
 *
 * Kapalıyken tek satır (ad + görsel + menüde mi): kantinci sabah menüyü açıp
 * kapatırken uzun formlar arasında kaybolmasın. Ayrıntılar (açıklama, fiyat,
 * kategori, stok, görsel) AÇILINCA gelir.
 *
 * Görsel: Cloudinary'ye kantin klasörüne yüklenir; yükleme sırasında canlı yüzde
 * yerine dönen halka gösterilir — küçük dosyalarda yüzde bir anda %100'e sıçrayıp
 * "takıldı" hissi veriyordu (aynı ders FlowWall'da alındı).
 */
import { useRef, useState } from "react";
import { urunGorselSil, urunGorselYukle, urunGuncelle, urunSil } from "@/lib/kantin/api";
import { KATEGORILER, MenuUrun } from "@/lib/kantin/types";
import { cldThumb } from "@/lib/cloudinary";
import { Icon } from "@/components/Icon";
import FlowSpinner from "@/components/FlowSpinner";
import { ConfirmOptions } from "@/components/ConfirmDialog";

export default function UrunSatiri({
  kantinId,
  urun,
  onSil,
  onHata,
}: {
  kantinId: string;
  urun: MenuUrun;
  onSil: (opts: ConfirmOptions, run: () => void) => void;
  onHata: (m: string) => void;
}) {
  const [acik, setAcik] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const dosyaRef = useRef<HTMLInputElement>(null);

  const yaz = (patch: Partial<MenuUrun>) => urunGuncelle(kantinId, urun.id, patch).catch((e) => onHata(e.message));

  const gorselSec = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      onHata("Yalnız görsel dosyası yüklenebilir.");
      return;
    }
    setYukleniyor(true);
    try {
      await urunGorselYukle(kantinId, urun.id, f);
    } catch (e) {
      onHata(e instanceof Error ? e.message : "Görsel yüklenemedi.");
    } finally {
      setYukleniyor(false);
      if (dosyaRef.current) dosyaRef.current.value = "";
    }
  };

  return (
    <div className={`rounded-2xl border ${urun.aktif ? "border-line" : "border-line bg-paper/60"}`}>
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={() => dosyaRef.current?.click()}
          className="w-14 h-14 rounded-xl bg-paper overflow-hidden shrink-0 grid place-items-center border border-line"
          aria-label={`${urun.ad} görseli`}
        >
          {yukleniyor ? (
            <FlowSpinner size={22} />
          ) : urun.gorselUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cldThumb(urun.gorselUrl, 120, 120)} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-muted">
              <Icon name="camera" size={18} />
            </span>
          )}
        </button>
        <input
          ref={dosyaRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void gorselSec(e.target.files?.[0])}
        />

        <button onClick={() => setAcik((a) => !a)} className="min-w-0 flex-1 text-left">
          <p className="font-semibold text-sm truncate">{urun.ad}</p>
          <p className="text-muted text-xs truncate">
            {[urun.kategori, urun.fiyat ? `${urun.fiyat} ₺` : "", urun.gunlukStok != null ? `stok ${urun.gunlukStok}` : ""]
              .filter(Boolean)
              .join(" · ") || "ayrıntı yok"}
          </p>
        </button>

        <label className="flex items-center gap-1.5 text-xs shrink-0 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={urun.aktif}
            onChange={(e) => yaz({ aktif: e.target.checked })}
            className="w-5 h-5 accent-[#4f46e5]"
          />
          <span className="hidden sm:inline">Menüde</span>
        </label>
        <button
          onClick={() => setAcik((a) => !a)}
          aria-label={acik ? "Kapat" : "Düzenle"}
          aria-expanded={acik}
          className={`w-9 h-9 rounded-full grid place-items-center text-muted shrink-0 transition-transform ${acik ? "rotate-180" : ""}`}
        >
          <Icon name="down" size={15} />
        </button>
      </div>

      {acik && (
        <div className="px-3 pb-3 -mt-1 flex flex-col gap-2">
          <input
            key={`ad-${urun.id}-${urun.ad}`}
            defaultValue={urun.ad}
            onBlur={(e) => e.target.value.trim() && yaz({ ad: e.target.value.trim().slice(0, 60) })}
            placeholder="Ürün adı"
            className="input-base !py-2 text-sm"
          />
          <input
            key={`ac-${urun.id}-${urun.aciklama}`}
            defaultValue={urun.aciklama ?? ""}
            onBlur={(e) => yaz({ aciklama: e.target.value.trim().slice(0, 90) })}
            placeholder="Açıklama (isteğe bağlı)"
            className="input-base !py-2 text-sm"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <label className="text-xs text-muted flex flex-col gap-1">
              Kategori
              <input
                key={`k-${urun.id}-${urun.kategori}`}
                defaultValue={urun.kategori ?? ""}
                onBlur={(e) => yaz({ kategori: e.target.value.trim().slice(0, 30) })}
                list="kantin-kategoriler"
                placeholder="—"
                className="input-base !py-2 text-sm"
              />
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">
              Fiyat ₺
              <input
                key={`f-${urun.id}-${urun.fiyat}`}
                defaultValue={urun.fiyat ?? ""}
                onBlur={(e) => yaz({ fiyat: Math.max(0, Number(e.target.value) || 0) })}
                inputMode="numeric"
                placeholder="—"
                className="input-base !py-2 text-sm"
              />
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">
              Günlük stok
              <input
                key={`s-${urun.id}-${urun.gunlukStok}`}
                defaultValue={urun.gunlukStok ?? ""}
                onBlur={(e) =>
                  yaz({ gunlukStok: e.target.value.trim() ? Math.max(0, Number(e.target.value) || 0) : undefined })
                }
                inputMode="numeric"
                placeholder="sınırsız"
                className="input-base !py-2 text-sm"
              />
            </label>
          </div>

          <div className="flex gap-2 flex-wrap pt-1">
            <button onClick={() => dosyaRef.current?.click()} disabled={yukleniyor} className="btn-ghost !py-1.5 !px-3 text-xs">
              <Icon name="image" size={13} /> {urun.gorselUrl ? "Görseli değiştir" : "Görsel ekle"}
            </button>
            {urun.gorselUrl && (
              <button
                onClick={() => void urunGorselSil(kantinId, urun.id).catch((e) => onHata(e.message))}
                className="btn-ghost !py-1.5 !px-3 text-xs"
              >
                Görseli kaldır
              </button>
            )}
            <button
              onClick={() =>
                onSil(
                  { title: "Ürün silinsin mi?", message: `"${urun.ad}" menüden kalkar.`, confirmLabel: "Sil", danger: true },
                  () => void urunSil(kantinId, urun.id).catch((e) => onHata(e.message))
                )
              }
              className="btn-ghost !py-1.5 !px-3 text-xs !text-brand !border-brand/40 ml-auto"
            >
              <Icon name="trash" size={13} /> Sil
            </button>
          </div>
        </div>
      )}

      <datalist id="kantin-kategoriler">
        {KATEGORILER.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
    </div>
  );
}
