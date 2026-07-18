"use client";

/**
 * FlowWall yönetim — sadece sahibi. Moderasyon aç/kapat, bekleyenleri onayla/
 * reddet, tüm medyayı gör/kaldır, katılım QR + kod, perde ekranı linki.
 */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import QrCode from "@/components/present/QrCode";
import { useAuthUser, useWall, useWallMedia } from "@/lib/hooks";
import { deleteMedia, setMediaStatus, setWallHeadline, setWallModeration } from "@/lib/walls";
import { cldThumb, cldVideoPoster } from "@/lib/cloudinary";
import { WallMedia } from "@/lib/types";

export default function WallManage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { wall, loading } = useWall(id);
  const allMedia = useWallMedia(id);

  const [screenUrl, setScreenUrl] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  useEffect(() => {
    setScreenUrl(`${window.location.origin}/wall/${id}`);
    setJoinUrl(`${window.location.origin}/u/${id}`);
  }, [id]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  const pending = useMemo(() => allMedia.filter((m) => m.status === "pending"), [allMedia]);
  const approved = useMemo(() => allMedia.filter((m) => m.status === "approved"), [allMedia]);

  if (authLoading || loading) {
    return <main className="min-h-screen grid place-items-center bg-wash text-muted animate-pulse">Yükleniyor…</main>;
  }
  if (!wall) {
    return <main className="min-h-screen grid place-items-center bg-wash text-muted">Duvar bulunamadı.</main>;
  }
  if (user && wall.ownerId !== user.uid) {
    return (
      <main className="min-h-screen grid place-items-center bg-wash text-center px-6">
        <div>
          <p className="text-xl font-bold mb-1">Yetki yok</p>
          <p className="text-muted">Bu duvarı sadece sahibi yönetebilir.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-wash">
      <header className="bg-white/80 backdrop-blur border-b border-line px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/dashboard" className="text-muted hover:text-ink shrink-0 text-lg">←</Link>
          <Logo variant="wall" />
          <span className="font-display font-semibold truncate">{wall.title}</span>
        </div>
        <a href={`/wall/${id}`} target="_blank" className="btn-primary !py-2 !px-4 text-sm shrink-0">
          ▶ Perde ekranı ↗
        </a>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* Katılım + ayarlar */}
        <div className="card p-5 flex flex-col sm:flex-row gap-5 items-center">
          {joinUrl && (
            <div className="bg-white rounded-2xl p-2 border border-line shrink-0">
              <QrCode text={joinUrl} size={120} />
            </div>
          )}
          <div className="flex-1 min-w-0 w-full">
            <p className="eyebrow mb-1">Katılım kodu</p>
            <p className="font-display text-4xl font-bold tracking-[0.15em] text-accent mb-3">{wall.joinCode}</p>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!wall.moderation}
                onChange={(e) => setWallModeration(id, e.target.checked)}
                className="w-5 h-5 accent-[#4f46e5]"
              />
              <span className="text-sm font-semibold">
                Moderasyon {wall.moderation ? "açık — yüklenenler onay bekler" : "kapalı — direkt perdede"}
              </span>
            </label>
            <input
              defaultValue={wall.headline ?? ""}
              onBlur={(e) => setWallHeadline(id, e.target.value.slice(0, 80))}
              placeholder="Perde başlığı (ör. Ayşe & Mehmet · 2026)"
              className="input-base !py-2 mt-3 text-sm"
            />
          </div>
        </div>

        {/* Onay bekleyenler */}
        {wall.moderation && (
          <section>
            <p className="eyebrow mb-3">Onay bekleyen ({pending.length})</p>
            {pending.length === 0 ? (
              <p className="text-muted text-sm">Bekleyen medya yok.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pending.map((m) => (
                  <MediaCard key={m.id} m={m}>
                    <div className="flex gap-1.5">
                      <button onClick={() => setMediaStatus(id, m.id, "approved")} className="flex-1 btn-accent !py-1.5 text-xs">✓ Onayla</button>
                      <button onClick={() => setMediaStatus(id, m.id, "rejected")} className="btn-ghost !py-1.5 !px-2.5 text-xs !border-brand !text-brand">✕</button>
                    </div>
                  </MediaCard>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Perdedeki medya */}
        <section>
          <p className="eyebrow mb-3">Perdede ({approved.length})</p>
          {approved.length === 0 ? (
            <p className="text-muted text-sm">Henüz onaylı medya yok.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {approved.map((m) => (
                <MediaCard key={m.id} m={m}>
                  <div className="flex gap-1.5">
                    <button onClick={() => setMediaStatus(id, m.id, "rejected")} className="flex-1 btn-ghost !py-1.5 text-xs">Kaldır</button>
                    <button onClick={() => deleteMedia(id, m.id)} className="btn-ghost !py-1.5 !px-2.5 text-xs !border-brand !text-brand" title="Sil">🗑</button>
                  </div>
                </MediaCard>
              ))}
            </div>
          )}
        </section>

        <p className="text-muted text-xs">
          Not: “Sil” şu an medyayı duvardan kaldırır (Firestore). Cloudinary'deki
          dosyanın tamamen silinmesi ve “tümünü indir” için sunucu tarafı fonksiyon
          eklenecek (bkz. docs/FLOWWALL.md).
        </p>
      </div>
    </main>
  );
}

function MediaCard({ m, children }: { m: WallMedia; children: React.ReactNode }) {
  const thumb = m.type === "video" ? cldVideoPoster(m.url, 400, 400) : cldThumb(m.url, 400, 400);
  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-paper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {m.type === "video" && (
          <span className="absolute top-1.5 right-1.5 bg-ink/70 text-white rounded-full px-1.5 py-0.5 text-xs">▶</span>
        )}
      </div>
      <div className="p-2 flex flex-col gap-1.5">
        {m.nickname && <p className="text-xs text-muted truncate px-0.5">{m.nickname}</p>}
        {children}
      </div>
    </div>
  );
}
