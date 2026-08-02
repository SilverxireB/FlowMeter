"use client";

/**
 * TEZGÂH — kantin görevlisinin ekranı (tablet). Sipariş kolonları soldan sağa
 * akar: Yeni → Hazırlanıyor → Hazır. Tek dokunuş bir sonraki duruma geçirir;
 * "Gelinmedi" ayrı bir düğme, çünkü raporun ve yaptırımın kaynağı o.
 *
 * Ekran açık kalacağı için başlıkta bugünün özeti var; ayrıca "Siparişleri
 * kapat" ile kantinci akışı anında durdurabilir (mola bitti, malzeme bitti).
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { durumDegistir, gunKey, izleGunSiparisleri, kantinGuncelle } from "@/lib/kantin/api";
import { useKantin } from "@/lib/kantin/oturum";
import { Siparis, SiparisDurum } from "@/lib/kantin/types";

export default function TezgahPage() {
  const { user, kisi, hazir, seciliId, seciliKantin } = useKantin();
  const router = useRouter();
  const [liste, setListe] = useState<Siparis[]>([]);

  useEffect(() => {
    if (hazir && !user) router.replace("/kantin/giris");
  }, [hazir, user, router]);

  useEffect(() => {
    if (!seciliId) return;
    return izleGunSiparisleri(seciliId, gunKey(), setListe);
  }, [seciliId]);

  if (!hazir || !user) return <Bekle />;
  if (kisi && kisi.rol === "personel") {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-xl font-bold mb-1">Yetki yok</p>
        <p className="text-muted">Bu ekran kantin görevlileri içindir.</p>
      </main>
    );
  }

  const kolon = (d: SiparisDurum) => liste.filter((s) => s.durum === d);
  const yeni = kolon("yeni");
  const hazirlaniyor = kolon("hazirlaniyor");
  const hazirlar = kolon("hazir");
  const teslim = liste.filter((s) => s.durum === "alindi").length;
  const gelinmedi = liste.filter((s) => s.durum === "alinmadi").length;

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">Tezgâh</h1>
          <p className="text-muted text-sm">
            {seciliKantin?.ad} · bugün {liste.length} sipariş · {teslim} teslim
            {gelinmedi > 0 && ` · ${gelinmedi} gelinmedi`}
          </p>
        </div>
        {seciliKantin && (
          <button
            onClick={() => void kantinGuncelle(seciliId, { acik: !seciliKantin.acik })}
            className={`!py-2 !px-4 text-sm rounded-full font-semibold ${
              seciliKantin.acik ? "btn-ghost !border-brand !text-brand" : "btn-primary"
            }`}
          >
            {seciliKantin.acik ? "Siparişleri kapat" : "Siparişleri aç"}
          </button>
        )}
      </div>

      <Kolon
        baslik="Yeni"
        vurgu
        liste={yeni}
        bos="Yeni sipariş yok."
        eylemler={(s) => [
          { etiket: "Hazırlamaya başla", durum: "hazirlaniyor", birincil: true },
          { etiket: "İptal", durum: "iptal" },
        ]}
        kantinId={seciliId}
      />
      <Kolon
        baslik="Hazırlanıyor"
        liste={hazirlaniyor}
        bos="Hazırlanan yok."
        eylemler={() => [{ etiket: "Hazır", durum: "hazir", birincil: true }]}
        kantinId={seciliId}
      />
      <Kolon
        baslik="Hazır — teslim bekliyor"
        liste={hazirlar}
        bos="Teslim bekleyen yok."
        eylemler={() => [
          { etiket: "Teslim edildi", durum: "alindi", birincil: true },
          { etiket: "Gelinmedi", durum: "alinmadi" },
        ]}
        kantinId={seciliId}
      />
    </main>
  );
}

function Kolon({
  baslik,
  liste,
  bos,
  eylemler,
  kantinId,
  vurgu,
}: {
  baslik: string;
  liste: Siparis[];
  bos: string;
  eylemler: (s: Siparis) => { etiket: string; durum: SiparisDurum; birincil?: boolean }[];
  kantinId: string;
  vurgu?: boolean;
}) {
  return (
    <section className="mt-6">
      <p className="eyebrow mb-2">
        {baslik} {liste.length > 0 && <span className={vurgu ? "text-accent" : ""}>· {liste.length}</span>}
      </p>
      {liste.length === 0 ? (
        <p className="text-muted text-sm">{bos}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {liste.map((s) => (
            <div key={s.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">
                    {s.ad} <span className="text-muted font-normal">· {s.sicil}</span>
                  </p>
                  <p className="text-sm mt-0.5">{s.satirlar.map((x) => `${x.adet}× ${x.ad}`).join(", ")}</p>
                  {s.not && <p className="text-muted text-xs mt-0.5">Not: {s.not}</p>}
                </div>
                <span className="text-muted text-xs shrink-0 tabular-nums">{saat(s)}</span>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                {eylemler(s).map((e) => (
                  <button
                    key={e.durum}
                    onClick={() => void durumDegistir(kantinId, s.id, e.durum)}
                    className={`${e.birincil ? "btn-primary" : "btn-ghost"} !py-2 !px-4 text-sm`}
                  >
                    {e.etiket}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function saat(s: Siparis): string {
  const t = s.createdAt?.toMillis?.();
  if (!t) return "";
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function Bekle() {
  return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;
}
