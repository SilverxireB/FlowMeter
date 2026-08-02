"use client";

/**
 * PROVA — duvara örnek 10 foto + 10 video ekler (yönetici aracı).
 * Eskiden gizli linkti; anahtar istemci paketindeydi, yani kapı değildi.
 * Örnek medya: picsum (foto) + Google örnek videoları — Cloudinary-dışı URL'ler,
 * transform yardımcıları bunlara dokunmaz (bkz. cloudinary.ts isCld).
 */
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useWall } from "@/lib/hooks";
import { addWallMedia, resolveCode } from "@/lib/walls";
import { useAdminGate } from "@/lib/useAdminGate";

const IMAGES = [
  { url: "https://picsum.photos/seed/ww-ani1/1200/1600", w: 1200, h: 1600 },
  { url: "https://picsum.photos/seed/ww-ani2/1600/1100", w: 1600, h: 1100 },
  { url: "https://picsum.photos/seed/ww-ani3/1400/1400", w: 1400, h: 1400 },
  { url: "https://picsum.photos/seed/ww-ani4/1080/1350", w: 1080, h: 1350 },
  { url: "https://picsum.photos/seed/ww-ani5/1600/900", w: 1600, h: 900 },
  { url: "https://picsum.photos/seed/ww-ani6/1200/1500", w: 1200, h: 1500 },
  { url: "https://picsum.photos/seed/ww-ani7/1500/1000", w: 1500, h: 1000 },
  { url: "https://picsum.photos/seed/ww-ani8/1080/1440", w: 1080, h: 1440 },
  { url: "https://picsum.photos/seed/ww-ani9/1600/1200", w: 1600, h: 1200 },
  { url: "https://picsum.photos/seed/ww-ani10/1300/1600", w: 1300, h: 1600 },
];

const VBASE = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/";
const VIDEOS = [
  "ForBiggerBlazes.mp4",
  "ForBiggerEscapes.mp4",
  "ForBiggerFun.mp4",
  "ForBiggerJoyrides.mp4",
  "ForBiggerMeltdowns.mp4",
  "WhatCarCanYouGetForAGrand.mp4",
  "VolkswagenGTIReview.mp4",
  "SubaruOutbackOnStreetAndDirt.mp4",
  "TearsOfSteel.mp4",
  "Sintel.mp4",
];

const NAMES = ["Ada K.", "Deniz Y.", "Ege A.", "Mira T.", "Kaan B.", "Elif S.", "Arda D.", "Nil M.", "Poyraz Ç.", "Zeynep Ö.", "Bora K.", "Ceren Y.", "Umut A.", "İpek T.", "Efe B.", "Su S.", "Doruk D.", "Aylin M.", "Kuzey Ç.", "Lina Ö."];

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
  const [done, setDone] = useState(0);
  const [log, setLog] = useState<string>("");

  async function seed() {
    if (!wallId || !wall || busy) return;
    setBusy(true);
    setDone(0);
    setLog("");
    let n = 0;
    // foto + video karışık sırayla ekle (perdede çeşitli görünsün)
    const items: { type: "image" | "video"; url: string; w?: number; h?: number }[] = [];
    for (let i = 0; i < 10; i++) {
      items.push({ type: "image", ...IMAGES[i] });
      items.push({ type: "video", url: VBASE + VIDEOS[i] });
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      try {
        await addWallMedia(
          wallId,
          {
            voterId: `seed-${i}-${Math.random().toString(36).slice(2, 8)}`,
            nickname: NAMES[i % NAMES.length],
            type: it.type,
            cloudinaryId: `seed/${it.type}-${i}`,
            url: it.url,
            w: it.w,
            h: it.h,
          },
          !!wall.moderation,
          wall.sessionId
        );
        n++;
        setDone(n);
      } catch (e) {
        setLog((l) => l + `\n#${i} hata: ${e instanceof Error ? e.message : String(e)}`);
      }
      await new Promise((r) => setTimeout(r, 120));
    }
    setBusy(false);
    setLog((l) => l + `\n✓ Bitti: ${n}/20 medya eklendi.` + (wall.moderation ? " (Moderasyon AÇIK — perdede görünmesi için Yönet'ten onayla.)" : ""));
  }

  if (authed === null) return <main className="min-h-screen grid place-items-center bg-[#05091c] text-white/60">Yükleniyor…</main>;
  if (!authed) return <main className="min-h-screen grid place-items-center bg-[#05091c] text-white/60 px-6 text-center">Bu sayfa sadece yöneticilere açık.</main>;

  return (
    <main className="min-h-screen bg-[#05091c] text-white grid place-items-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-white/5 border border-white/12 p-7">
        <p className="uppercase tracking-widest text-xs text-white/50 mb-1">FlowWall · test tohumu</p>
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
            <p className="text-white/50 text-sm mb-5">10 fotoğraf + 10 video (örnek) eklenir; perde ekranını test etmek için.</p>
            <button
              onClick={seed}
              disabled={busy || !wall}
              className="w-full py-3.5 rounded-2xl bg-white text-[#05091c] font-semibold disabled:opacity-40"
            >
              {busy ? `Ekleniyor… ${done}/20` : "＋ 10 foto + 10 video ekle"}
            </button>
            {done > 0 && (
              <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-white transition-[width]" style={{ width: `${(done / 20) * 100}%` }} />
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
