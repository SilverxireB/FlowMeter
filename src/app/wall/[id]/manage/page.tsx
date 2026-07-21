"use client";

/**
 * FlowWall yönetim — sadece sahibi. Moderasyon aç/kapat, bekleyenleri onayla/
 * reddet, tüm medyayı gör/kaldır, katılım QR + kod, perde ekranı linki.
 */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Logo from "@/components/Logo";
import QrCode from "@/components/present/QrCode";
import { downloadQrCard } from "@/components/WallQrCard";
import { useAuthUser, useWall, useWallMedia } from "@/lib/hooks";
import { addWallMedia, deleteMedia, setMediaStatus, setWallHeadline, setWallModeration, setWallTheme } from "@/lib/walls";
import { cldThumb, cldVideoPoster, isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";
import { WALL_THEME_PRESETS, wallThemeStyle } from "@/lib/themes";
import { compressImage } from "@/lib/images";
import { getVoterId } from "@/lib/responses";
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
  const rejected = useMemo(() => allMedia.filter((m) => m.status === "rejected"), [allMedia]);

  // Sunucunun kendi medya eklemesi
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [upPct, setUpPct] = useState(0);
  const [upErr, setUpErr] = useState<string | null>(null);

  // Tümünü indir (ZIP) — tarayıcıda paketlenir, sunucu gerekmez
  const [zipping, setZipping] = useState(false);
  const [zipMsg, setZipMsg] = useState<string | null>(null);

  async function downloadAll() {
    if (zipping) return;
    const list = allMedia.filter((m) => m.status !== "rejected");
    if (!list.length) {
      setZipMsg("İndirilecek medya yok.");
      return;
    }
    setZipping(true);
    setZipMsg(null);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      let n = 0;
      for (const m of list) {
        try {
          const res = await fetch(m.url);
          if (!res.ok) throw new Error(String(res.status));
          const blob = await res.blob();
          const extFromUrl = m.url.split("?")[0].split(".").pop() ?? "";
          const ext = /^[a-z0-9]{2,5}$/i.test(extFromUrl) ? extFromUrl : m.type === "video" ? "mp4" : "jpg";
          const who = (m.nickname ?? "anonim").replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "anonim";
          zip.file(`${String(n + 1).padStart(3, "0")}-${who}.${ext}`, blob);
          n++;
          setZipMsg(`Paketleniyor… ${n}/${list.length}`);
        } catch {
          setZipMsg(`Paketleniyor… (${m.type} atlandı)`);
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `flowwall-${wall?.joinCode ?? id}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      setZipMsg(`✓ ${n} medya indirildi.`);
    } catch (e) {
      setZipMsg(`ZIP oluşturulamadı: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setZipping(false);
    }
  }

  // KALICI silme: önce Cloudinary'deki dosya (API route), sonra Firestore kaydı
  async function hardDelete(m: WallMedia) {
    if (!confirm("Bu medya Cloudinary'den ve duvardan KALICI olarak silinsin mi?")) return;
    try {
      if (user && m.cloudinaryId && !m.cloudinaryId.startsWith("seed/")) {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/wall/destroy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallId: id, cloudinaryId: m.cloudinaryId, resourceType: m.type, idToken }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok && j?.error !== "not-configured") {
          setZipMsg(`Cloudinary silme başarısız (${j?.error ?? res.status}) — kayıt yine de duvardan kaldırıldı.`);
        } else if (j?.error === "not-configured") {
          setZipMsg("Not: CLOUDINARY_API_KEY/SECRET tanımlı değil — dosya Cloudinary'de kaldı, kayıt duvardan silindi.");
        }
      }
    } catch {
      // dosya silinemese de kaydı kaldır
    }
    await deleteMedia(id, m.id);
  }

  async function ownerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !wall) return;
    setUploading(true);
    setUpPct(0);
    setUpErr(null);
    try {
      const res = await uploadToCloudinary(f, `walls/${id}/${wall.sessionId ?? "s"}`, setUpPct);
      await addWallMedia(
        id,
        {
          voterId: getVoterId(),
          nickname: "Sunucu",
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
    } catch (err) {
      setUpErr(err instanceof Error ? err.message : "Yükleme başarısız.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

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
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button onClick={downloadAll} disabled={zipping} className="btn-ghost !py-2 !px-4 text-sm">
                {zipping ? "⏳ Paketleniyor…" : "⬇ Tümünü indir (ZIP)"}
              </button>
              <button
                onClick={() => wall && joinUrl && downloadQrCard(wall, joinUrl)}
                disabled={!wall?.joinCode}
                className="btn-ghost !py-2 !px-4 text-sm"
              >
                🖨 QR Kartı indir
              </button>
              {zipMsg && <span className="text-muted text-xs">{zipMsg}</span>}
            </div>
          </div>
        </div>

        {/* Tema seçici */}
        <div className="card p-5 flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-1 min-w-0">
            <p className="eyebrow mb-3">Perde teması</p>
            <div className="flex flex-wrap gap-2.5 mb-4">
              {WALL_THEME_PRESETS.map((p) => {
                const active = (wall?.theme?.preset ?? "gece") === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      const nextTheme: { preset: string; bgImage?: string } = { preset: p.id };
                      if (wall?.theme?.bgImage) nextTheme.bgImage = wall.theme.bgImage;
                      setWallTheme(id, nextTheme).catch(console.error);
                    }}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                      active ? "border-accent ring-2 ring-accent-soft scale-105" : "border-line hover:border-muted"
                    }`}
                    style={{ width: 88, height: 56 }}
                    title={p.name}
                  >
                    <div className="absolute inset-0" style={{ background: p.bg }} />
                    <span className={`relative z-10 text-[11px] font-bold ${
                      p.dark ? "text-white/90" : "text-ink/80"
                    }`}>
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Arka plan görseli */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="btn-ghost !py-2 !px-4 text-sm cursor-pointer">
                  🖼 Arka plan görseli
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const dataUri = await compressImage(f, 1600, 0.7);
                        await setWallTheme(id, { preset: wall?.theme?.preset ?? "gece", bgImage: dataUri });
                      } catch {
                        // sıkıştırma hatası — sessiz
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                {wall?.theme?.bgImage && (
                  <button
                    onClick={() => setWallTheme(id, { preset: wall?.theme?.preset ?? "gece" }).catch(console.error)}
                    className="btn-ghost !py-2 !px-4 text-sm !text-brand !border-brand"
                  >
                    ✕ Görseli kaldır
                  </button>
                )}
              </div>
              {wall?.theme?.bgImage && (
                <span className="text-muted text-xs">Görsel yüklendi — perdede koyu katman ile görünür.</span>
              )}
            </div>
          </div>
          
          {/* Önizleme */}
          <div className="w-full md:w-64 shrink-0">
            <p className="eyebrow mb-3">Perde önizlemesi</p>
            <WallPreview wall={wall} />
          </div>
        </div>

        {/* Sunucu kendi medyasını ekler (moderasyondan bağımsız kokpit) */}
        <div className="card p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Kendi fotoğraf/videonu ekle</p>
            <p className="text-muted text-xs">
              {wall.moderation ? "Moderasyon açık — eklediğin de onaya düşer, aşağıdan onayla." : "Direkt perdeye eklenir."}
            </p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !isCloudinaryConfigured()}
            className="btn-primary !py-2 !px-4 text-sm shrink-0"
          >
            {uploading ? `Yükleniyor… ${upPct}%` : "＋ Medya ekle"}
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={ownerUpload} className="hidden" />
          {!isCloudinaryConfigured() && <p className="text-brand text-xs w-full">Cloudinary yapılandırılmadı.</p>}
          {upErr && <p className="text-brand text-xs w-full">{upErr}</p>}
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
                    <button onClick={() => hardDelete(m)} className="btn-ghost !py-1.5 !px-2.5 text-xs !border-brand !text-brand" title="Kalıcı sil (Cloudinary dahil)">🗑</button>
                  </div>
                </MediaCard>
              ))}
            </div>
          )}
        </section>

        {/* Kaldırılanlar (geri alınabilir) */}
        {rejected.length > 0 && (
          <section>
            <p className="eyebrow mb-3 text-muted">Kaldırılanlar ({rejected.length})</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {rejected.map((m) => (
                <MediaCard key={m.id} m={m}>
                  <div className="flex gap-1.5">
                    <button onClick={() => setMediaStatus(id, m.id, "approved")} className="flex-1 btn-accent !py-1.5 text-xs">↩ Geri al</button>
                    <button onClick={() => hardDelete(m)} className="btn-ghost !py-1.5 !px-2.5 text-xs !border-brand !text-brand" title="Kalıcı sil (Cloudinary dahil)">🗑</button>
                  </div>
                </MediaCard>
              ))}
            </div>
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
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button onClick={downloadAll} disabled={zipping} className="btn-ghost !py-2 !px-4 text-sm">
                {zipping ? "⏳ Paketleniyor…" : "⬇ Tümünü indir (ZIP)"}
              </button>
              <button
                onClick={() => wall && joinUrl && downloadQrCard(wall, joinUrl)}
                disabled={!wall?.joinCode}
                className="btn-ghost !py-2 !px-4 text-sm"
              >
                🖨 QR Kartı indir
              </button>
              {zipMsg && <span className="text-muted text-xs">{zipMsg}</span>}
            </div>
          </div>
        </div>

        {/* Tema seçici */}
        <div className="card p-5 flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-1 min-w-0">
            <p className="eyebrow mb-3">Perde teması</p>
            <div className="flex flex-wrap gap-2.5 mb-4">
              {WALL_THEME_PRESETS.map((p) => {
                const active = (wall?.theme?.preset ?? "gece") === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      const nextTheme: { preset: string; bgImage?: string } = { preset: p.id };
                      if (wall?.theme?.bgImage) nextTheme.bgImage = wall.theme.bgImage;
                      setWallTheme(id, nextTheme).catch(console.error);
                    }}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                      active ? "border-accent ring-2 ring-accent-soft scale-105" : "border-line hover:border-muted"
                    }`}
                    style={{ width: 88, height: 56 }}
                    title={p.name}
                  >
                    <div className="absolute inset-0" style={{ background: p.bg }} />
                    <span className={`relative z-10 text-[11px] font-bold ${
                      p.dark ? "text-white/90" : "text-ink/80"
                    }`}>
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Arka plan görseli */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="btn-ghost !py-2 !px-4 text-sm cursor-pointer">
                  🖼 Arka plan görseli
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const dataUri = await compressImage(f, 1600, 0.7);
                        await setWallTheme(id, { preset: wall?.theme?.preset ?? "gece", bgImage: dataUri });
                      } catch {
                        // sıkıştırma hatası — sessiz
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                {wall?.theme?.bgImage && (
                  <button
                    onClick={() => setWallTheme(id, { preset: wall?.theme?.preset ?? "gece" }).catch(console.error)}
                    className="btn-ghost !py-2 !px-4 text-sm !text-brand !border-brand"
                  >
                    ✕ Görseli kaldır
                  </button>
                )}
              </div>
              {wall?.theme?.bgImage && (
                <span className="text-muted text-xs">Görsel yüklendi — perdede koyu katman ile görünür.</span>
              )}
            </div>
          </div>
          
          {/* Önizleme */}
          <div className="w-full md:w-64 shrink-0">
            <p className="eyebrow mb-3">Perde önizlemesi</p>
            <WallPreview wall={wall} />
          </div>
        </div>

        {/* Sunucu kendi medyasını ekler (moderasyondan bağımsız kokpit) */}
        <div className="card p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Kendi fotoğraf/videonu ekle</p>
            <p className="text-muted text-xs">
              {wall.moderation ? "Moderasyon açık — eklediğin de onaya düşer, aşağıdan onayla." : "Direkt perdeye eklenir."}
            </p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !isCloudinaryConfigured()}
            className="btn-primary !py-2 !px-4 text-sm shrink-0"
          >
            {uploading ? `Yükleniyor… ${upPct}%` : "＋ Medya ekle"}
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={ownerUpload} className="hidden" />
          {!isCloudinaryConfigured() && <p className="text-brand text-xs w-full">Cloudinary yapılandırılmadı.</p>}
          {upErr && <p className="text-brand text-xs w-full">{upErr}</p>}
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
                    <button onClick={() => hardDelete(m)} className="btn-ghost !py-1.5 !px-2.5 text-xs !border-brand !text-brand" title="Kalıcı sil (Cloudinary dahil)">🗑</button>
                  </div>
                </MediaCard>
              ))}
            </div>
          )}
        </section>

        {/* Kaldırılanlar (geri alınabilir) */}
        {rejected.length > 0 && (
          <section>
            <p className="eyebrow mb-3 text-muted">Kaldırılanlar ({rejected.length})</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {rejected.map((m) => (
                <MediaCard key={m.id} m={m}>
                  <div className="flex gap-1.5">
                    <button onClick={() => setMediaStatus(id, m.id, "approved")} className="flex-1 btn-accent !py-1.5 text-xs">↩ Geri al</button>
                    <button onClick={() => hardDelete(m)} className="btn-ghost !py-1.5 !px-2.5 text-xs !border-brand !text-brand" title="Kalıcı sil (Cloudinary dahil)">🗑</button>
                  </div>
                </MediaCard>
              ))}
            </div>
          </section>
        )}

        <p className="text-muted text-xs">
          🗑 = kalıcı silme (Cloudinary'deki dosya + duvar kaydı). Kalıcı silme için
          Vercel'de CLOUDINARY_API_KEY ve CLOUDINARY_API_SECRET tanımlı olmalı;
          değilse yalnız duvar kaydı silinir. “Tümünü indir” tarayıcıda paketler.
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

function WallPreview({ wall }: { wall: Wall | null }) {
  const { style, dark } = wallThemeStyle(wall?.theme);
  const textClass = dark ? "text-white" : "text-ink";
  const mutedClass = dark ? "text-white/60" : "text-ink/55";

  return (
    <div className={`w-full aspect-video rounded-xl overflow-hidden shadow-inner border border-line relative flex flex-col items-center justify-center ${textClass}`} style={style}>
      {wall?.theme?.bgImage && (
        <div aria-hidden className="absolute inset-0" style={{ background: dark ? "radial-gradient(120% 100% at 50% 40%, transparent 40%, rgba(5,9,28,0.75) 100%)" : "radial-gradient(120% 100% at 50% 40%, transparent 40%, rgba(255,255,255,0.75) 100%)" }} />
      )}
      <h3 className="font-display text-base font-bold text-center drop-shadow-md text-balance z-10 px-4">
        {wall?.headline || wall?.title || "FlowWall"}
      </h3>
      <div className="mt-2 w-3/5 h-2/5 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center shadow-lg z-10 backdrop-blur-sm">
         <span className="text-2xl" aria-hidden>📷</span>
      </div>
      <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-lg px-2 py-1 backdrop-blur-md shadow-md z-10 ${dark ? "bg-white/10 border border-white/15" : "bg-black/5 border border-black/10"}`}>
        <div className="bg-white rounded p-0.5"><div className="w-3 h-3 bg-black/80" /></div>
        <div className="text-left leading-tight">
          <p className={`text-[6px] uppercase tracking-widest ${mutedClass}`}>Katıl</p>
          <p className="font-display text-[10px] font-bold tabular-nums tracking-wider">{wall?.joinCode || "------"}</p>
        </div>
      </div>
    </div>
  );
}
