"use client";

/**
 * PROVA — duvara örnek 10 foto + 10 video ekler (yönetici aracı).
 *
 * ÖNEMLİ (bu sayfanın 20/20 "Missing or insufficient permissions" ile
 * patlamasının sebebiydi): kurallar medya `url`'inin GERÇEK Cloudinary adresi
 * olmasını şart koşar (`res.cloudinary.com/...`). Sayfa eskiden picsum/Google
 * örnek linkleri yazıyordu; bu yüzden her yazım sunucuda reddediliyordu — hem de
 * duvar sahibi olarak bile, çünkü şekil kontrolü sahibe de uygulanır.
 *
 * Çözüm dışarıdan link bulmak DEĞİL: örnek medya cihazda üretilir (canvas +
 * MediaRecorder) ve misafirin geçtiği GERÇEK yoldan yüklenir (uploadToCloudinary
 * → aynı klasör). Böylece prova gerçek yolu dener: yükleme, dönüşümler,
 * küçük resim, süre limiti, moderasyon ve silmede klasör temizliği.
 */
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useWall } from "@/lib/hooks";
import { addWallMedia, resolveCode } from "@/lib/walls";
import { isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";
import { useAdminGate } from "@/lib/useAdminGate";

const NAMES = ["Ada K.", "Deniz Y.", "Ege A.", "Mira T.", "Kaan B.", "Elif S.", "Arda D.", "Nil M.", "Poyraz Ç.", "Zeynep Ö.", "Bora K.", "Ceren Y.", "Umut A.", "İpek T.", "Efe B.", "Su S.", "Doruk D.", "Aylin M.", "Kuzey Ç.", "Lina Ö."];

// Perdede çeşitlilik görünsün diye farklı en/boy ve renkler.
const OLCU: [number, number][] = [
  [1200, 1600], [1600, 1100], [1400, 1400], [1080, 1350], [1600, 900],
  [1200, 1500], [1500, 1000], [1080, 1440], [1600, 1200], [1300, 1600],
];
const PALET: [string, string][] = [
  ["#4f46e5", "#001e64"], ["#e11d48", "#4a0d21"], ["#0f7a55", "#022c22"],
  ["#eda100", "#4a2d00"], ["#0ea5e9", "#082f49"], ["#7c3aed", "#2e1065"],
  ["#f97316", "#431407"], ["#14b8a6", "#042f2e"], ["#db2777", "#500724"],
  ["#001e64", "#4f46e5"],
];

interface Uretilen {
  type: "image" | "video";
  file: File;
  w?: number;
  h?: number;
}

/** Tek kare: yumuşak degrade + halkalar + büyük numara ("prova" olduğu belli). */
function kareCiz(ctx: CanvasRenderingContext2D, w: number, h: number, i: number, t: number) {
  const [a, b] = PALET[i % PALET.length];
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(4, w * 0.012);
  for (let k = 0; k < 5; k++) {
    const r = (0.16 + k * 0.13) * Math.min(w, h) * (1 + 0.06 * Math.sin(t * 1.6 + k));
    ctx.beginPath();
    ctx.arc(w * (0.5 + 0.12 * Math.sin(t + k)), h * (0.5 + 0.1 * Math.cos(t * 0.8 + k)), r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(Math.min(w, h) * 0.34)}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.fillText(String(i + 1), w / 2, h / 2);
  ctx.font = `600 ${Math.round(Math.min(w, h) * 0.055)}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.globalAlpha = 0.75;
  ctx.fillText("PROVA · örnek medya", w / 2, h * 0.5 + Math.min(w, h) * 0.24);
  ctx.globalAlpha = 1;
}

async function fotoUret(i: number): Promise<Uretilen> {
  const [w, h] = OLCU[i % OLCU.length];
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Tuval açılamadı.");
  kareCiz(ctx, w, h, i, 0.6);
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("Görsel üretilemedi.");
  return { type: "image", file: new File([blob], `prova-${i + 1}.jpg`, { type: "image/jpeg" }), w, h };
}

function videoMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

/**
 * Kısa videoları PARTİ HÂLİNDE kaydeder: bir partideki hepsini tek rAF döngüsü
 * çizer. Tek tek kaydetmek yarım dakika sürüyordu; onunu birden kaydetmek ise
 * telefonda 10 kodlayıcı + 10 tuval demek (bu üründe Android'de RAM ölümü daha
 * önce kare kaybettirmişti). Dörderli parti ikisinin ortası.
 */
async function videoPartisi(adet: number, ilkIndex: number, sure: number): Promise<Uretilen[]> {
  const mime = videoMime();
  if (!mime) return [];
  const uzanti = mime.startsWith("video/mp4") ? "mp4" : "webm";
  const kanallar = Array.from({ length: adet }, (_, k) => {
    const i = ilkIndex + k;
    const dikey = i % 3 === 2;
    const w = dikey ? 480 : 854;
    const h = dikey ? 854 : 480;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    const stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 800_000 });
    const parcalar: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) parcalar.push(e.data);
    };
    return { i, w, h, ctx, rec, parcalar, stream };
  });

  kanallar.forEach((k) => k.rec.start());
  const bas = performance.now();
  await new Promise<void>((bitti) => {
    const adim = () => {
      const t = (performance.now() - bas) / 1000;
      for (const k of kanallar) kareCiz(k.ctx, k.w, k.h, k.i, t);
      if (performance.now() - bas >= sure) bitti();
      else requestAnimationFrame(adim);
    };
    requestAnimationFrame(adim);
  });

  return Promise.all(
    kanallar.map(
      (k) =>
        new Promise<Uretilen>((cozum) => {
          k.rec.onstop = () => {
            k.stream.getTracks().forEach((t) => t.stop());
            const blob = new Blob(k.parcalar, { type: mime.split(";")[0] });
            cozum({
              type: "video",
              file: new File([blob], `prova-${k.i + 1}.${uzanti}`, { type: mime.split(";")[0] }),
              w: k.w,
              h: k.h,
            });
          };
          k.rec.stop();
        })
    )
  );
}

/** N kısa video — 4'erli partiler hâlinde (bellek dostu). */
async function videoUret(adet: number, parti = 4, sure = 2500): Promise<Uretilen[]> {
  if (!videoMime()) return [];
  const hepsi: Uretilen[] = [];
  for (let i = 0; i < adet; i += parti) {
    hepsi.push(...(await videoPartisi(Math.min(parti, adet - i), i, sure)));
  }
  return hepsi;
}

export default function SeedWallPage() {
  const { code } = useParams<{ code: string }>();
  const authed = useAdminGate();

  const [wallId, setWallId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (/^\d{6}$/.test(code)) {
      resolveCode(code).then((t) => setWallId(t?.kind === "wall" ? t.id : null)).catch(() => setWallId(null));
    } else {
      setWallId(code);
    }
  }, [code]);

  const { wall } = useWall(wallId ?? null);
  const [busy, setBusy] = useState(false);
  const [asama, setAsama] = useState("");
  const [done, setDone] = useState(0);
  const [toplam, setToplam] = useState(20);
  const [log, setLog] = useState<string>("");

  const yaz = (s: string) => setLog((l) => (l ? l + "\n" + s : s));

  async function seed() {
    if (!wallId || !wall || busy) return;
    if (!isCloudinaryConfigured()) {
      setLog("Cloudinary yapılandırılmamış — örnek medya yüklenemez.");
      return;
    }
    setBusy(true);
    setDone(0);
    setLog("");

    let uretilen: Uretilen[] = [];
    try {
      setAsama("Örnek fotoğraflar üretiliyor…");
      const fotolar = await Promise.all(Array.from({ length: 10 }, (_, i) => fotoUret(i)));
      setAsama("Örnek videolar kaydediliyor…");
      const videolar = wall.allowVideo === false ? [] : await videoUret(10);
      if (wall.allowVideo === false) yaz("Duvarda video kapalı — yalnız fotoğraf eklenecek.");
      else if (videolar.length === 0) yaz("Bu tarayıcı video kaydını desteklemiyor — yalnız fotoğraf eklenecek.");
      // foto/video karışık sırayla: perdede çeşitli görünsün
      for (let i = 0; i < 10; i++) {
        uretilen.push(fotolar[i]);
        if (videolar[i]) uretilen.push(videolar[i]);
      }
    } catch (e) {
      yaz(`Örnek medya üretilemedi: ${e instanceof Error ? e.message : String(e)}`);
      uretilen = [];
    }

    setToplam(uretilen.length);
    let n = 0;
    for (let i = 0; i < uretilen.length; i++) {
      const it = uretilen[i];
      setAsama(`${it.type === "video" ? "Video" : "Fotoğraf"} yükleniyor… (${i + 1}/${uretilen.length})`);
      try {
        // MİSAFİRLE AYNI YOL + AYNI KLASÖR: duvar silinince ön ek temizliği bunu da alır.
        const res = await uploadToCloudinary(
          it.file,
          `walls/${wallId}/${wall.sessionId ?? "s"}`,
          () => {},
          { keepOriginal: !!wall.keepOriginal }
        );
        await addWallMedia(
          wallId,
          {
            voterId: `prova-${i}-${Math.random().toString(36).slice(2, 8)}`,
            nickname: NAMES[i % NAMES.length],
            type: res.type,
            cloudinaryId: res.cloudinaryId,
            url: res.url,
            w: res.w ?? it.w,
            h: res.h ?? it.h,
            durationMs: res.durationMs,
          },
          !!wall.moderation,
          wall.sessionId
        );
        n++;
        setDone(n);
      } catch (e) {
        yaz(`#${i + 1} hata: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setAsama("");
    setBusy(false);
    yaz(
      `✓ Bitti: ${n}/${uretilen.length} medya eklendi.` +
        (wall.moderation ? " (Moderasyon AÇIK — perdede görünmesi için Yönet'ten onayla.)" : "")
    );
  }

  if (authed === null) return <main className="min-h-screen grid place-items-center bg-[#05091c] text-white/60">Yükleniyor…</main>;
  if (!authed) return <main className="min-h-screen grid place-items-center bg-[#05091c] text-white/60 px-6 text-center">Bu sayfa sadece yöneticilere açık.</main>;

  const yuzde = toplam ? (done / toplam) * 100 : 0;

  return (
    <main className="min-h-screen bg-[#05091c] text-white grid place-items-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-white/5 border border-white/12 p-7">
        <p className="uppercase tracking-widest text-xs text-white/50 mb-1">FlowWall · prova</p>
        <h1 className="text-2xl font-bold mb-2">Örnek medya ekle</h1>
        {wallId === undefined ? (
          <p className="text-white/60">Çözülüyor…</p>
        ) : wallId === null ? (
          <p className="text-[#ff9db3]">Kod/duvar bulunamadı: {code}</p>
        ) : (
          <>
            <p className="text-white/70 text-sm mb-1">
              Duvar: <b>{wall?.title ?? wallId}</b> · kod {wall?.joinCode ?? code}
              {wall?.moderation && <span className="text-[#ffdd99]"> · 🛡 moderasyon açık</span>}
            </p>
            <p className="text-white/50 text-sm mb-5">
              Örnek medya cihazında üretilir ve <b>misafirle aynı yoldan</b> yüklenir — yükleme, küçük resim
              ve silme temizliği dahil gerçek akış denenir.
            </p>
            <button
              onClick={seed}
              disabled={busy || !wall}
              className="w-full py-3.5 rounded-2xl bg-white text-[#05091c] font-semibold disabled:opacity-40"
            >
              {busy ? asama || `Ekleniyor… ${done}/${toplam}` : "＋ 10 foto + 10 video ekle"}
            </button>
            {done > 0 && (
              <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-white transition-[width]" style={{ width: `${yuzde}%` }} />
              </div>
            )}
            {log && <pre className="mt-4 text-xs text-white/60 whitespace-pre-wrap">{log.trim()}</pre>}
            {wallId && (
              <a href={`/wall/${wallId}`} target="_blank" className="block text-center mt-5 text-sm text-white/60 hover:text-white">
                Perde ekranını aç ↗
              </a>
            )}
          </>
        )}
      </div>
    </main>
  );
}
