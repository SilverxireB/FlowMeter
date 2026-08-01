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
import { useWall } from "@/lib/hooks";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { addWallMedia, castContestVote, deleteMedia, getMyContestVote, getMyRaffleSicil, hasLikedMedia, isCurrentSession, likeMedia, raffleRegistrationOpen, registerRaffle, resolveCode, sendWallWish, wallMaxPerPerson, wallVideoLimitSec, watchWallMediaByVoter, watchWallMediaRecent } from "@/lib/walls";
import { cloudinaryStatus, cldFit, cldVideoPoster, isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";
import { getStoredNickname, storeIdentity, getStoredAvatarSeed } from "@/lib/participants";
import { getVoterId } from "@/lib/responses";
import { WallMedia } from "@/lib/types";
import { withTimeout } from "@/lib/withTimeout";

interface Item {
  id: string;
  file: File;
  url: string;
  isVideo: boolean;
  status: "queued" | "uploading" | "done" | "error";
  pct: number;
  /** Cloudinary adımı bitti — retry yalnız Firestore yazımını tekrarlar
   *  (çift yükleme + yetim dosya + kota israfı önlenir). */
  uploaded?: {
    type: "image" | "video";
    cloudinaryId: string;
    url: string;
    w?: number;
    h?: number;
    durationMs?: number;
  };
  /** Kullanıcıya gösterilecek hata nedeni (sessiz ⚠ yerine). */
  error?: string;
}

const MAX_VIDEO_BYTES = 80 * 1024 * 1024; // saçma büyüklükte dosyayı engelle (süre asıl kontrol)

/** Video dosyasının süresini (sn) metadata'dan okur; okunamazsa 0 (engelleme). */
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(v.src);
      resolve(Number.isFinite(d) ? d : 0);
    };
    v.onerror = () => {
      URL.revokeObjectURL(v.src);
      reject(new Error("metadata"));
    };
    v.src = URL.createObjectURL(file);
  });
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

  const { wall, loading: wallLoading } = useWall(wallId ?? null);

  const [tab, setTab] = useState<"upload" | "browse" | "wish" | "contest" | "raffle">("upload");
  const contestOn = wall?.contest?.status === "running";
  const raffleOn = raffleRegistrationOpen(wall);
  const videoLimit = wallVideoLimitSec(wall); // sn (0 = kapalı)
  const videoOn = videoLimit > 0;
  const wishesOn = wall?.wishesEnabled !== false;
  const closedWall = !!wall?.closed;
  const [pickMsg, setPickMsg] = useState<string | null>(null);

  const [nickname, setNickname] = useState("");
  useEffect(() => setNickname(getStoredNickname() ?? ""), []);

  // Anonim kimlik: misafir KENDİ yüklediğini silebilsin diye sessizce anonim
  // oturum açılır (Firebase Anonymous — dış servis değil). Sağlayıcı kapalıysa
  // sessizce cihaz kimliğine düşülür; yükleme hiç etkilenmez.
  const [myId, setMyId] = useState("");
  useEffect(() => {
    setMyId(getVoterId());
    let unsub: (() => void) | undefined;
    try {
      const a = auth();
      unsub = onAuthStateChanged(a, (u) => setMyId(u?.uid ?? getVoterId()));
      if (!a.currentUser) signInAnonymously(a).catch(() => {});
    } catch {}
    return () => unsub?.();
  }, []);

  const [items, setItems] = useState<Item[]>([]);
  const [sending, setSending] = useState(false);
  const [finished, setFinished] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // Sayfa içi kamera: uygulama değiştirmeden çek — Android düşük RAM'de kamera
  // uygulamasına geçince PWA'yı öldürüp çekilen kareyi kaybedebiliyordu
  // ("Bellek yetersiz..." vakası). getUserMedia yoksa capture input'a düşülür.
  const [camOpen, setCamOpen] = useState(false);
  const openCamera = () => {
    const ok = typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";
    if (ok) setCamOpen(true);
    else cameraRef.current?.click();
  };
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  // "Duvarda göründün!" — SADECE kendi medyanı dinle (tüm koleksiyonu değil;
  // 500 kişide okuma patlamasın). Onaylanıp perdeye düşünce kutlama.
  const [myMedia, setMyMedia] = useState<WallMedia[]>([]);
  useEffect(() => {
    if (!wallId || !myId) return;
    return watchWallMediaByVoter(wallId, myId, setMyMedia);
  }, [wallId, myId]);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const seenMine = useRef<Set<string> | null>(null);
  useEffect(() => {
    const mine = myMedia.filter((m) => m.status === "approved" && isCurrentSession(m, wall)).map((m) => m.id);
    if (seenMine.current === null) {
      seenMine.current = new Set(mine);
      return;
    }
    const fresh = mine.find((x) => !seenMine.current!.has(x));
    mine.forEach((x) => seenMine.current!.add(x));
    if (fresh) {
      const m = myMedia.find((mm) => mm.id === fresh);
      setCelebrate(m ? (m.type === "video" ? cldVideoPoster(m.url, 500, 500) : cldFit(m.url, 500)) : "");
      window.setTimeout(() => setCelebrate(null), 4500);
    }
  }, [myMedia, wall]);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url));
    };
  }, []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
    if (!files.length) return;
    await addFiles(files);
  }

  async function addFiles(files: File[]) {
    // Sınırlar: kişi başı foto tavanı + video süre/boyut (istemci tarafı, nazik).
    const cap = wallMaxPerPerson(wall); // 0 = sınırsız
    const mySession = wall?.sessionId;
    const myPhotos = myMedia.filter((m) => m.type === "image" && m.status !== "rejected" && (!mySession || !m.sessionId || m.sessionId === mySession)).length;
    const queuedPhotos = itemsRef.current.filter((i) => !i.isVideo && i.status !== "done").length;
    let photoBudget = cap === 0 ? Infinity : Math.max(0, cap - myPhotos - queuedPhotos);

    const accepted: File[] = [];
    const notices: string[] = [];
    for (const f of files.slice(0, 30)) {
      if (f.type.startsWith("video")) {
        if (!videoOn) { notices.push("Video kapalı — yalnız fotoğraf."); continue; }
        if (f.size > MAX_VIDEO_BYTES) { notices.push(`Video çok büyük (en çok ${Math.round(MAX_VIDEO_BYTES / 1e6)} MB).`); continue; }
        const dur = await getVideoDuration(f).catch(() => 0);
        if (dur && dur > videoLimit + 0.6) { notices.push(`Video ${videoLimit} sn'yi aşıyor.`); continue; }
        accepted.push(f);
      } else if (f.type.startsWith("image")) {
        if (photoBudget <= 0) { notices.push(cap ? `Kişi başı en fazla ${cap} foto paylaşabilirsin.` : "Foto eklenemedi."); continue; }
        photoBudget--;
        accepted.push(f);
      }
    }

    if (accepted.length) {
      const next = accepted.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        url: URL.createObjectURL(f),
        isVideo: f.type.startsWith("video"),
        status: "queued" as const,
        pct: 0,
      }));
      setItems((prev) => [...prev, ...next]);
      setFinished(false);
    }
    setPickMsg(notices.length ? notices[0] + (notices.length > 1 ? ` (+${notices.length - 1} dosya daha eklenmedi)` : "") : null);
    if (notices.length) window.setTimeout(() => setPickMsg(null), 5500);
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
    if (!wallId || !wall || sending || wall.closed) return;
    const name = nickname.trim().slice(0, 30);
    if (name) storeIdentity(name, getStoredAvatarSeed() ?? "Luna");
    setSending(true);
    for (const it of itemsRef.current) {
      if (it.status === "done") continue;
      patch(it.id, { status: "uploading", pct: 0, error: undefined });
      try {
        // Cloudinary adımı daha önce bittiyse tekrarlanmaz (retry = yalnız kayıt)
        let res = it.uploaded;
        if (!res) {
          res = await uploadToCloudinary(
            it.file,
            `walls/${wallId}/${wall.sessionId ?? "s"}`,
            (pct) => patch(it.id, { pct }),
            { keepOriginal: !!wall.keepOriginal, frameUrl: wall.frameUrl ?? undefined }
          );
          patch(it.id, { uploaded: res, pct: 100 });
        }
        // Ağ koparsa yazım askıda kalmasın: timeout → görünür hata + tekrar dene
        await withTimeout(
          addWallMedia(
            wallId,
            {
              // Anonim uid varsa o — misafir kendi yüklediğini silebilsin (rules eşleşmesi)
              voterId: auth().currentUser?.uid ?? getVoterId(),
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
          )
        );
        patch(it.id, { status: "done", pct: 100 });
      } catch (e) {
        patch(it.id, {
          status: "error",
          error: e instanceof Error ? e.message : "Yükleme başarısız — tekrar dene.",
        });
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

  // Geçersiz kod VEYA geçersiz/silinmiş doğrudan link → ölü sayfa yerine net mesaj
  if (wallId === null || (wallId !== undefined && !wallLoading && !wall)) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#070c22] text-white/70 px-6 text-center">
        Duvar bulunamadı — kodu ya da linki kontrol et.
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
            🖼 Gez
          </button>
          {wishesOn && (
            <button
              onClick={() => setTab("wish")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tab === "wish" ? "bg-white text-[#070c22]" : "text-white/60"}`}
            >
              💌 Dilek
            </button>
          )}
          {contestOn && (
            <button
              onClick={() => setTab("contest")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tab === "contest" ? "bg-white text-[#070c22]" : "text-white/60"}`}
            >
              🏆
            </button>
          )}
          {raffleOn && (
            <button
              onClick={() => setTab("raffle")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tab === "raffle" ? "bg-white text-[#070c22]" : "text-white/60"}`}
            >
              🎁
            </button>
          )}
        </div>
      </div>

      {tab === "raffle" && raffleOn ? (
        <RaffleTab wallId={wallId ?? null} prize={wall?.raffle?.prize} defaultName={nickname} />
      ) : tab === "contest" && contestOn ? (
        <ContestTab wallId={wallId ?? null} contestId={wall!.contest!.id} title={wall!.contest!.title} sessionId={wall!.sessionId} />
      ) : tab === "browse" ? (
        <BrowseGallery wallId={wallId ?? null} sessionId={wall?.sessionId} myId={myId} />
      ) : tab === "wish" && wishesOn ? (
        <WishTab wallId={wallId ?? null} defaultName={nickname} moderation={!!wall?.moderation} />
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

        {closedWall ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-4" aria-hidden>🎉</div>
            <h1 className="text-2xl font-bold mb-2">Bu duvar kapandı</h1>
            <p className="text-white/65">Etkinlik tamamlandı — katkın için teşekkürler! Anıları &ldquo;🖼 Gez&rdquo; sekmesinden görebilirsin.</p>
            {wall?.galleryOpen && (
              <a href={`/g/${wallId}`} className="mt-6 py-3 px-6 rounded-2xl bg-white text-[#070c22] font-semibold">
                📸 Galeriye git — fotoğrafları indir
              </a>
            )}
          </div>
        ) : finished ? (
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
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => inputRef.current?.click()}
                  className="rounded-3xl bg-white/5 border border-white/12 flex flex-col items-center justify-center gap-3 text-white/70 py-20"
                >
                  <span className="text-5xl" aria-hidden>📸</span>
                  <span className="font-semibold text-lg text-white">{videoOn ? "Fotoğraf / video seç" : "Fotoğraf seç"}</span>
                  <span className="text-sm text-white/50">Birden çok seçebilirsin</span>
                </button>
                {/* Anlık kamera: galeri/dosya diyaloğunda kaybolmadan tek dokunuş çekim */}
                <button
                  onClick={openCamera}
                  className="rounded-2xl bg-white text-[#070c22] font-semibold py-4 flex items-center justify-center gap-2"
                >
                  📷 Anında çek ve gönder
                </button>
              </div>
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
                  <>
                    <button
                      onClick={() => inputRef.current?.click()}
                      className="aspect-square rounded-xl border border-dashed border-white/25 grid place-items-center text-3xl text-white/50"
                      aria-label="Daha ekle"
                    >
                      ＋
                    </button>
                    <button
                      onClick={openCamera}
                      className="aspect-square rounded-xl border border-dashed border-white/25 grid place-items-center text-2xl text-white/60"
                      aria-label="Kamerayla çek"
                    >
                      📷
                    </button>
                  </>
                )}
              </div>
            )}

            <input ref={inputRef} type="file" accept={videoOn ? "image/*,video/*" : "image/*"} multiple onChange={onPick} className="hidden" />
            {/* capture=environment → doğrudan arka kamera açılır (getUserMedia yoksa yedek yol) */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
            {camOpen && (
              <CameraSheet
                onShot={(f) => addFiles([f])}
                onClose={() => setCamOpen(false)}
                onFallback={() => {
                  setCamOpen(false);
                  cameraRef.current?.click();
                }}
              />
            )}

            {pickMsg && (
              <p className="mt-3 rounded-xl bg-[#eda100]/15 border border-[#eda100]/40 px-3 py-2 text-xs text-[#ffdd99]">{pickMsg}</p>
            )}

            {/* Hata nedeni görünür olsun: ⚠ tek başına yetmez */}
            {(() => {
              const failed = items.find((i) => i.status === "error");
              return failed ? (
                <p className="mt-3 rounded-xl bg-[#e34948]/15 border border-[#e34948]/40 px-3 py-2 text-xs text-[#ffb3b3]">
                  ⚠ {failed.error ?? "Yükleme başarısız."} &ldquo;Gönder&rdquo; ile tekrar deneyebilirsin
                  {failed.uploaded ? " (dosya yüklendi, yalnız kayıt tekrarlanır)" : ""}.
                </p>
              ) : null;
            })()}

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

      {celebrate !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 backdrop-blur-sm px-8" onClick={() => setCelebrate(null)}>
          <div className="text-center">
            <div className="text-5xl mb-4 animate-pop" aria-hidden>🎉</div>
            <p className="text-white text-2xl font-bold mb-4">Fotoğrafın duvarda parlıyor!</p>
            {celebrate && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={celebrate} alt="" className="mx-auto max-h-[40vh] rounded-2xl shadow-2xl border-2 border-white/30 animate-pop" />
            )}
            <p className="text-white/60 text-sm mt-4">Perdeye bak 👀</p>
          </div>
        </div>
      )}
    </main>
  );
}

/** 🏆 Yarışma — aday fotolara oy ver (kişi başı tek, değiştirilebilir). */
function ContestTab({ wallId, contestId, title, sessionId }: { wallId: string | null; contestId: string; title: string; sessionId?: string }) {
  const [media, setMedia] = useState<WallMedia[]>([]);
  const [myVote, setMyVote] = useState<string | null>(null);
  useEffect(() => { if (!wallId) return; return watchWallMediaRecent(wallId, 150, setMedia); }, [wallId]);
  useEffect(() => { setMyVote(getMyContestVote(contestId)); }, [contestId]);
  // Yalnız AKTİF oturumun onaylı fotoğrafları aday olur (eski oturum arşivi karışmaz)
  const approved = useMemo(
    () => [...media].filter((m) => m.status === "approved" && (!sessionId || !m.sessionId || m.sessionId === sessionId)).reverse(),
    [media, sessionId]
  );

  async function vote(mediaId: string) {
    if (!wallId) return;
    setMyVote(mediaId);
    try { await castContestVote(wallId, contestId, mediaId); } catch { setMyVote(getMyContestVote(contestId)); }
  }

  return (
    <section className="flex-1 flex flex-col px-5 pb-24 pt-4 max-w-md w-full mx-auto">
      <div className="rounded-2xl bg-white/8 border border-white/12 p-4 mb-4 text-center">
        <p className="text-lg font-bold">🏆 {title}</p>
        <p className="text-white/55 text-sm">Favori fotoğrafa oy ver — oyunu değiştirebilirsin.</p>
      </div>
      <div className="columns-2 gap-2.5 [column-fill:_balance]">
        {approved.map((m) => {
          const mine = myVote === m.id;
          const poster = m.type === "video" ? cldVideoPoster(m.url, 500, 500) : cldFit(m.url, 500);
          return (
            <button key={m.id} onClick={() => vote(m.id)} className={`mb-2.5 break-inside-avoid relative block w-full rounded-2xl overflow-hidden border-2 ${mine ? "border-[#f6b73c]" : "border-white/10"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={poster} alt="" className="w-full object-cover" />
              <span className={`absolute bottom-2 right-2 rounded-full px-3 py-1 text-xs font-bold ${mine ? "bg-[#f6b73c] text-[#3a2a00]" : "bg-black/55 text-white"}`}>{mine ? "✓ Oyun" : "Oy ver"}</span>
            </button>
          );
        })}
        {approved.length === 0 && <p className="text-white/50 text-center py-16">Aday fotoğraf yok.</p>}
      </div>
    </section>
  );
}

