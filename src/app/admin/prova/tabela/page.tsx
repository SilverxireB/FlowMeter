"use client";

/**
 * PROVA — FlowSign (/admin → "Prova & sağlık" → Tabela provası).
 *
 * Sign'da izleyici yazımı yoktur; riskli olan YERLEŞİM ve OYNATMA'dır. Bu yüzden
 * prova, bir ekranı doldurmak yerine KENDİ prova ekranını açar: 2×2 yerleşim,
 * dört farklı öğe türü (görsel/metin/saat/URL) ve biri BİLEREK takvim dışı bir
 * öğe. Sonra yayınlar. Perdeyi açınca beklenen: dört alan da oynar, takvim dışı
 * öğe HİÇ görünmez.
 *
 * Var olan ekranlara dokunulmaz — gerçek bir tabelanın taslağını ezmek, sahadaki
 * 7/24 bir ekranı bozmak demekti.
 *
 * Görseller cihazda üretilip Sign'ın gerçek içerik yoluna yüklenir
 * (flowsign/{id} klasörü) — ekranı silince sunucu tarafı temizlik onları da alır.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuthUser } from "@/lib/hooks";
import { useAdminGate } from "@/lib/useAdminGate";
import { usePlayTarget } from "@/lib/usePlayTarget";
import { isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";
import {
  createVideowall,
  deleteVideowall,
  gridZones,
  listVideowalls,
  publishVideowall,
  updateVideowall,
  ZONE_BG_DEFAULT,
} from "@/lib/videowalls";
import { Videowall, Zone, ZoneItem } from "@/lib/types";
import { useConfirm } from "@/components/ConfirmDialog";

const PROVA_ADI = "Prova ekranı";
const PALET: [string, string][] = [
  ["#4f46e5", "#001e64"],
  ["#0f7a55", "#022c22"],
  ["#e11d48", "#4a0d21"],
];

const yid = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Alan boyunda tek kare üretir (degrade + numara) — Sign içeriği hep STRETCH edilir. */
async function gorselUret(i: number, w: number, h: number): Promise<File> {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Tuval açılamadı.");
  const [a, b] = PALET[i % PALET.length];
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(Math.min(w, h) * 0.4)}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillText(String(i + 1), w / 2, h / 2);
  ctx.font = `600 ${Math.round(Math.min(w, h) * 0.075)}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.globalAlpha = 0.8;
  ctx.fillText("PROVA · görsel", w / 2, h * 0.5 + Math.min(w, h) * 0.28);
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("Görsel üretilemedi.");
  return new File([blob], `prova-${i + 1}.jpg`, { type: "image/jpeg" });
}

export default function TabelaProvaPage() {
  const authed = useAdminGate();
  const { user } = useAuthUser();
  const hedef = usePlayTarget();
  const { confirm, dialog } = useConfirm();

  const [ekranlar, setEkranlar] = useState<Videowall[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [asama, setAsama] = useState("");
  const [log, setLog] = useState<string>("");
  const yaz = (s: string) => setLog((l) => (l ? l + "\n" + s : s));

  const yenile = useCallback(async () => {
    if (!user) return;
    try {
      const hepsi = await listVideowalls(user.uid);
      setEkranlar(hepsi.filter((v) => v.name.startsWith(PROVA_ADI)));
    } catch {
      setEkranlar([]);
    }
  }, [user]);

  useEffect(() => {
    if (authed && user) void yenile();
  }, [authed, user, yenile]);

  const olustur = useCallback(async () => {
    if (!user || busy) return;
    if (!isCloudinaryConfigured()) {
      setLog("Cloudinary yapılandırılmamış — prova görselleri yüklenemez.");
      return;
    }
    setBusy(true);
    setLog("");
    try {
      const d = new Date();
      const ad = `${PROVA_ADI} · ${iso(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      setAsama("Ekran açılıyor…");
      // Fiziksel 1 ekran, YERLEŞİM 2×2 (ikisi farklı şeydir: fiziksel = çerçeve).
      const id = await createVideowall(user.uid, ad, 1920, 1080, 1, 1, user.displayName ?? "");

      setAsama("Görseller üretiliyor…");
      const zones: Zone[] = gridZones(2, 2).map((z) => ({ ...z, bg: ZONE_BG_DEFAULT }));
      const gorseller: ZoneItem[] = [];
      for (let i = 0; i < 3; i++) {
        setAsama(`Görsel yükleniyor… (${i + 1}/3)`);
        const file = await gorselUret(i, 960, 540);
        const res = await uploadToCloudinary(file, `flowsign/${id}`, () => {}, { keepOriginal: true });
        gorseller.push({ id: yid(), kind: "image", src: res.url, name: `Prova görsel ${i + 1}`, durationSec: 6 });
      }

      const dun = new Date();
      dun.setDate(dun.getDate() - 1);
      const gecenAy = new Date();
      gecenAy.setDate(gecenAy.getDate() - 30);

      zones[0] = { ...zones[0], name: "Görseller", transition: "fade", items: gorseller };
      zones[1] = {
        ...zones[1],
        name: "Metin",
        transition: "slide",
        items: [
          {
            id: yid(),
            kind: "text",
            title: "Prova ekranı",
            text: "Bu ekran otomatik üretildi. Dört alan da dönüyorsa yerleşim ve oynatma sağlam.",
            durationSec: 8,
            bg: "#001e64",
            color: "#ffffff",
          },
          {
            id: yid(),
            kind: "text",
            title: "Takvim: bugün AÇIK",
            text: "Bu öğenin tarih aralığı bugünü kapsar — görünmesi beklenir.",
            durationSec: 6,
            fromDate: iso(gecenAy),
            toDate: iso(new Date(Date.now() + 30 * 86400000)),
            bg: "#0f7a55",
            color: "#ffffff",
          },
          {
            id: yid(),
            kind: "text",
            title: "Takvim: KAPALI olmalı",
            text: "Bu öğenin aralığı dün bitti. Perdede GÖRÜNÜRSE takvim kapısı bozuk demektir.",
            durationSec: 6,
            fromDate: iso(gecenAy),
            toDate: iso(dun),
            bg: "#e11d48",
            color: "#ffffff",
          },
        ],
      };
      zones[2] = {
        ...zones[2],
        name: "Saat",
        items: [{ id: yid(), kind: "clock", durationSec: 10, bg: "#001e64", color: "#ffffff" }],
      };
      zones[3] = {
        ...zones[3],
        name: "URL",
        items: [
          {
            id: yid(),
            kind: "url",
            src: `${window.location.origin}/`,
            name: "Flow Studio karşılama",
            durationSec: 12,
            zoom: 50,
          },
        ],
      };

      setAsama("Yerleşim kaydediliyor…");
      await updateVideowall(id, { layoutCols: 2, layoutRows: 2, zones });
      setAsama("Yayınlanıyor…");
      await publishVideowall({ id, zones, cols: 1, rows: 1, width: 1920, height: 1080 } as Videowall);
      yaz(`✓ "${ad}" hazır ve yayınlandı.`);
      await yenile();
    } catch (e) {
      yaz(`Hata: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAsama("");
      setBusy(false);
    }
  }, [user, busy, yenile]);

  const sil = useCallback(
    (v: Videowall) => {
      confirm(
        {
          title: "Prova ekranı silinsin mi?",
          message: `"${v.name}" ve yüklenen prova görselleri silinir.`,
          confirmLabel: "Sil",
          danger: true,
        },
        async () => {
          setBusy(true);
          try {
            const idToken = await user?.getIdToken().catch(() => undefined);
            await deleteVideowall(v, idToken ?? undefined);
            yaz(`✓ "${v.name}" silindi.`);
            await yenile();
          } catch (e) {
            yaz(`Silinemedi: ${e instanceof Error ? e.message : String(e)}`);
          } finally {
            setBusy(false);
          }
        }
      );
    },
    [confirm, user, yenile]
  );

  if (authed === null) return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;
  if (!authed) {
    return (
      <main className="min-h-screen grid place-items-center bg-wash text-center px-6">
        <div>
          <p className="text-xl font-bold mb-1">Yetki yok</p>
          <p className="text-muted">Bu sayfa sadece yöneticilere açık.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-wash p-4 sm:p-8">
      {dialog}
      <div className="max-w-2xl mx-auto flex flex-col gap-5">
        <div>
          <Link href="/admin/prova" className="text-muted hover:text-ink text-sm">← Prova &amp; sağlık</Link>
          <p className="eyebrow text-accent mt-1">FlowSign provası</p>
          <h1 className="font-display text-2xl font-semibold">Prova ekranı</h1>
          <p className="text-muted text-sm">
            Kendi prova ekranını açar; var olan videowall'lara dokunmaz.
          </p>
        </div>

        <div className="card p-5">
          <p className="text-muted text-sm mb-4">
            2×2 yerleşim; sırasıyla <b>görsel</b>, <b>metin</b>, <b>saat</b> ve <b>URL</b> alanı. Metin alanındaki
            kırmızı öğenin tarihi dün bitti: perdede <b>görünmemeli</b> — görünüyorsa takvim kapısı bozuk.
          </p>
          <button onClick={() => void olustur()} disabled={busy} className="btn-primary !py-2.5 !px-5 text-sm">
            {busy ? asama || "Hazırlanıyor…" : "Prova ekranı oluştur ve yayınla"}
          </button>
          {log && <pre className="mt-4 text-xs text-muted whitespace-pre-wrap">{log.trim()}</pre>}
        </div>

        <div className="card p-5">
          <p className="eyebrow mb-3">Prova ekranları</p>
          {ekranlar === null ? (
            <p className="text-muted text-sm">Yükleniyor…</p>
          ) : ekranlar.length === 0 ? (
            <p className="text-muted text-sm">Henüz prova ekranı yok.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {ekranlar.map((v) => (
                <div key={v.id} className="rounded-2xl border border-line px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{v.name}</p>
                    <p className="text-muted text-xs">/flowsign/{v.slug ?? v.id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/flowsign/${v.slug ?? v.id}`} target={hedef} className="btn-ghost !py-1.5 !px-3 text-xs">
                      Perde
                    </Link>
                    <Link href={`/videowall/${v.id}/edit`} className="btn-ghost !py-1.5 !px-3 text-xs">
                      Editör
                    </Link>
                    <button onClick={() => sil(v)} disabled={busy} className="btn-ghost !py-1.5 !px-3 text-xs !text-brand !border-brand/40">
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
