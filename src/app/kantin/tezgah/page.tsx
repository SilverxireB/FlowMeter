"use client";

/**
 * TEZGÂH — kantin görevlisinin ekranı (tablet).
 *
 * Yoğun molada 30 sipariş aynı anda düşer. Kararlar oradan çıktı:
 *  - HAZIRLANACAKLAR ŞERİDİ: tezgâhta iş ÜRÜN bazında yapılır (bir seferde 12
 *    çay demlenir), sipariş bazında değil. Şerit "12× Çay · 8× Tost" der.
 *  - BEKLEME SÜRESİ her kartta ve renkli (6 dk amber, 10 dk gül) — en çok
 *    bekleyen gözle bulunur, sıra numarasına gerek kalmaz.
 *  - GERİ AL: yanlış dokunulan "teslim edildi" kartı ekrandan yok ediyordu;
 *    20 saniyelik geri alma penceresi tartışmayı bitirir.
 *  - STOK ŞERİDİ: malzeme yoğunlukta biter, o dakikada Ayarlar'a gitmek yapılmaz.
 *    Tek dokunuşla "bugünlük bitti" — ertesi gün kendiliğinden geri gelir.
 *  - Ekran uyanık; yeni siparişte ton (susturulabilir); gece yarısı gün döner.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bugunTukendi,
  durumDegistir,
  izleBugunSiparisleri,
  izleMenu,
  kantinGuncelle,
  kantinHata,
  satilanAdet,
  siparisAcikMi,
  urunTukendi,
} from "@/lib/kantin/api";
import { useKantin } from "@/lib/kantin/oturum";
import { YetkiKapisi, kapiDurumu } from "@/components/kantin/YetkiKapisi";
import { MenuUrun, Siparis, SiparisDurum } from "@/lib/kantin/types";
import { calDing, ekraniUyanikTut } from "@/lib/kantin/bildirim";
import { Icon } from "@/components/Icon";
import { SkelBox } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";

const SES_ANAHTAR = "kantin.tezgahSes";

export default function TezgahPage() {
  const { user, rol, rolHazir, hazir, seciliId, seciliKantin } = useKantin();
  const router = useRouter();
  const { show, toast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [liste, setListe] = useState<Siparis[] | null>(null);
  const [menu, setMenu] = useState<MenuUrun[]>([]);
  const [ara, setAra] = useState("");
  const [simdi, setSimdi] = useState(() => Date.now());
  const [ses, setSes] = useState(true);
  const [stokAcik, setStokAcik] = useState(false);
  const [geriAl, setGeriAl] = useState<{ s: Siparis; onceki: SiparisDurum } | null>(null);
  const oncekiRef = useRef<Set<string>>(new Set());
  const ilkRef = useRef(true);
  const sesRef = useRef(true);
  const islemRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (hazir && !user) router.replace("/kantin/giris");
  }, [hazir, user, router]);
  useEffect(() => {
    try {
      const v = localStorage.getItem(SES_ANAHTAR);
      if (v === "0") {
        setSes(false);
        sesRef.current = false;
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Rol kapısının ARKASINDA (bkz. rapor): yetkisiz kişiye hem "yetkin yok"
    // hem reddedilen okumanın kırmızı bildirimi çıkıyordu.
    if (!seciliId || rol === "personel") return;
    setListe(null);
    ilkRef.current = true;
    return izleBugunSiparisleri(
      seciliId,
      (s) => {
        const yeniler = new Set(s.filter((x) => x.durum === "yeni").map((x) => x.id));
        // İlk yüklemede ÇALMAZ: ekran açılınca birikmişler için arka arkaya
        // ötmek gürültüden başka bir şey değil.
        if (!ilkRef.current && sesRef.current) {
          for (const id of yeniler)
            if (!oncekiRef.current.has(id)) {
              calDing();
              break;
            }
        }
        ilkRef.current = false;
        oncekiRef.current = yeniler;
        setListe(s);
      },
      (e) => show(kantinHata(e), "error")
    );
  }, [seciliId, rol, show]);

  useEffect(() => {
    if (!seciliId) return;
    return izleMenu(seciliId, setMenu);
  }, [seciliId]);

  useEffect(() => {
    let birak: (() => void) | null = null;
    let iptal = false;
    void ekraniUyanikTut().then((f) => (iptal ? f() : (birak = f)));
    const iv = window.setInterval(() => setSimdi(Date.now()), 30000);
    return () => {
      iptal = true;
      birak?.();
      window.clearInterval(iv);
    };
  }, []);

  /** Durum değiştir — sipariş başına kilit (çift dokunuş) + hata görünür + geri al. */
  const durum = useCallback(
    async (s: Siparis, d: SiparisDurum, geriAlinabilir = true) => {
      if (islemRef.current.has(s.id)) return;
      islemRef.current.add(s.id);
      const onceki = s.durum;
      try {
        await durumDegistir(seciliId, s, d);
        if (geriAlinabilir) {
          setGeriAl({ s: { ...s, durum: d }, onceki });
          window.setTimeout(() => setGeriAl((g) => (g?.s.id === s.id ? null : g)), 20000);
        }
      } catch (e) {
        show(kantinHata(e), "error");
      } finally {
        islemRef.current.delete(s.id);
      }
    },
    [seciliId, show]
  );

  const q = ara.trim().toLowerCase();
  const suz = (d: SiparisDurum) =>
    (liste ?? []).filter((s) => s.durum === d && (!q || `${s.ad} ${s.sicil}`.toLowerCase().includes(q)));
  const yeni = suz("yeni");
  const hazirlaniyor = suz("hazirlaniyor");
  const hazirlar = suz("hazir");

  const ozet = useMemo(() => {
    const v = liste ?? [];
    return {
      toplam: v.length,
      teslim: v.filter((s) => s.durum === "alindi").length,
      gelinmedi: v.filter((s) => s.durum === "alinmadi").length,
    };
  }, [liste]);

  /** Hazırlanacaklar — ürün bazında toplam (tezgâhta iş böyle yapılır). */
  const yapilacak = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of [...yeni, ...hazirlaniyor]) for (const x of s.satirlar) m.set(x.ad, (m.get(x.ad) ?? 0) + x.adet);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [yeni, hazirlaniyor]);

  const kapi = kapiDurumu({ hazir, user, rolHazir, yetkili: rol !== "personel", seciliId, kantinGerekli: true });
  if (kapi !== "acik") return <YetkiKapisi durum={kapi} />;

  const acikMi = siparisAcikMi(seciliKantin);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {toast}
      {dialog}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">Tezgâh</h1>
          <p className="text-muted text-sm">
            {seciliKantin?.ad} · bugün {ozet.toplam} sipariş · {ozet.teslim} teslim
            {ozet.gelinmedi > 0 && <span className="text-brand"> · {ozet.gelinmedi} gelinmedi</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              const v = !ses;
              setSes(v);
              sesRef.current = v;
              try {
                localStorage.setItem(SES_ANAHTAR, v ? "1" : "0");
              } catch {}
            }}
            className="btn-ghost !py-2 !px-3 text-xs"
            aria-pressed={ses}
          >
            <Icon name={ses ? "megaphone" : "close"} size={13} /> {ses ? "Ses açık" : "Ses kapalı"}
          </button>
          {seciliKantin && (
            <button
              onClick={() =>
                void kantinGuncelle(seciliId, { acik: !seciliKantin.acik })
                  .then(() => show(seciliKantin.acik ? "Sipariş alımı kapatıldı" : "Sipariş alımı açıldı"))
                  .catch((e) => show(kantinHata(e), "error"))
              }
              className={`!py-2 !px-4 text-sm rounded-full font-semibold ${
                seciliKantin.acik ? "btn-ghost !border-brand !text-brand" : "btn-primary"
              }`}
            >
              {seciliKantin.acik ? "Siparişleri kapat" : "Siparişleri aç"}
            </button>
          )}
        </div>
      </div>

      {!acikMi && (
        <p className="rounded-2xl bg-brand-soft border border-brand/30 text-brand text-sm px-4 py-3 mt-4">
          Sipariş alımı <b>kapalı</b> — yeni sipariş düşmez. Elindekileri bitirip tekrar açabilirsin.
        </p>
      )}

      {/* Hazırlanacaklar — ürün bazında */}
      {yapilacak.length > 0 && (
        <div className="card p-4 mt-4">
          <p className="eyebrow mb-2">Hazırlanacaklar</p>
          <div className="flex gap-2 flex-wrap">
            {yapilacak.map(([ad, adet]) => (
              <span key={ad} className="rounded-full bg-accent-soft text-accent font-semibold text-sm px-3 py-1.5">
                {adet}× {ad}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stok şeridi — yoğunlukta Ayarlar'a gitmeden ürün kapat/aç */}
      <div className="card p-4 mt-3">
        <button onClick={() => setStokAcik((a) => !a)} className="flex items-center justify-between w-full gap-3">
          <span className="eyebrow">Bugün menüde</span>
          <span className={`text-muted transition-transform ${stokAcik ? "rotate-180" : ""}`}>
            <Icon name="down" size={14} />
          </span>
        </button>
        {stokAcik && (
          <div className="flex gap-2 flex-wrap mt-3">
            {menu.filter((u) => u.aktif).length === 0 && <p className="text-muted text-sm">Menü boş.</p>}
            {menu
              .filter((u) => u.aktif)
              .map((u) => {
                const bitti = bugunTukendi(u);
                const satildi = satilanAdet(liste ?? [], u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() =>
                      void urunTukendi(seciliId, u.id, !bitti)
                        .then(() => show(bitti ? `${u.ad} tekrar açıldı` : `${u.ad} bugünlük kapandı`))
                        .catch((e) => show(kantinHata(e), "error"))
                    }
                    className={`rounded-full px-3 py-2 text-sm border transform-gpu active:scale-95 transition-transform ${
                      bitti ? "bg-brand-soft border-brand/30 text-brand line-through" : "border-line"
                    }`}
                  >
                    {u.ad}
                    <span className="text-muted text-xs"> · {satildi}</span>
                  </button>
                );
              })}
            <p className="text-muted text-xs w-full mt-1">
              Dokunduğun ürün bugünlük kapanır; yarın kendiliğinden geri gelir. Yanındaki sayı bugün satılan adet.
            </p>
          </div>
        )}
      </div>

      {(liste?.length ?? 0) > 6 && (
        <input
          value={ara}
          onChange={(e) => setAra(e.target.value)}
          placeholder="Ad ya da sicil ara"
          className="input-base !py-2.5 text-sm mt-3"
        />
      )}

      {liste === null ? (
        <div className="flex flex-col gap-3 mt-6">
          <SkelBox className="h-24" />
          <SkelBox className="h-24" />
        </div>
      ) : (
        <div className="grid md:grid-cols-3 md:gap-4 md:items-start">
          <Kolon
            baslik="Yeni"
            vurgu
            liste={yeni}
            bos="Yeni sipariş yok."
            simdi={simdi}
            toplu={
              yeni.length > 1
                ? {
                    etiket: `Hepsini al (${yeni.length})`,
                    calistir: () =>
                      confirm(
                        {
                          title: "Hepsini hazırlamaya al",
                          message: `${yeni.length} sipariş "hazırlanıyor" durumuna geçecek.`,
                          confirmLabel: "Al",
                        },
                        () => {
                          void Promise.all(yeni.map((s) => durum(s, "hazirlaniyor", false))).then(() =>
                            show(`${yeni.length} sipariş hazırlanıyor`)
                          );
                        }
                      ),
                  }
                : undefined
            }
            eylemler={(s) => [
              { etiket: "Hazırlamaya başla", uygula: () => void durum(s, "hazirlaniyor"), birincil: true },
              { etiket: "İptal", uygula: () => void durum(s, "iptal") },
            ]}
          />
          <Kolon
            baslik="Hazırlanıyor"
            liste={hazirlaniyor}
            bos="Hazırlanan yok."
            simdi={simdi}
            eylemler={(s) => [{ etiket: "Hazır", uygula: () => void durum(s, "hazir"), birincil: true }]}
          />
          <Kolon
            baslik="Teslim bekliyor"
            liste={hazirlar}
            bos="Teslim bekleyen yok."
            simdi={simdi}
            eylemler={(s) => [
              { etiket: "Teslim edildi", uygula: () => void durum(s, "alindi"), birincil: true },
              {
                etiket: "Gelinmedi",
                // Bu düğme yasak raporunu besliyor — yanlışlıkla basılmasın.
                uygula: () =>
                  confirm(
                    {
                      title: "Gelinmedi olarak işaretle",
                      message: `${s.ad} siparişini almadı olarak kaydedilecek. Bu kayıt rapora ve yaptırıma girer.`,
                      confirmLabel: "İşaretle",
                      danger: true,
                    },
                    () => void durum(s, "alinmadi")
                  ),
              },
            ]}
          />
        </div>
      )}

      {/* Geri al — yanlış dokunuşun 20 saniyelik telafisi */}
      {geriAl && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="bg-ink text-white rounded-full pl-4 pr-2 py-2 flex items-center gap-3 shadow-lg">
            <span className="text-sm">
              {geriAl.s.ad} · {geriAl.s.durum === "alindi" ? "teslim edildi" : "güncellendi"}
            </span>
            <button
              onClick={() => {
                const g = geriAl;
                setGeriAl(null);
                void durum({ ...g.s }, g.onceki, false).then(() => show("Geri alındı"));
              }}
              className="rounded-full bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm font-semibold"
            >
              Geri al
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Kolon({
  baslik,
  liste,
  bos,
  eylemler,
  simdi,
  vurgu,
  toplu,
}: {
  baslik: string;
  liste: Siparis[];
  bos: string;
  eylemler: (s: Siparis) => { etiket: string; uygula: () => void; birincil?: boolean }[];
  simdi: number;
  vurgu?: boolean;
  toplu?: { etiket: string; calistir: () => void };
}) {
  return (
    <section className="mt-6 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <p className="eyebrow">
          {baslik} {liste.length > 0 && <span className={vurgu ? "text-accent" : ""}>· {liste.length}</span>}
        </p>
        {toplu && (
          <button onClick={toplu.calistir} className="btn-ghost !py-1.5 !px-3 text-xs">
            {toplu.etiket}
          </button>
        )}
      </div>
      {liste.length === 0 ? (
        <p className="text-muted text-sm">{bos}</p>
      ) : (
        <div className="flex flex-col gap-2 md:max-h-[calc(100vh-14rem)] md:overflow-y-auto md:pr-1">
          {liste.map((s) => (
            <Kart key={s.id} siparis={s} simdi={simdi} eylemler={eylemler(s)} />
          ))}
        </div>
      )}
    </section>
  );
}

function Kart({
  siparis,
  simdi,
  eylemler,
}: {
  siparis: Siparis;
  simdi: number;
  eylemler: { etiket: string; uygula: () => void; birincil?: boolean }[];
}) {
  const bas = siparis.createdAt?.toMillis?.() ?? simdi;
  const dk = Math.max(0, Math.floor((simdi - bas) / 60000));
  const gecikme = dk >= 10 ? "gul" : dk >= 6 ? "amber" : "";

  return (
    <div
      className={`card p-4 ${
        gecikme === "gul" ? "!border-brand/40 bg-brand-soft/40" : gecikme === "amber" ? "!border-[#eda100]/40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            {siparis.ad} <span className="text-muted font-normal text-sm">· {siparis.sicil}</span>
          </p>
          <p className="text-sm mt-0.5">{siparis.satirlar.map((x) => `${x.adet}× ${x.ad}`).join(", ")}</p>
          {siparis.not && (
            <p className="text-[#8a6100] text-xs mt-1 font-semibold flex items-center gap-1">
              <Icon name="warning" size={12} /> {siparis.not}
            </p>
          )}
        </div>
        <span
          className={`text-xs shrink-0 tabular-nums font-semibold rounded-full px-2 py-1 ${
            gecikme === "gul"
              ? "bg-brand text-white"
              : gecikme === "amber"
                ? "bg-[#eda100]/20 text-[#8a6100]"
                : "bg-paper text-muted"
          }`}
        >
          {dk} dk
        </span>
      </div>
      <div className="flex gap-2 mt-3 flex-wrap">
        {eylemler.map((e) => (
          <button
            key={e.etiket}
            onClick={e.uygula}
            className={`${e.birincil ? "btn-primary" : "btn-ghost"} !py-2.5 !px-4 text-sm transform-gpu active:scale-95 transition-transform`}
          >
            {e.etiket}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bekle() {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <SkelBox className="h-8 w-32 mb-4" />
      <SkelBox className="h-24 mb-3" />
      <SkelBox className="h-24" />
    </main>
  );
}