/** Dilek bırak — yazılı not, perdede akan dilek bandında görünür. */
function WishTab({ wallId, defaultName, moderation }: { wallId: string | null; defaultName: string; moderation: boolean }) {
  const [text, setText] = useState("");
  const [name, setName] = useState(defaultName);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setName(defaultName), [defaultName]);

  async function send() {
    if (!wallId || !text.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const ok = await withTimeout(sendWallWish(wallId, text, name, moderation));
      if (!ok) {
        setErr("Biraz hızlı oldu — bir saniye sonra tekrar dene.");
        return;
      }
      setText("");
      setSent(true);
      window.setTimeout(() => setSent(false), 3500);
    } catch (e) {
      // Metin kutuda kalır; misafir sebebi görür (yutulan hata yok)
      setErr(e instanceof Error ? e.message : "Dilek gönderilemedi — tekrar dene.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex-1 flex flex-col px-5 pb-24 pt-4 max-w-md w-full mx-auto">
      <div className="rounded-3xl bg-white/5 border border-white/12 p-5">
        <h2 className="text-lg font-bold mb-1">💌 Dileğini bırak</h2>
        <p className="text-white/55 text-sm mb-4">Kısa bir not yaz — perdede akan dileklerin arasında parlar.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 140))}
          placeholder="Mutluluklar, iyi ki doğdun, harika bir geceydi…"
          rows={3}
          className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 resize-none"
        />
        <div className="flex items-center justify-between mt-1 mb-3">
          <span className="text-white/30 text-xs tabular-nums">{text.length}/140</span>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 30))}
          placeholder="Adın (opsiyonel)"
          className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 mb-4"
        />
        <button
          onClick={send}
          disabled={!text.trim() || busy}
          className="w-full py-3.5 rounded-2xl bg-white text-[#070c22] font-semibold disabled:opacity-40"
        >
          {busy ? "Gönderiliyor…" : "Dileği gönder →"}
        </button>
        {sent && (
          <p className="mt-3 text-center text-[#8be2b0] text-sm font-semibold animate-pop">
            {moderation ? "✓ Dileğin onaya gönderildi — onaylanınca perdede görünür." : "✓ Dileğin duvara düştü, teşekkürler!"}
          </p>
        )}
        {err && (
          <p className="mt-3 text-center text-[#ffb3b3] text-sm font-semibold">⚠ {err}</p>
        )}
      </div>
    </section>
  );
}

