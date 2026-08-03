"use client";

/**
 * RAPOR — "dün ne oldu, kim gelmedi, ne tükeniyor?"
 *
 * İLKE: yaptırımdan önce ÖLÇÜM. Yasak düğmesi Kişiler'de duruyor ama buradaki
 * sayılar görülmeden kullanılmamalı — "gelinmedi" belki sandığından azdır, belki
 * hep aynı saatte oluyordur (mola bitiyor, kişi yetişemiyor). Rapor onu söyler.
 *
 * Okuma bir KERE yapılır (canlı dinleme yok): 30 günü canlı dinlemek boşuna kota.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { gunKey, kantinHata, siparisAraligi, yasakla } from "@/lib/kantin/api";
import { useKantin } from "@/lib/kantin/oturum";
import { YetkiKapisi, kapiDurumu } from "@/components/kantin/YetkiKapisi";
import { Siparis } from "@/lib/kantin/types";
import { Icon } from "@/components/Icon";
import { SkelBox } from "@/components/Skeleton";
import BosDurum from "@/components/kantin/BosDurum";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const ARALIKLAR = [
  { id: "bugun", etiket: "Bugün", gun: 1 },
  { id: "hafta", etiket: "7 gün", gun: 7 },
  { id: "ay", etiket: "30 gün", gun: 30 },
] as const;

function gunOnce(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return gunKey(d);
}

export default function KantinRaporPage() {
  const { user, rol, rolHazir, hazir, seciliId, seciliKantin } = useKantin();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { show, toast } = useToast();
  const [aralik, setAralik] = useState<(typeof ARALIKLAR)[number]["id"]>("bugun");
  const [veri, setVeri] = useState<Siparis[] | null>(null);
  // Okuma REDDEDİLDİĞİNDE boş listeye düşmek ekrana "bu aralıkta sipariş yok"
  // dedirtiyordu — yani yanlış kantine bakan görevliye "hiç sipariş gelmemiş"
  // diye yalan söylüyordu. Hata ayrı bir durum.
  const [hataVar, setHataVar] = useState(false);

  useEffect(() => {
    if (hazir && !user) router.replace("/kantin/giris");
  }, [hazir, user, router]);

  const yukle = useCallback(async () => {
    // Rol kapısının ARKASINDA: personel bu sayfaya URL ile girince hem
    // "yetkin yok" hem de reddedilen okumadan gelen kırmızı bildirim çıkıyordu
    // — iki farklı hikâye, ikisi de yarım.
    if (!seciliId || rol === "personel") return;
    setVeri(null);
    setHataVar(false);
    const g = ARALIKLAR.find((a) => a.id === aralik)!.gun;
    try {
      setVeri(await siparisAraligi(seciliId, gunOnce(g - 1), gunKey()));
    } catch (e) {
      show(kantinHata(e), "error");
      setHataVar(true);
      setVeri([]);
    }
  }, [seciliId, aralik, rol, show]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const ozet = useMemo(() => {
    const v = veri ?? [];
    const say = (d: string) => v.filter((s) => s.durum === d).length;
    return {
      toplam: v.length,
      teslim: say("alindi"),
      gelinmedi: say("alinmadi"),
      iptal: say("iptal") ,
      acik: v.filter((s) => ["yeni", "hazirlaniyor", "hazir"].includes(s.durum)).length,
    };
  }, [veri]);

  const urunler = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of veri ?? []) {
      if (s.durum === "iptal") continue;
      for (const x of s.satirlar) m.set(x.ad, (m.get(x.ad) ?? 0) + x.adet);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [veri]);

  const saatler = useMemo(() => {
    const a = Array.from({ length: 24 }, () => 0);
    for (const s of veri ?? []) {
      const t = s.createdAt?.toMillis?.();
      if (t) a[new Date(t).getHours()]++;
    }
    return a;
  }, [veri]);

  const gelmeyenler = useMemo(() => {
    const m = new Map<string, { ad: string; sicil: string; uid: string; adet: number }>();
    for (const s of veri ?? []) {
      if (s.durum !== "alinmadi") continue;
      const k = m.get(s.uid) ?? { ad: s.ad, sicil: s.sicil, uid: s.uid, adet: 0 };
      k.adet++;
      m.set(s.uid, k);
    }
    return [...m.values()].sort((a, b) => b.adet - a.adet);
  }, [veri]);

  const kapi = kapiDurumu({ hazir, user, rolHazir, yetkili: rol !== "personel", seciliId, kantinGerekli: true });
  if (kapi !== "acik") return <YetkiKapisi durum={kapi} />;

  const enCok = Math.max(1, ...urunler.map((u) => u[1]));
  const enYogunSaat = Math.max(1, ...saatler);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {dialog}
      {toast}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold">Rapor</h1>
          <p className="text-muted text-sm">{seciliKantin?.ad}</p>
        </div>
        <button onClick={() => void yukle()} className="btn-ghost !py-1.5 !px-3 text-xs">
          <Icon name="refresh" size={13} /> Yenile
        </button>
      </div>

      <div className="flex gap-1.5 mt-4">
        {ARALIKLAR.map((a) => (
          <button
            key={a.id}
            onClick={() => setAralik(a.id)}
            className={`chip !py-1.5 ${aralik === a.id ? "!bg-ink !text-white !border-ink" : "text-muted"}`}
          >
            {a.etiket}
          </button>
        ))}
      </div>

      {veri === null ? (
        <div className="mt-4 flex flex-col gap-3">
          <SkelBox className="h-20" />
          <SkelBox className="h-40" />
        </div>
      ) : ozet.toplam === 0 ? (
        <div className="mt-4">
          <BosDurum ikon="chart" baslik="Bu aralıkta sipariş yok" metin="Farklı bir aralık seç ya da gün geçsin." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <Kutu etiket="sipariş" deger={ozet.toplam} vurgu />
            <Kutu etiket="teslim" deger={ozet.teslim} />
            <Kutu etiket="gelinmedi" deger={ozet.gelinmedi} tehlike={ozet.gelinmedi > 0} />
            <Kutu etiket="iptal" deger={ozet.iptal} />
          </div>

          <section className="card p-5 mt-4">
            <p className="eyebrow mb-3">Ürünler</p>
            <div className="flex flex-col gap-2">
              {urunler.map(([ad, adet]) => (
                <div key={ad} className="flex items-center gap-3">
                  <span className="text-sm min-w-0 flex-1 truncate">{ad}</span>
                  <span className="h-2 rounded-full bg-accent/70 shrink-0" style={{ width: `${(adet / enCok) * 45}%` }} />
                  <span className="text-sm font-semibold tabular-nums w-8 text-right shrink-0">{adet}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5 mt-4">
            <p className="eyebrow mb-1">Saat dağılımı</p>
            <p className="text-muted text-xs mb-3">Yoğun saatleri görürsen kapasiteyi ona göre ayarlarsın.</p>
            <div className="flex items-end gap-[3px] h-24">
              {saatler.map((v, h) => (
                <div key={h} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div
                    title={`${h}:00 — ${v} sipariş`}
                    className={`w-full rounded-t ${v ? "bg-accent" : "bg-ink/8"}`}
                    style={{ height: `${Math.max(v ? 6 : 2, (v / enYogunSaat) * 100)}%` }}
                  />
                  {h % 3 === 0 && <span className="text-[9px] text-muted tabular-nums">{h}</span>}
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5 mt-4">
            <p className="eyebrow mb-1">Gelmeyenler</p>
            <p className="text-muted text-xs mb-3">
              Yaptırımdan önce sayıya bak: tek seferlik olabilir (toplantı uzamıştır).
            </p>
            {gelmeyenler.length === 0 ? (
              <p className="text-sm text-[#0f7a55] font-semibold">Herkes siparişini almış.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {gelmeyenler.map((k) => (
                  <div key={k.uid} className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm min-w-0 flex-1 truncate">
                      {k.ad} <span className="text-muted">· {k.sicil}</span>
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${k.adet > 1 ? "text-brand" : "text-muted"}`}>
                      {k.adet} kez
                    </span>
                    {rol === "admin" && (
                      <button
                        onClick={() =>
                          confirm(
                            {
                              title: "3 gün yasak",
                              message: `${k.ad} 3 gün sipariş veremeyecek.`,
                              confirmLabel: "Yasakla",
                              danger: true,
                            },
                            () =>
                              void yasakla(k.uid, 3)
                                .then(() => show("Yasak kondu"))
                                .catch((e) => show(kantinHata(e), "error"))
                          )
                        }
                        className="btn-ghost !py-1 !px-2.5 text-[11px] !text-brand !border-brand/40 shrink-0"
                      >
                        Yasakla
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Kutu({ etiket, deger, vurgu, tehlike }: { etiket: string; deger: number; vurgu?: boolean; tehlike?: boolean }) {
  return (
    <div className={`rounded-2xl py-4 text-center ${vurgu ? "bg-accent-soft" : tehlike ? "bg-brand-soft" : "bg-paper"}`}>
      <p className={`font-display text-2xl font-semibold tabular-nums ${vurgu ? "text-accent" : tehlike ? "text-brand" : ""}`}>
        {deger}
      </p>
      <p className="text-muted text-xs">{etiket}</p>
    </div>
  );
}

function Bekle() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <SkelBox className="h-8 w-32 mb-4" />
      <SkelBox className="h-24" />
    </main>
  );
}
