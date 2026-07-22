"use client";

/**
 * FlowWall yükleme — misafir telefonu. Auth yok. Birden çok foto/video seç →
 * karo önizleme → hepsini sırayla, canlı %'yle Cloudinary'ye yükle → duvara
 * (moderasyon açıksa onaya).
 */
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Logo from "@/components/Logo";
import WallReactionBar from "@/components/wall/WallReactionBar";
import { useWall, useWallMedia } from "@/lib/hooks";
import { addWallMedia, hasLikedMedia, likeMedia, resolveCode } from "@/lib/walls";
import { cloudinaryStatus, cldFit, cldVideoPoster, isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";
import { getStoredNickname, storeIdentity, getStoredAvatarSeed } from "@/lib/participants";
import { getVoterId } from "@/lib/responses";
import { WallMedia } from "@/lib/types";

interface Item {
  id: string;
  file: File;
  url: string;
  isVideo: boolean;
  status: "queued" | "uploading" | "done" | "error";
  pct: number;
}

export default function UploadPage() {
  const { id: raw } = useParams<{ id: string }>();

  const [wallId, setWallId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (/^\d{6}$/.test(raw)) {
      resolveCode(raw).then((t) => setWallId(t?.kind === "wall" ? t.id : null)).catch(() => setWallId(null));
    } else {
      setWallId(raw);
    }
  }, [raw]);

  const { wall } = useWall(wallId ?? null);

  const [tab, setTab] = useState<"upload" | "browse">("upload");

  const [nickname, setNickname] = useState("");
  useEffect(() => setNickname(getStoredNickname() ?? ""), []);

  const [items, setItems] = useState<Item[]>([]);
  const [sending, setSending] = useState(false);
  const [finished, setFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    };
  }, []);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const next = files.slice(0, 30).map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file: f,
      url: URL.createObjectURL(f),
      isVideo: f.type.startsWith("video"),
      status: "queued" as const,
      pct: 0,
    }));
    setItems((prev) => [...prev, ...next]);
    setFinished(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const it = prev.find((i) => i.id === id);
      if (it) URL.revokeObjectURL(it.url);
      return prev.filter((i) => i.id !== id);
    });
  }

  function patch(id: string, p: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
  }

  async function sendAll() {
    if (!wallId || !wall || sending) return;
    const name = nickname.trim().slice(0, 30);
    if (name) storeIdentity(name, getStoredAvatarSeed() ?? "Luna");
    setSending(true);
    for (const it of itemsRef.current) {
      if (it.status === "done") continue;
      patch(it.id, { status: "uploading", pct: 0 });
      try {
        const res = await uploadToCloudinary(
          it.file,
          `walls/${wallId}/${wall.sessionId ?? "s"}`,
          (pct) => patch(it.id, { pct })
        );
        await addWallMedia(
          wallId,
          {
            voterId: getVoterId(),
            nickname: name || undefined,
            type: res.type,
            cloudinaryId: res.cloudinaryId,
            url: res.url,
            w: res.w,
            h: res.h,
            durationMs: res.durationMs,
          },
          !!wall.moderation,
          wall.sessionId
        );
        patch(it.id, { status: "done", pct: 100 });
      } catch {
        patch(it.id, { status: "error" });
      }
    }
    setSending(false);
    if (itemsRef.current.every((i) => i.status === "done")) {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
      setItems([]);
      setFinished(true);
    }
  }

  const pendingCount = items.filter((i) => i.status !== "done").length;

  if (wallId === null) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#070c22] text-white/70 px-6 text-center">
        Duvar bulunamadı — kodu kontrol et.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070c22] text-white flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <Logo variant="wall" onDark size="sm" />
        {wall && <span className="text-white/50 text-sm truncate max-w-[45vw]">{wall.title}</span>}
      </header>

      {/* Sekme çubuğu */}
      <div className="px-5 max-w-md w-full mx-auto">
        <div className="flex gap-1 p-1 rounded-2xl bg-white/8 border border-white/10">
          <button
            onClick={() => setTab("upload")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tab === "upload" ? "bg-white text-[#070c22]" : "text-white/60"}`}
          >
            📤 Yükle
          </button>
          <button
            onClick={() => setTab("browse")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tab === "browse" ? "bg-white text-[#070c22]" : "text-white/60"}`}
          >
            🖼 Duvarı gez
          </button>
        </div>
      </div>

      {tab === "browse" ? (
        <BrowseGallery wallId={wallId ?? null} />
      ) : (
      <section className="flex-1 flex flex-col px-5 pb-24 pt-4 max-w-md w-full mx-auto">
        {!isCloudinaryConfigured() && (
          <div className="mb-5 rounded-2xl bg-[#eda100]/15 border border-[#eda100]/40 px-4 py-3 text-sm text-[#ffdd99]">
            ⚠️ Medya yükleme yapılandırılmadı. Eksik:
            <span className="block mt-1 font-mono text-xs">
              CLOUD_NAME: {cloudinaryStatus().cloud ? "✓" : "✗ EKSİK"} · UPLOAD_PRESET:{" "}
              {cloudinaryStatus().preset ? "✓" : "✗ EKSİK"}
            </span>
          </div>
        )}

        {finished ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-4" aria-hidden>{wall?.moderation ? "🛡" : "🎉"}</div>
            <h1 className="text-2xl font-bold mb-2">{wall?.moderation ? "Onaya gönderildi" : "Duvarda!"}</h1>
            <p className="text-white/65 mb-8">
              {wall?.moderation ? "Moderatör onayladığında perdede görünecek." : "Anıların birazdan perdede akmaya başlıyor."}
            </p>
            <button onClick={() => inputRef.current?.click()} className="py-3.5 px-7 rounded-2xl bg-white text-[#070c22] font-semibold">
              Daha fazla ekle
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="text-xs uppercase tracking-widest text-white/50">Adın (opsiyonel)</label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Perdede adın görünsün mü?"
                maxLength={30}
                className="mt-1 w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
              />
            </div>

            {items.length === 0 ? (
              <button
                onClick={() => inputRef.current?.click()}
                className="rounded-3xl bg-white/5 border border-white/12 flex flex-col items-center justify-center gap-3 text-white/70 py-24"
              >
                <span className="text-5xl" aria-hidden>📸</span>
                <span className="font-semibold text-lg text-white">Fotoğraf / video seç</span>
                <span className="text-sm text-white/50">Birden çok seçebilirsin</span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {items.map((it) => (
                  <div key={it.id} className="relative aspect-square rounded-xl overflow-hidden bg-white/10 border border-white/10">
                    {it.isVideo ? (
                      <video src={it.url} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    {it.isVideo && <span className="absolute bottom-1 left-1 text-xs bg-black/50 rounded-full px-1.5">▶</span>}

                    {/* Durum katmanı */}
                    {it.status === "uploading" && (
                      <div className="absolute inset-0 bg-black/55 grid place-items-center">
                        <span className="text-sm font-bold tabular-nums">{it.pct}%</span>
                      </div>
                    )}
                    {it.status === "done" && (
                      <div className="absolute inset-0 bg-[#1baf7a]/40 grid place-items-center text-2xl">✓</div>
                    )}
                    {it.status === "error" && (
                      <div className="absolute inset-0 bg-[#e34948]/50 grid place-items-center text-xl">⚠</div>
                    )}
                    {!sending && it.status !== "done" && (
                      <button
                        onClick={() => removeItem(it.id)}
                        className="absolute top-1 right-1 w-6 h-6 grid place-items-center rounded-full bg-black/60 text-white text-xs"
                        aria-label="Kaldır"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {!sending && (
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="aspect-square rounded-xl border border-dashed border-white/25 grid place-items-center text-3xl text-white/50"
                    aria-label="Daha ekle"
                  >
                    ＋
                  </button>
                )}
              </div>
            )}

            <input ref={inputRef} type="file" accept="image/*,video/*" multiple onChange={onPick} className="hidden" />

            {items.length > 0 && (
              <button
                onClick={sendAll}
                disabled={sending || pendingCount === 0 || !isCloudinaryConfigured()}
                className="mt-5 py-3.5 rounded-2xl bg-white text-[#070c22] font-semibold disabled:opacity-40"
              >
                {sending ? "Yükleniyor…" : `Gönder (${pendingCount}) →`}
              </button>
            )}
          </>
        )}
      </section>
      )}

      {typeof wallId === "string" && <WallReactionBar wallId={wallId} />}
    </main>
  );
}

/** Duvarı gez — onaylı medya akışı; ❤ beğen, "Benimkiler" filtresi. */
function BrowseGallery({ wallId }: { wallId: string | null }) {
  const allMedia = useWallMedia(wallId);
  const approved = useMemo(() => allMedia.filter((m) => m.status === "approved"), [allMedia]);
  const [mineOnly, setMineOnly] = useState(false);
  const [voterId, setVoterId] = useState("");
  useEffect(() => setVoterId(getVoterId()), []);

  const shown = useMemo(() => {
    const list = mineOnly ? approved.filter((m) => m.voterId === voterId) : approved;
    return [...list].reverse();
  }, [approved, mineOnly, voterId]);

  const mineCount = useMemo(() => approved.filter((m) => m.voterId === voterId).length, [approved, voterId]);

  return (
    <section className="flex-1 flex flex-col px-5 pb-24 pt-4 max-w-md w-full mx-auto">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/60 text-sm tabular-nums">{approved.length} anı duvarda</p>
        <button
          onClick={() => setMineOnly((v) => !v)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
            mineOnly ? "bg-white text-[#070c22] border-white" : "text-white/70 border-white/20"
          }`}
        >
          {mineOnly ? "← Tümü" : `Benimkiler (${mineCount})`}
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="flex-1 grid place-items-center text-center text-white/50 py-20">
          <div>
            <div className="text-5xl mb-3" aria-hidden>{mineOnly ? "📷" : "🖼"}</div>
            <p>{mineOnly ? "Henüz bir şey yüklemedin." : "Duvar henüz boş — ilk anıyı sen ekle!"}</p>
          </div>
        </div>
      ) : (
        <div className="columns-2 gap-2.5 [column-fill:_balance]">
          {shown.map((m) => (
            <BrowseTile key={m.id} m={m} wallId={wallId} mine={m.voterId === voterId} />
          ))}
        </div>
      )}
    </section>
  );
}

function BrowseTile({ m, wallId, mine }: { m: WallMedia; wallId: string | null; mine: boolean }) {
  const [liked, setLiked] = useState(false);
  const [bump, setBump] = useState(false);
  useEffect(() => setLiked(hasLikedMedia(m.id)), [m.id]);

  const ratio = m.w && m.h ? m.w / m.h : 1;
  const poster = m.type === "video" ? cldVideoPoster(m.url, 500, Math.round(500 / (ratio || 1))) : cldFit(m.url, 500);

  async function toggleLike() {
    if (liked || !wallId) return;
    setLiked(true);
    setBump(true);
    setTimeout(() => setBump(false), 400);
    try {
      await likeMedia(wallId, m.id);
    } catch {
      setLiked(false);
    }
  }

  return (
    <div className="mb-2.5 break-inside-avoid relative rounded-2xl overflow-hidden bg-white/8 border border-white/10">
      <div className="relative w-full" style={{ aspectRatio: `${ratio || 1}` }}>
        {m.type === "video" && !poster ? (
          <video src={m.url + "#t=0.5"} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        )}
        {m.type === "video" && <span className="absolute bottom-1.5 right-1.5 grid place-items-center w-7 h-7 rounded-full bg-black/55 text-white text-xs">▶</span>}
        {mine && <span className="absolute top-1.5 left-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-[#070c22]">senin</span>}
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <span className="text-white/70 text-xs truncate">{m.nickname || "—"}</span>
        <button
          onClick={toggleLike}
          disabled={liked}
          className={`flex items-center gap-1 text-sm font-bold tabular-nums shrink-0 ${liked ? "text-[#ff5a7a]" : "text-white/70"}`}
          aria-label="Beğen"
        >
          <span className={bump ? "ww-like-bump" : ""} aria-hidden>{liked ? "❤" : "🤍"}</span>
          {(m.likes ?? 0) > 0 && <span>{m.likes}</span>}
        </button>
      </div>
      <style jsx>{`
        .ww-like-bump { display: inline-block; animation: likebump 0.4s ease; }
        @keyframes likebump { 30% { transform: scale(1.5); } 60% { transform: scale(0.9); } }
      `}</style>
    </div>
  );
}