/** 🎁 Çekiliş kaydı — isim + sicil (aynı sicil = tek kayıt; perde çeker). */
function RaffleTab({ wallId, prize, defaultName }: { wallId: string | null; prize?: string; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [sicil, setSicil] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setName(defaultName); }, [defaultName]);
  useEffect(() => { if (wallId) setDone(getMyRaffleSicil(wallId)); }, [wallId]);

  async function submit() {
    if (!wallId || !name.trim() || !sicil.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await withTimeout(registerRaffle(wallId, name, sicil));
      setDone(sicil.trim());
    } catch (e) {
      // Rules reddi (başka cihazın kaydını ezme girişimi / kayıt kapandı) anlaşılır olsun
      const code = (e as { code?: string })?.code ?? "";
      setErr(
        code === "permission-denied"
          ? "Bu sicil zaten başka bir telefondan kayıtlı (ya da kayıt kapandı). Sicilini kontrol et; sorun sürerse organizatöre söyle."
          : e instanceof Error ? e.message : "Kayıt başarısız."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex-1 flex flex-col px-5 pb-24 pt-4 max-w-md w-full mx-auto">
      <div className="rounded-3xl bg-white/5 border border-white/12 p-5">
        <h2 className="text-lg font-bold mb-1">🎁 Çekilişe katıl{prize ? ` · ${prize}` : ""}</h2>
        <p className="text-white/55 text-sm mb-4">İsmini ve sicilini gir; kazanan perdede canlı çekilir. Her sicil bir kez kayıt olur.</p>
        {done ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-3" aria-hidden>✅</div>
            <p className="font-bold text-lg">Kaydın alındı!</p>
            <p className="text-white/60 text-sm mt-1">Sicil: {done} · perdeye bak 👀</p>
            <button onClick={() => setDone(null)} className="mt-4 text-white/50 text-sm underline">Bilgiyi güncelle</button>
          </div>
        ) : (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder="Ad Soyad"
              className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 mb-3"
            />
            <input
              value={sicil}
              onChange={(e) => setSicil(e.target.value.slice(0, 40))}
              placeholder="Sicil / kayıt no"
              className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 mb-4"
            />
            <button onClick={submit} disabled={!name.trim() || !sicil.trim() || busy} className="w-full py-3.5 rounded-2xl bg-white text-[#070c22] font-semibold disabled:opacity-40">
              {busy ? "Kaydediliyor…" : "Çekilişe katıl →"}
            </button>
            {err && <p className="mt-3 text-center text-[#ff9a9a] text-sm">{err}</p>}
          </>
        )}
      </div>
    </section>
  );
}

