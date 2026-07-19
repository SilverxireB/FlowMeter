"use client";

/**
 * FlowWall yükleme — misafir telefonu. Auth yok. Fotoğraf/video seç → önizleme →
 * canlı % ilerlemeyle Cloudinary'ye yükle → duvara düşsün (moderasyon açıksa onaya).
 */
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import { useWall } from "@/lib/hooks";
import { addWallMedia, resolveCode } from "@/lib/walls";
import { cloudinaryStatus, isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";
import { getStoredNickname, storeIdentity, getStoredAvatarSeed } from "@/lib/participants";
import { getVoterId } from "@/lib/responses";

type Phase = "pick" | "preview" | "uploading" | "done";

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

  const [nickname, setNickname] = useState("");
  useEffect(() => setNickname(getStoredNickname() ?? ""), []);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setPhase("preview");
    setErr(null);
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setProgress(0);
    setPhase("pick");
    setErr(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function upload() {
    if (!file || !wallId || !wall) return;
    const name = nickname.trim().slice(0, 30);
    if (name) storeIdentity(name, getStoredAvatarSeed() ?? "Luna");
    setPhase("uploading");
    setProgress(0);
    setErr(null);
    try {
      const res = await uploadToCloudinary(
        file,
        `walls/${wallId}/${wall.sessionId ?? "s"}`,
        setProgress
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
      setPhase("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yükleme başarısız.");
      setPhase("preview");
    }
  }

  const isVideo = file?.type.startsWith("video");

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

      <section className="flex-1 flex flex-col px-5 pb-8 max-w-md w-full mx-auto">
        {!isCloudinaryConfigured() && (
          <div className="mb-5 rounded-2xl bg-[#eda100]/15 border border-[#eda100]/40 px-4 py-3 text-sm text-[#ffdd99]">
            ⚠️ Medya yükleme yapılandırılmadı. Eksik değişken(ler):
            <span className="block mt-1 font-mono text-xs">
              CLOUD_NAME: {cloudinaryStatus().cloud ? "✓ var" : "✗ EKSİK"} · UPLOAD_PRESET:{" "}
              {cloudinaryStatus().preset ? "✓ var" : "✗ EKSİK"}
            </span>
            <span className="block mt-1 text-[#ffdd99]/80">
              Vercel&apos;e ekledikten sonra <b>yeni build</b> (cache&apos;siz redeploy) gerekir.
            </span>
          </div>
        )}

        {phase === "done" ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-4" aria-hidden>{wall?.moderation ? "🛡" : "🎉"}</div>
            <h1 className="text-2xl font-bold mb-2">
              {wall?.moderation ? "Onaya gönderildi" : "Duvarda!"}
            </h1>
            <p className="text-white/65 mb-8">
              {wall?.moderation
                ? "Moderatör onayladığında perdede görünecek."
                : "Anın birazdan perdede akmaya başlıyor."}
            </p>
            <button onClick={reset} className="py-3.5 px-7 rounded-2xl bg-white text-[#070c22] font-semibold">
              Başka bir tane yükle
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

            {/* Önizleme / seçim alanı */}
            <div className="flex-1 flex items-center justify-center rounded-3xl bg-white/5 border border-white/12 overflow-hidden min-h-[46vh] relative">
              {previewUrl ? (
                isVideo ? (
                  <video src={previewUrl} className="max-h-[46vh] max-w-full object-contain" controls muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Seçilen görsel" className="max-h-[46vh] max-w-full object-contain" />
                )
              ) : (
                <button
                  onClick={() => inputRef.current?.click()}
                  className="flex flex-col items-center gap-3 text-white/70 py-16 px-8"
                >
                  <span className="text-5xl" aria-hidden>📸</span>
                  <span className="font-semibold text-lg text-white">Fotoğraf / video seç</span>
                  <span className="text-sm text-white/50">Galerinden seç veya çek</span>
                </button>
              )}

              {phase === "uploading" && (
                <div className="absolute inset-0 bg-[#070c22]/80 flex flex-col items-center justify-center gap-4">
                  <div className="w-3/4 h-2.5 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-full bg-white transition-[width] duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="tabular-nums font-semibold">{progress}%</p>
                </div>
              )}
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              onChange={onPick}
              className="hidden"
            />

            {err && <p className="mt-3 text-[#ff9db3] text-sm font-semibold">{err}</p>}

            <div className="mt-4 flex gap-3">
              {phase === "preview" && (
                <button onClick={reset} className="py-3.5 px-5 rounded-2xl bg-white/10 border border-white/15 font-semibold">
                  Değiştir
                </button>
              )}
              <button
                onClick={file ? upload : () => inputRef.current?.click()}
                disabled={phase === "uploading" || (!!file && !isCloudinaryConfigured())}
                className="flex-1 py-3.5 rounded-2xl bg-white text-[#070c22] font-semibold disabled:opacity-40"
              >
                {phase === "uploading" ? "Yükleniyor…" : file ? "Gönder →" : "Seç"}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
