"use client";

/**
 * SİPARİŞİM — molada elde tutulan ekran.
 *
 * Tek işi var: "ne zaman hazır?" sorusunu bir bakışta cevaplamak. Uyarı (ses/
 * titreşim/bildirim) ve ekranı uyanık tutma artık KABUKTA (lib/kantin/oturum):
 * kişi Menü sekmesine geçtiğinde de çalışsın diye. Burada yalnız gösterim var.
 *
 * Kuyruk bilgisi tek özet belgesinden gelir; bu sayfa artık günün tüm
 * siparişlerini dinlemiyor (mahremiyet + kota).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { beklemeDk, durumDegistir, izleBugunOzet, kantinHata } from "@/lib/kantin/api";
import { useKantin } from "@/lib/kantin/oturum";
import { BildirimDurum, bildirimDurumu, bildirimIste } from "@/lib/kantin/bildirim";
import { DURUM_ETIKET, GunOzet, Siparis, SiparisDurum } from "@/lib/kantin/types";
import { Icon } from "@/components/Icon";
import { SkelBox } from "@/components/Skeleton";
import BosDurum from "@/components/kantin/BosDurum";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const ADIMLAR: { durum: SiparisDurum; etiket: string }[] = [
  { durum: "yeni", etiket: "Alındı" },
  { durum: "hazirlaniyor", etiket: "Hazırlanıyor" },
  { durum: "hazir", etiket: "Hazır" },
];

export default function SiparisimPage() {
  const { user, hazir, seciliId, seciliKantin, acikSiparisler, siparislerim } = useKantin();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { show, toast } = useToast();
  const [izin, setIzin] = useState<BildirimDurum>("sorulmadi");
  const [ozet, setOzet] = useState<GunOzet | null>(null);

  useEffect(() => {
    if (hazir && !user) router.replace("/kantin/giris");
  }, [hazir, user, router]);
  useEffect(() => setIzin(bildirimDurumu()), []);
  useEffect(() => {
    if (!seciliId) return;
    return izleBugunOzet(seciliId, setOzet);
  }, [seciliId]);

  if (!hazir || !user) return <Bekle />;

  const gecmis = siparislerim.filter((s) => !acikSiparisler.some((a) => a.id === s.id)).slice(0, 20);
  const kuyruk = Math.max(0, (ozet?.acik ?? 0) - acikSiparisler.length);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {dialog}
      {toast}
      <h1 className="font-display text-2xl font-semibold">Siparişim</h1>
      <p className="text-muted text-sm mb-4">{seciliKantin?.ad ?? ""}</p>

      {acikSiparisler.length > 0 && izin === "sorulmadi" && (
        <button
          onClick={() => void bildirimIste().then(setIzin)}
          className="w-full text-left card p-4 mb-3 flex items-center gap-3 transform-gpu active:scale-[0.99] transition-transform"
        >
          <span className="w-10 h-10 rounded-full bg-accent-soft text-accent grid place-items-center shrink-0">
            <Icon name="megaphone" size={18} />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-sm">Hazır olunca haber ver</span>
            <span className="block text-muted text-xs">Bildirime izin ver, telefonu cebine koyabilirsin.</span>
          </span>
        </button>
      )}
      {acikSiparisler.length > 0 && izin === "kapali" && (
        <p className="card p-4 mb-3 text-xs text-muted">
          Bildirimler bu site için kapalı. Tarayıcı ayarlarından açabilirsin; kapalıyken de uygulama
          açıkken ses ve titreşimle uyarır.
        </p>
      )}

      {acikSiparisler.length === 0 ? (
        <BosDurum
          ikon="receipt"
          baslik="Açık siparişin yok"
          metin="Menüden seçip gönderdiğinde durumu burada canlı görürsün."
          aksiyon={
            <Link href="/kantin/menu" className="btn-primary !py-2 !px-4 text-sm inline-block">
              Menüye git
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {acikSiparisler.map((s) => (
            <SiparisKarti
              key={s.id}
              siparis={s}
              onunde={kuyruk}
              tahminDk={seciliKantin ? beklemeDk(seciliKantin, 0) : 3}
              onVazgec={() =>
                confirm(
                  { title: "Siparişten vazgeç", message: "Sipariş iptal edilecek.", confirmLabel: "Vazgeç", danger: true },
                  () =>
                    void durumDegistir(seciliId, s, "iptal")
                      .then(() => show("Sipariş iptal edildi"))
                      .catch((e) => show(kantinHata(e), "error"))
                )
              }
            />
          ))}
        </div>
      )}

      {gecmis.length > 0 && (
        <>
          <p className="eyebrow mt-8 mb-2">Geçmiş</p>
          <div className="card divide-y divide-line">
            {gecmis.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm truncate">{s.satirlar.map((x) => `${x.adet}× ${x.ad}`).join(", ")}</p>
                  <p className="text-muted text-xs">{s.gun}</p>
                </div>
                <span
                  className={`text-xs shrink-0 font-semibold ${
                    s.durum === "alinmadi" ? "text-brand" : s.durum === "alindi" ? "text-[#0f7a55]" : "text-muted"
                  }`}
                >
                  {DURUM_ETIKET[s.durum]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function SiparisKarti({
  siparis,
  onunde,
  tahminDk,
  onVazgec,
}: {
  siparis: Siparis;
  onunde: number;
  tahminDk: number;
  onVazgec: () => void;
}) {
  const adimIdx = Math.max(0, ADIMLAR.findIndex((a) => a.durum === siparis.durum));
  const hazirMi = siparis.durum === "hazir";
  const [simdi, setSimdi] = useState(() => Date.now());
  useEffect(() => {
    if (hazirMi) return;
    const iv = window.setInterval(() => setSimdi(Date.now()), 15000);
    return () => window.clearInterval(iv);
  }, [hazirMi]);
  const bas = siparis.createdAt?.toMillis?.() ?? simdi;
  const gecenDk = Math.max(0, Math.round((simdi - bas) / 60000));
  const kalan = Math.max(0, (onunde + 1) * tahminDk - gecenDk);

  return (
    <div
      className={`rounded-3xl border p-5 ${
        hazirMi
          ? "bg-[#1baf7a]/12 border-[#1baf7a]/40"
          : siparis.durum === "hazirlaniyor"
            ? "bg-[#eda100]/10 border-[#eda100]/35"
            : "card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl font-semibold">{DURUM_ETIKET[siparis.durum]}</p>
          <p className="text-sm mt-0.5">{siparis.satirlar.map((x) => `${x.adet}× ${x.ad}`).join(", ")}</p>
          {siparis.not && <p className="text-muted text-xs mt-0.5">Not: {siparis.not}</p>}
        </div>
        {!hazirMi && (
          <span className="text-right shrink-0">
            <span className="block font-display text-2xl font-semibold tabular-nums">~{kalan || 1}</span>
            <span className="block text-muted text-xs">dakika</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-4">
        {ADIMLAR.map((a, i) => (
          <div key={a.durum} className="flex-1">
            <div
              className={`h-1.5 rounded-full ${i <= adimIdx ? (hazirMi ? "bg-[#0f7a55]" : "bg-accent") : "bg-ink/10"} ${
                i === adimIdx && !hazirMi ? "animate-pulse" : ""
              }`}
            />
            <p className={`text-[11px] mt-1 ${i <= adimIdx ? "font-semibold" : "text-muted"}`}>{a.etiket}</p>
          </div>
        ))}
      </div>

      {hazirMi && (
        <p className="text-sm font-semibold mt-4 flex items-center gap-2">
          <Icon name="check" size={15} /> Tezgâhtan al: {siparis.ad} · {siparis.sicil}
        </p>
      )}
      {!hazirMi && onunde > 0 && <p className="text-muted text-xs mt-3">Önünde {onunde} sipariş var.</p>}
      {siparis.durum === "yeni" && (
        <button onClick={onVazgec} className="btn-ghost !py-2 !px-4 text-sm mt-3 !text-brand !border-brand/40">
          Vazgeç
        </button>
      )}
    </div>
  );
}

function Bekle() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <SkelBox className="h-8 w-40 mb-4" />
      <SkelBox className="h-40" />
    </main>
  );
}