/** Duvarı gez — onaylı medya akışı (en yeni 150); ❤ beğen, "Benimkiler" filtresi. */
function BrowseGallery({ wallId, sessionId, myId }: { wallId: string | null; sessionId?: string; myId?: string }) {
  const [allMedia, setAllMedia] = useState<WallMedia[]>([]);
  useEffect(() => {
    if (!wallId) return;
    return watchWallMediaRecent(wallId, 150, setAllMedia);
  }, [wallId]);
  const approved = useMemo(
    () => allMedia.filter((m) => m.status === "approved" && (!sessionId || !m.sessionId || m.sessionId === sessionId)),
    [allMedia, sessionId]
  );
  const [mineOnly, setMineOnly] = useState(false);
  const voterId = myId || (typeof window !== "undefined" ? getVoterId() : "");

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
  const [removing, setRemoving] = useState(false);
  useEffect(() => setLiked(hasLikedMedia(m.id)), [m.id]);

  // Kendi yüklediğini silme: yalnız anonim uid ile eşleşen medyada (rules kapısı).
  // Doküman anında silinir; Cloudinary dosyası API ile temizlenir (başarısızsa
  // duvar silinirken prefix temizliği yakalar — misafir bekletilmez).
  const canDelete = mine && auth().currentUser?.uid === m.voterId;
  async function removeMine() {
    if (!wallId || removing) return;
    if (!confirm("Bu anı duvardan kalıcı olarak silinsin mi?")) return;
    setRemoving(true);
    try {
      const idToken = await auth().currentUser?.getIdToken();
      if (idToken) {
        fetch("/api/wall/destroy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallId, mediaId: m.id, idToken, mode: "guest" }),
        }).catch(() => {});
      }
      await deleteMedia(wallId, m.id);
    } catch {
      alert("Silinemedi — bağlantını kontrol edip tekrar dene.");
    } finally {
      setRemoving(false);
    }
  }

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
        {canDelete && (
          <button
            onClick={removeMine}
            disabled={removing}
            className="absolute top-1.5 right-1.5 w-7 h-7 grid place-items-center rounded-full bg-black/60 text-white text-xs disabled:opacity-50"
            aria-label="Bu anıyı sil"
            title="Kendi yüklediğini silebilirsin"
          >
            {removing ? "…" : "🗑"}
          </button>
        )}
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

/**
 * Sayfa içi kamera (vizör + deklanşör). Uygulama değiştirmediği için Android'in
 * düşük bellekte PWA'yı öldürüp kareyi kaybetmesi imkânsız. Arka arkaya çekim
 * desteklenir; "Bitti" ile kapanır. Kamera açılamazsa (izin/destek yok) cihaz
 * kamera uygulamasına düşme butonu gösterilir.
 */
function CameraSheet({ onShot, onClose, onFallback }: { onShot: (f: File) => void; onClose: () => void; onFallback: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [err, setErr] = useState(false);
  const [flash, setFlash] = useState(false);
  const [shots, setShots] = useState(0);

  useEffect(() => {
    let alive = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (!alive) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => setErr(true));
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function shoot() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 160);
    c.toBlob(
      (b) => {
        if (!b) return;
        onShot(new File([b], `cekim-${Date.now()}.jpg`, { type: "image/jpeg" }));
        setShots((n) => n + 1);
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {err ? (
        <div className="flex-1 grid place-items-center text-center px-8">
          <div>
            <p className="text-5xl mb-4" aria-hidden>📷</p>
            <p className="text-white font-semibold mb-2">Kamera açılamadı</p>
            <p className="text-white/60 text-sm mb-6">İzin verilmemiş olabilir — cihazın kamera uygulamasıyla da çekebilirsin.</p>
            <div className="flex flex-col gap-2">
              <button onClick={onFallback} className="rounded-2xl bg-white text-[#070c22] font-semibold py-3 px-6">Cihaz kamerasını aç</button>
              <button onClick={onClose} className="rounded-2xl border border-white/20 text-white/70 font-semibold py-3 px-6">Vazgeç</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <video ref={videoRef} playsInline muted className="flex-1 min-h-0 w-full object-cover" />
          {flash && <div className="absolute inset-0 bg-white/80" aria-hidden />}
          <div className="shrink-0 flex items-center justify-between px-8 py-5 bg-black">
            <button onClick={onClose} className="text-white/70 font-semibold py-2 px-3" aria-label="Kamerayı kapat">
              {shots > 0 ? `Bitti ✓ (${shots})` : "Vazgeç"}
            </button>
            <button
              onClick={shoot}
              aria-label="Fotoğraf çek"
              className="w-16 h-16 rounded-full bg-white ring-4 ring-white/30 active:scale-90 transition-transform"
            />
            <span className="w-16 text-right text-white/50 text-sm tabular-nums">{shots > 0 ? `${shots} kare` : ""}</span>
          </div>
        </>
      )}
    </div>
  );
}
