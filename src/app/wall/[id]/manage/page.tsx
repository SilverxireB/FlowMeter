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
import { downloadCollage } from "@/components/WallCollage";
import { generateMemoryBook } from "@/lib/wallMemoryBook";
import WallEffectLayer from "@/components/wall/WallEffectLayer";
import WallFilm from "@/components/wall/WallFilm";
import WallOnboarding from "@/components/wall/WallOnboarding";
import ConfirmDialog from "@/components/videowall/ConfirmDialog";
import { useAuthUser, useWall, useWallMedia, useWallWishes, useContestVotes } from "@/lib/hooks";
import { addWallMedia, clearContest, clearWallAnnouncement, closeWall, deleteMedia, deleteWish, endContest, isCurrentSession, newWallSession, reopenWall, setMediaStatus, setWallAnnouncement, setWallAutoInterval, setWallAutoModes, setWallEffect, setWallHeadline, setWallKeepOriginal, setWallMaxPerPerson, setWallMilestones, setWallModeration, setWallScreenMode, setWallTheme, setWallTopLovedInterval, setWallVideoLimit, setWallWishesEnabled, setWishStatus, startContest, tallyContest, wallMaxPerPerson, wallVideoLimitSec, startRaffle, endRaffle, setRaffleFields, clearRaffle, drawRaffle, watchRaffleEntries, watchDraws, bulkAddRaffleEntries, openRaffleRegistration, closeRaffleRegistration, raffleRegistrationOpen } from "@/lib/walls";
import { cldThumb, cldVideoPoster, isCloudinaryConfigured, uploadToCloudinary } from "@/lib/cloudinary";
import { WALL_THEME_PRESETS, wallThemeStyle } from "@/lib/themes";
import { compressImage } from "@/lib/images";
import { getVoterId } from "@/lib/responses";
import { BASE_WALL_SCREEN_MODES, RaffleDraw, RaffleEntry, Wall, WallMedia, WALL_EFFECTS, WALL_SCREEN_MODES, wallEffectOf } from "@/lib/types";

const AUTO_INTERVALS = [20, 30, 45, 60, 90];
const VIDEO_OPTS: [number, string][] = [[0, "Kapalı"], [15, "≤15 sn"], [30, "≤30 sn"], [60, "≤60 sn"]];
const PERPERSON_OPTS: [number, string][] = [[0, "Sınırsız"], [10, "10"], [20, "20"], [30, "30"]];
const RAFFLE_OPEN_OPTS: [number, string][] = [[0, "Süresiz"], [1, "1 dk"], [5, "5 dk"], [10, "10 dk"]];

/** Excel/CSV listesini {name, sicil} satırlarına ayıklar (xlsx lazy-load; CSV de okunur). */
async function parseRoster(file: File): Promise<{ name: string; sicil: string }[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, raw: false });
  if (!rows.length) return [];
  // Başlık tespiti: ilk satırda sicil/isim geçiyorsa sütunları eşle; yoksa A=sicil, B=isim.
  let start = 0, sicilCol = 0, nameCol = 1;
  const head = (rows[0] ?? []).map((c) => String(c ?? "").toLocaleLowerCase("tr-TR"));
  const si = head.findIndex((h) => h.includes("sicil") || h.includes("no"));
  const ni = head.findIndex((h) => h.includes("isim") || h.includes("ad") || h.includes("name") || h.includes("soyad"));
  if (si >= 0 || ni >= 0) {
    start = 1;
    if (si >= 0) sicilCol = si;
    if (ni >= 0) nameCol = ni;
  }
  const out: { name: string; sicil: string }[] = [];
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const sicil = String(row[sicilCol] ?? "").trim();
    const name = String(row[nameCol] ?? "").trim();
    if (sicil && name) out.push({ name, sicil });
  }
  return out;
}
const fmtInterval = (s: number) => (s < 60 ? `${s} sn` : s % 60 === 0 ? `${s / 60} dk` : `${(s / 60).toFixed(1)} dk`);
const ANN_MINUTES = [1, 2, 5, 10, 15, 30, 60];

export default function WallManage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { wall, loading } = useWall(id);
  const rawMedia = useWallMedia(id);
  // Kokpit yalnız AKTİF oturumu yönetir (yeni oturum → temiz kokpit). Eski
  // oturumun medyası Firestore/Cloudinary'de kalır; deleteWall hepsini siler.
  const allMedia = useMemo(() => rawMedia.filter((m) => isCurrentSession(m, wall)), [rawMedia, wall]);

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
  const wishes = useWallWishes(id);
  const pendingWishes = useMemo(() => wishes.filter((w) => (w.status ?? "approved") === "pending"), [wishes]);
  const approvedWishes = useMemo(() => wishes.filter((w) => (w.status ?? "approved") === "approved"), [wishes]);

  // Kokpit özeti — mevcut veriden hesaplanır (yeni koleksiyon yok).
  const stats = useMemo(() => {
    const byVoter = new Map<string, { count: number; name: string }>();
    for (const m of allMedia) {
      const k = m.voterId || "?";
      const e = byVoter.get(k) ?? { count: 0, name: m.nickname || "Misafir" };
      e.count += 1;
      if (m.nickname) e.name = m.nickname;
      byVoter.set(k, e);
    }
    let topContributor: { count: number; name: string } | null = null;
    for (const v of byVoter.values()) if (!topContributor || v.count > topContributor.count) topContributor = v;
    let mostLoved: WallMedia | null = null;
    for (const m of approved) if ((m.likes ?? 0) > 0 && (!mostLoved || (m.likes ?? 0) > (mostLoved.likes ?? 0))) mostLoved = m;
    const totalLikes = approved.reduce((s, m) => s + (m.likes ?? 0), 0);
    return { participants: byVoter.size, topContributor, mostLoved, totalLikes };
  }, [allMedia, approved]);

  // Sunucunun kendi medya eklemesi
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [upPct, setUpPct] = useState(0);
  const [upErr, setUpErr] = useState<string | null>(null);

  // Tümünü indir (ZIP) — tarayıcıda paketlenir, sunucu gerekmez
  const [zipping, setZipping] = useState(false);
  const [zipMsg, setZipMsg] = useState<string | null>(null);
  // Markalı onay penceresi (native confirm yerine — kurumsal profillerde bastırılabiliyor)
  const [confirmReq, setConfirmReq] = useState<{
    title: string; message: string; confirmLabel?: string; danger?: boolean; action: () => void;
  } | null>(null);
  const [bookMsg, setBookMsg] = useState<string | null>(null);
  const [contestTitle, setContestTitle] = useState("");
  const [contestMin, setContestMin] = useState(0); // 0 = süresiz
  const [tab, setTab] = useState<"ayarlar" | "moderasyon">("moderasyon");
  const contestVotes = useContestVotes(id);
  const contestRanking = useMemo(
    () => (wall?.contest ? tallyContest(contestVotes, wall.contest.id, allMedia) : []),
    [contestVotes, wall?.contest, allMedia]
  );
  // Yarışma geri sayımı dolunca kokpit otomatik bitirir (kazanan = anlık lider).
  const contestRankRef = useRef(contestRanking);
  contestRankRef.current = contestRanking;
  // Çekiliş kayıtları (kayıt türünde havuz = kayıtlar; kokpit çekimi bundan yapar).
  const [raffleEntries, setRaffleEntries] = useState<RaffleEntry[]>([]);
  useEffect(() => {
    if (wall?.raffle?.type !== "registration") { setRaffleEntries([]); return; }
    return watchRaffleEntries(id, setRaffleEntries);
  }, [id, wall?.raffle?.type]);
  const rosterRef = useRef<HTMLInputElement>(null);
  const [rosterMsg, setRosterMsg] = useState<string | null>(null);
  // Çekiliş sonuçları (kalıcı log — Bitir/Sil sonrası da görünür).
  const [draws, setDraws] = useState<RaffleDraw[]>([]);
  useEffect(() => watchDraws(id, setDraws), [id]);
  // Çekim kilidi: animasyon bitene kadar yeni "Çek!" engellenir (yanlışlıkla çift çekim yok).
  const [drawing, setDrawing] = useState(false);
  async function doDraw() {
    if (drawing || !wall?.raffle) return;
    const wc = Math.max(1, wall.raffle.winnersCount ?? 1);
    const ss = wall.raffle.suspenseSec ?? 7;
    const lockMs = 3000 + wc * (ss * 1000 + 5000) + 5000; // ~animasyon süresi
    setDrawing(true);
    window.setTimeout(() => setDrawing(false), lockMs);
    try {
      await drawRaffle(wall, raffleEntries);
    } catch (e) {
      setDrawing(false);
      setZipMsg(`Çekim başarısız: ${e instanceof Error ? e.message : "tekrar dene"}`);
    }
  }
  async function onRoster(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (rosterRef.current) rosterRef.current.value = "";
    if (!f) return;
    setRosterMsg("Okunuyor…");
    try {
      const rows = await parseRoster(f);
      if (!rows.length) { setRosterMsg("Liste boş / sütunlar okunamadı (1. sütun sicil, 2. isim)."); return; }
      const n = await bulkAddRaffleEntries(id, rows);
      setRosterMsg(`✓ ${n} kişi eklendi`);
    } catch (err) {
      setRosterMsg(err instanceof Error ? err.message : "Dosya okunamadı.");
    }
  }
  const [annText, setAnnText] = useState("");
  const [annMin, setAnnMin] = useState(2);
  const [annNow, setAnnNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAnnNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    const c = wall?.contest;
    const ends = c?.endsAt?.toMillis?.() ?? 0;
    if (c?.status === "running" && ends && annNow >= ends) {
      endContest(id, contestRankRef.current[0]?.mediaId ?? null).catch(console.error);
    }
  }, [wall?.contest, annNow, id]);
  // Çekiliş kayıt penceresi dolunca kapat (organizatör cihazı).
  useEffect(() => {
    const r = wall?.raffle;
    const until = r?.registerUntil?.toMillis?.() ?? 0;
    if (r?.type === "registration" && r.registerOpen !== false && until && annNow >= until) {
      closeRaffleRegistration(id).catch(console.error);
    }
  }, [wall?.raffle, annNow, id]);

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
      // Misafir yüklemesiyle aynı kural: "Orijinal kalite" ayarına saygı
      const res = await uploadToCloudinary(f, `walls/${id}/${wall.sessionId ?? "s"}`, setUpPct, { keepOriginal: !!wall.keepOriginal });
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
          <Link href="/dashboard?p=walls" className="text-muted hover:text-ink shrink-0 text-lg">←</Link>
          <Logo variant="wall" />
          <span className="font-display font-semibold truncate">{wall.title}</span>
        </div>
        <a href={`/wall/${id}`} target="_blank" className="btn-primary !py-2 !px-4 text-sm shrink-0">
          ▶ Perde ekranı ↗
        </a>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        {/* İşlem mesajları: hangi sekmede olursan ol görünür (ZIP, silme, çekim…) */}
        {zipMsg && (
          <div className="rounded-2xl bg-white border border-line px-4 py-3 text-sm text-ink/80 shadow-sm flex items-start justify-between gap-3">
            <span>{zipMsg}</span>
            <button onClick={() => setZipMsg(null)} className="text-muted hover:text-ink shrink-0" aria-label="Kapat">✕</button>
          </div>
        )}

        {/* İlk-kullanım rehberi (duvar tazeyken; kapatılabilir) */}
        <WallOnboarding wall={wall} joinUrl={joinUrl} mediaCount={approved.length} onGoSettings={() => setTab("ayarlar")} />

        {/* Kokpit özeti */}
        <div className="card p-5">
          <p className="eyebrow mb-3">Özet</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Anı" value={approved.length} sub={pending.length ? `${pending.length} onay bekliyor` : undefined} />
            <StatTile label="Katılımcı" value={stats.participants} />
            <StatTile label="Toplam ❤" value={stats.totalLikes} />
            <StatTile label="Dilek" value={wishes.length} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className="rounded-xl border border-line p-3 flex items-center gap-2 min-w-0">
              <span className="text-xl shrink-0" aria-hidden>🔥</span>
              <div className="min-w-0">
                <p className="text-muted text-xs">En aktif</p>
                <p className="font-semibold text-sm truncate">
                  {stats.topContributor ? `${stats.topContributor.name} · ${stats.topContributor.count} anı` : "—"}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-line p-3 flex items-center gap-2 min-w-0">
              {stats.mostLoved ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cldThumb(stats.mostLoved.url, 80, 80)} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
              ) : (
                <span className="text-xl shrink-0" aria-hidden>👑</span>
              )}
              <div className="min-w-0">
                <p className="text-muted text-xs">En sevilen</p>
                <p className="font-semibold text-sm truncate">
                  {stats.mostLoved ? `❤ ${stats.mostLoved.likes} · ${stats.mostLoved.nickname || "Misafir"}` : "Henüz beğeni yok"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sekmeler — ayarlar çok büyüdüğü için moderasyon ayrı sekmede */}
        <div className="flex gap-1 rounded-2xl bg-paper border border-line p-1 sticky top-2 z-20">
          {([
            ["ayarlar", "⚙ Sunum ayarları"],
            ["moderasyon", "🛡 Moderasyon"],
          ] as const).map(([t, label]) => {
            const badge = t === "moderasyon" ? pending.length + pendingWishes.length : 0;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  tab === t ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {label}
                {badge > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-brand text-white text-[11px] font-bold px-1.5 py-0.5 tabular-nums align-middle">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === "ayarlar" && (
          <>
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
              <button
                onClick={() => wall && downloadCollage(wall, allMedia)}
                disabled={approved.length === 0}
                className="btn-ghost !py-2 !px-4 text-sm"
              >
                🖼 Kolaj indir
              </button>
              <button
                onClick={async () => {
                  if (!wall || approved.length === 0 || bookMsg) return;
                  setBookMsg("Hazırlanıyor…");
                  try {
                    await generateMemoryBook(wall, allMedia, wishes, (d, t) => setBookMsg(`${d}/${t} hazırlanıyor…`));
                    setBookMsg(null);
                  } catch {
                    setBookMsg("Hata — tekrar dene");
                    setTimeout(() => setBookMsg(null), 3000);
                  }
                }}
                disabled={approved.length === 0 || !!bookMsg}
                className="btn-ghost !py-2 !px-4 text-sm"
              >
                {bookMsg ? `📖 ${bookMsg}` : "📖 Hatıra kitabı (PDF)"}
              </button>

            </div>
          </div>
        </div>

        {/* Yaşam döngüsü — kapat / aç / yeni oturum */}
        {wall && (
          <div className="card p-5">
            <p className="eyebrow mb-3">Yaşam döngüsü</p>
            <div className="flex flex-wrap items-center gap-3">
              {wall.closed ? (
                <button onClick={() => reopenWall(id).catch(console.error)} className="btn-ghost !py-2 text-sm">▶ Duvarı yeniden aç</button>
              ) : (
                <button
                  onClick={() => setConfirmReq({ title: "Duvarı kapat", message: 'Yükleme durur, perdede "🎉 Teşekkürler" görünür. Yeniden açabilir ya da yeni oturum başlatabilirsin.', confirmLabel: "Kapat", action: () => closeWall(id).catch(() => setZipMsg("Duvar kapatılamadı — tekrar dene.")) })}
                  className="btn-ghost !py-2 text-sm"
                >
                  ⏹ Duvarı kapat
                </button>
              )}
              <button
                onClick={() => setConfirmReq({ title: "Yeni oturum", message: "Şu anki anılar perdeden ve kokpitten kalkar (SİLİNMEZ — arşivde kalır); duvar ikinci grup için temizlenir.", confirmLabel: "Yeni oturum başlat", action: () => newWallSession(id).catch(() => setZipMsg("Yeni oturum başlatılamadı — tekrar dene.")) })}
                className="btn-primary !py-2 text-sm"
              >
                🔄 Yeni oturum
              </button>
              <span className="text-xs text-muted">
                {wall.closed ? "Kapalı — yükleme durdu." : "Açık — misafirler yükleyebilir."}
              </span>
            </div>
          </div>
        )}

        {/* Anı Filmi — highlight video üretimi */}
        {wall && <WallFilm wall={wall} media={allMedia} wishes={wishes} />}

        {/* İçerik izinleri — etkinlik başına video / dilek aç-kapa */}
        <div className="card p-5">
          <p className="eyebrow mb-3">İçerik izinleri & sınırlar</p>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold mb-1.5">🎬 Video <span className="text-muted font-normal">— süre limiti (kredi koruması)</span></p>
              <div className="flex gap-1.5 flex-wrap">
                {VIDEO_OPTS.map(([sec, lbl]) => (
                  <button key={sec} onClick={() => setWallVideoLimit(id, sec).catch(console.error)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${wallVideoLimitSec(wall) === sec ? "bg-accent text-white border-accent" : "border-line text-ink"}`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1.5">📸 Kişi başı en fazla foto <span className="text-muted font-normal">— spam/tekel önler</span></p>
              <div className="flex gap-1.5 flex-wrap">
                {PERPERSON_OPTS.map(([n, lbl]) => (
                  <button key={n} onClick={() => setWallMaxPerPerson(id, n).catch(console.error)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${wallMaxPerPerson(wall) === n ? "bg-accent text-white border-accent" : "border-line text-ink"}`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={wall.wishesEnabled !== false}
                onChange={(e) => setWallWishesEnabled(id, e.target.checked).catch(console.error)}
                className="w-5 h-5 accent-[#4f46e5]"
              />
              <span className="text-sm font-semibold">💌 Dilekler <span className="text-muted font-normal">{wall.wishesEnabled !== false ? "— açık" : "— kapalı (misafirde dilek sekmesi yok)"}</span></span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!wall.keepOriginal}
                onChange={(e) => setWallKeepOriginal(id, e.target.checked).catch(console.error)}
                className="w-5 h-5 accent-[#4f46e5]"
              />
              <span className="text-sm font-semibold">🖼 Orijinal kalite <span className="text-muted font-normal">{wall.keepOriginal ? "— açık (tam çözünürlük saklanır, daha çok depolama)" : "— kapalı (görseller ~1920px'e küçültülür, depolama dostu)"}</span></span>
            </label>
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

            {/* Ambient efekt (temadan bağımsız) */}
            <div className="mt-5">
              <p className="text-sm font-semibold mb-2">Efekt</p>
              <div className="flex flex-wrap gap-2">
                {WALL_EFFECTS.map((e) => {
                  const active = wallEffectOf(wall) === e.id;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setWallEffect(id, e.id).catch(console.error)}
                      className={`!py-1.5 !px-3 text-xs rounded-full font-semibold border ${
                        active ? "border-accent bg-accent-soft/50 text-accent" : "border-line text-muted hover:text-ink"
                      }`}
                    >
                      {e.icon} {e.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Önizleme */}
          <div className="w-full md:w-64 shrink-0">
            <p className="eyebrow mb-3">Perde önizlemesi</p>
            <WallPreview wall={wall} />
          </div>
        </div>

        {/* Perde modu seçici */}
        <div className="card p-5">
          <p className="eyebrow mb-1">Perde modu</p>
          <p className="text-muted text-xs mb-3">Anıların perdede nasıl görüneceğini seç — canlı olarak değişir.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {WALL_SCREEN_MODES.map((m) => {
              const active = (wall?.screenMode ?? "stage") === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setWallScreenMode(id, m.id).catch(console.error)}
                  className={`text-left rounded-xl border-2 p-3 transition-all ${
                    active ? "border-accent bg-accent-soft/40 ring-2 ring-accent-soft" : "border-line hover:border-muted"
                  }`}
                  title={m.hint}
                >
                  <div className="text-2xl mb-1" aria-hidden>{m.icon}</div>
                  <div className="font-semibold text-sm">{m.name}</div>
                  <div className="text-muted text-[11px] leading-tight mt-0.5 line-clamp-2">{m.hint}</div>
                </button>
              );
            })}
          </div>

          {/* Otomatik mod ayarları */}
          {wall?.screenMode === "auto" && (
            <div className="mt-4 rounded-xl border border-line bg-paper/60 p-4 flex flex-col gap-4 animate-pop">
              <div>
                <p className="text-sm font-semibold mb-2">Geçiş aralığı</p>
                <div className="flex flex-wrap gap-2">
                  {AUTO_INTERVALS.map((s) => {
                    const active = (wall?.autoIntervalSec ?? 30) === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setWallAutoInterval(id, s).catch(console.error)}
                        className={`!py-1.5 !px-3 text-xs rounded-full font-semibold border tabular-nums ${
                          active ? "border-accent bg-accent-soft/50 text-accent" : "border-line text-muted hover:text-ink"
                        }`}
                      >
                        {fmtInterval(s)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Hangi modlar dönsün</p>
                <div className="flex flex-wrap gap-2">
                  {BASE_WALL_SCREEN_MODES.map((m) => {
                    const baseIds = BASE_WALL_SCREEN_MODES.map((x) => x.id);
                    const chosen = wall?.autoModes && wall.autoModes.length ? wall.autoModes : baseIds;
                    const on = chosen.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          const set = new Set(chosen);
                          if (set.has(m.id)) {
                            if (set.size <= 1) return; // en az bir mod kalmalı
                            set.delete(m.id);
                          } else {
                            set.add(m.id);
                          }
                          setWallAutoModes(id, baseIds.filter((x) => set.has(x))).catch(console.error);
                        }}
                        className={`!py-1.5 !px-3 text-xs rounded-full font-semibold border ${
                          on ? "border-accent bg-accent-soft/50 text-accent" : "border-line text-muted hover:text-ink"
                        }`}
                      >
                        {on ? "✓ " : ""}{m.icon} {m.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-muted text-xs mt-2">En az bir mod seçili kalmalı. Perde bu modlar arasında {fmtInterval(wall?.autoIntervalSec ?? 30)}&apos;de bir değişir.</p>
              </div>
            </div>
          )}
        </div>

        {/* En Sevilenler turu sıklığı */}
        <div className="card p-5">
          <p className="eyebrow mb-1">✨ En Sevilenler turu</p>
          <p className="text-muted text-xs mb-3">Perdede belirli aralıklarla en çok beğenilen ilk 3 anı öne çıkar (#1 = günün karesi).</p>
          <div className="flex flex-wrap gap-2">
            {[{ s: 0, l: "Kapalı" }, { s: 60, l: "1 dk" }, { s: 120, l: "2 dk" }, { s: 300, l: "5 dk" }, { s: 600, l: "10 dk" }].map((o) => {
              const active = (wall?.topLovedEverySec ?? 120) === o.s;
              return (
                <button
                  key={o.s}
                  onClick={() => setWallTopLovedInterval(id, o.s).catch(console.error)}
                  className={`!py-1.5 !px-3 text-xs rounded-full font-semibold border ${
                    active ? "border-accent bg-accent-soft/50 text-accent" : "border-line text-muted hover:text-ink"
                  }`}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none mt-4 pt-4 border-t border-line">
            <input
              type="checkbox"
              checked={wall.milestones !== false}
              onChange={(e) => setWallMilestones(id, e.target.checked).catch(console.error)}
              className="w-5 h-5 accent-[#4f46e5]"
            />
            <span className="text-sm font-semibold">🎉 Milestone kutlamaları <span className="text-muted font-normal">(10, 25, 50, 100… anıda konfeti)</span></span>
          </label>
        </div>

          </>
        )}

        {tab === "moderasyon" && (
          <>
        {/* Canlı anons */}
        {(() => {
          const annUntil = wall.announcement?.until?.toMillis?.() ?? 0;
          const annActive = Boolean(wall.announcement?.text) && annUntil > annNow;
          const remain = Math.max(0, Math.round((annUntil - annNow) / 1000));
          return (
            <details className="card p-5">
              <summary className="eyebrow cursor-pointer select-none">📢 Canlı anons{annActive ? " · 🔴 yayında" : ""}</summary>
              <p className="text-muted text-xs mb-3 mt-3">Perdeye seçtiğin süre boyunca öne çıkan bir duyuru bas (ör. &quot;Kokteyller dağıtılıyor&quot;). Süre dolunca kendiliğinden kalkar.</p>

              {annActive && (
                <div className="mb-4 rounded-2xl bg-accent-soft/50 border border-accent/30 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">📢 {wall.announcement?.text}</p>
                    <p className="text-muted text-xs tabular-nums">Perdede · kalan {Math.floor(remain / 60)}:{String(remain % 60).padStart(2, "0")}</p>
                  </div>
                  <button onClick={() => clearWallAnnouncement(id).catch(console.error)} className="btn-ghost !py-1.5 !px-3 text-xs !text-brand !border-brand shrink-0">
                    Kaldır
                  </button>
                </div>
              )}

              <input
                value={annText}
                onChange={(e) => setAnnText(e.target.value.slice(0, 160))}
                placeholder="Anons metni (ör. Yemek servisi başladı 🍽)"
                className="input-base !py-2 text-sm mb-3"
              />
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="text-muted text-xs">Süre:</span>
                {ANN_MINUTES.map((m) => (
                  <button
                    key={m}
                    onClick={() => setAnnMin(m)}
                    className={`!py-1.5 !px-3 text-xs rounded-full font-semibold border tabular-nums ${
                      annMin === m ? "border-accent bg-accent-soft/50 text-accent" : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    {m} dk
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  if (!annText.trim()) return;
                  setWallAnnouncement(id, annText, annMin).then(() => setAnnText("")).catch(console.error);
                }}
                disabled={!annText.trim()}
                className="btn-accent !py-2 !px-5 text-sm disabled:opacity-40"
              >
                {annActive ? "Yeni anonsu yayınla" : "Yayınla"} →
              </button>
            </details>
          );
        })()}

        {/* Foto yarışması */}
        <details className="card p-5">
          <summary className="eyebrow mb-1 cursor-pointer select-none">🏆 Foto yarışması{wall.contest?.status === "running" ? " · 🔴 canlı" : ""}</summary>
          {!wall.contest ? (
            <>
              <p className="text-muted text-xs mb-3">Başlık ver, başlat; misafirler onaylı fotolara oy verir, kazanan perdede taçlanır. Süre eklersen geri sayım dolunca otomatik biter (kazanan = anlık lider).</p>
              <div className="flex gap-2 flex-wrap items-center">
                <input value={contestTitle} onChange={(e) => setContestTitle(e.target.value.slice(0, 80))} placeholder="Yarışma başlığı (ör. En iyi kostüm)" className="input-base !py-2 text-sm flex-1 min-w-[200px]" />
                <button onClick={() => { if (contestTitle.trim()) startContest(id, contestTitle, contestMin).then(() => setContestTitle("")).catch(console.error); }} disabled={!contestTitle.trim()} className="btn-accent !py-2 !px-5 text-sm disabled:opacity-40">Başlat →</button>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="text-muted text-xs">Süre:</span>
                {[[0, "Süresiz"], [1, "1 dk"], [2, "2 dk"], [5, "5 dk"], [10, "10 dk"]].map(([m, lbl]) => (
                  <button key={m} onClick={() => setContestMin(m as number)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${contestMin === m ? "bg-accent text-white border-accent" : "border-line text-ink"}`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </>
          ) : wall.contest.status === "running" ? (
            <>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <p className="font-semibold text-sm truncate">🔴 {wall.contest.title} <span className="text-muted font-normal">· {contestVotes.length} oy</span></p>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => endContest(id, contestRanking[0]?.mediaId ?? null).catch(console.error)} className="btn-accent !py-1.5 !px-3 text-xs">Bitir & ilan et</button>
                  <button onClick={() => clearContest(id).catch(console.error)} className="!py-1.5 !px-3 text-xs rounded-full border border-line text-brand font-semibold">İptal</button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {contestRanking.slice(0, 5).map((r, i) => {
                  const m = allMedia.find((x) => x.id === r.mediaId);
                  return (
                    <div key={r.mediaId} className="flex items-center gap-2 text-sm">
                      <span className="text-muted w-4 tabular-nums">{i + 1}</span>
                      {m && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cldThumb(m.url, 60, 60)} alt="" className="w-8 h-8 rounded object-cover" />
                      )}
                      <span className="flex-1 truncate">{m?.nickname || "—"}</span>
                      <span className="font-bold tabular-nums">{r.count} oy</span>
                    </div>
                  );
                })}
                {contestRanking.length === 0 && <p className="text-muted text-sm">Henüz oy yok.</p>}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="font-semibold text-sm">🏆 Bitti: {wall.contest.title}{wall.contest.winnerMediaId ? " · kazanan ilan edildi" : ""}</p>
              <button onClick={() => clearContest(id).catch(console.error)} className="btn-ghost !py-1.5 !px-3 text-xs">Kapat / Yeni</button>
            </div>
          )}
        </details>

        {/* Çekiliş */}
        <details className="card p-5">
          <summary className="eyebrow mb-1 cursor-pointer select-none">🎁 Çekiliş{wall.raffle ? " · kurulu" : ""}</summary>
          {!wall.raffle ? (
            <div className="mt-3">
              <p className="text-muted text-xs mb-3">Perdede büyük animasyonlu çekim. Tür seç: misafirler isim+sicil girer (veya Excel liste yüklersin) · ya da numara aralığı.</p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => startRaffle(id, "registration").catch(console.error)} className="btn-accent !py-2 !px-4 text-sm">İsim + sicil / Excel liste</button>
                <button onClick={() => startRaffle(id, "number").catch(console.error)} className="btn-ghost !py-2 !px-4 text-sm">Numara aralığı</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <input
                defaultValue={wall.raffle.prize ?? ""}
                onBlur={(e) => setRaffleFields(id, { prize: e.target.value.slice(0, 60) }).catch(console.error)}
                placeholder="Ödül (ör. iPhone, hediye çeki…)"
                className="input-base !py-2 text-sm"
              />
              {wall.raffle.type === "number" ? (
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="text-muted">Numara aralığı:</span>
                  <input type="number" defaultValue={wall.raffle.min ?? 1} onBlur={(e) => setRaffleFields(id, { min: Math.max(0, Number(e.target.value) || 1) }).catch(console.error)} className="input-base !py-1.5 w-24 text-sm" />
                  <span>–</span>
                  <input type="number" defaultValue={wall.raffle.max ?? 100} onBlur={(e) => setRaffleFields(id, { max: Math.max(1, Number(e.target.value) || 100) }).catch(console.error)} className="input-base !py-1.5 w-24 text-sm" />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap text-sm">
                    <span className="text-muted">Misafir kaydı:</span>
                    <button onClick={() => closeRaffleRegistration(id).catch(console.error)} className={`px-3 py-1 rounded-full text-xs font-semibold border ${!raffleRegistrationOpen(wall) ? "bg-ink text-white border-ink" : "border-line text-ink"}`}>Kapalı</button>
                    {RAFFLE_OPEN_OPTS.map(([m, l]) => (
                      <button key={m} onClick={() => openRaffleRegistration(id, m).catch(console.error)} className="px-3 py-1 rounded-full text-xs font-semibold border border-line text-ink hover:border-accent">
                        {m === 0 ? "Aç" : l}
                      </button>
                    ))}
                    <span className="text-muted text-xs tabular-nums ml-auto">👥 {raffleEntries.length}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => rosterRef.current?.click()} className="btn-ghost !py-1.5 !px-3 text-xs">📋 Liste yükle (Excel/CSV)</button>
                    <input ref={rosterRef} type="file" accept=".xlsx,.xls,.csv" onChange={onRoster} className="hidden" />
                    <span className="text-muted text-[11px]">1. sütun sicil · 2. sütun isim</span>
                    {rosterMsg && <span className="text-xs text-ink w-full">{rosterMsg}</span>}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="text-muted">Kazanan:</span>
                {[1, 2, 3, 5].map((n) => (
                  <button key={n} onClick={() => setRaffleFields(id, { winnersCount: n }).catch(console.error)} className={`px-3 py-1 rounded-full text-xs font-semibold border ${(wall.raffle!.winnersCount ?? 1) === n ? "bg-accent text-white border-accent" : "border-line text-ink"}`}>{n}</button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="text-muted">Heyecan süresi:</span>
                {([[4, "Kısa"], [7, "Orta"], [12, "Uzun"]] as [number, string][]).map(([s, l]) => (
                  <button key={s} onClick={() => setRaffleFields(id, { suspenseSec: s }).catch(console.error)} className={`px-3 py-1 rounded-full text-xs font-semibold border ${(wall.raffle!.suspenseSec ?? 7) === s ? "bg-accent text-white border-accent" : "border-line text-ink"}`}>{l}</button>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap items-center pt-1">
                <button onClick={doDraw} disabled={drawing} className="btn-primary !py-2 !px-5 text-sm disabled:opacity-50">
                  {drawing ? "🎬 Çekiliyor…" : "🎉 Çek!"}
                </button>
                <button onClick={() => setConfirmReq({ title: "Çekilişi bitir", message: "Perdeden kalkar; kayıtlar SİLİNMEZ.", confirmLabel: "Bitir", action: () => endRaffle(id).catch(() => setZipMsg("Çekiliş bitirilemedi — tekrar dene.")) })} className="btn-ghost !py-2 !px-4 text-sm">Bitir</button>
                <button onClick={() => setConfirmReq({ title: "Çekilişi sil", message: "Çekiliş ve TÜM kayıtlar silinir. Geri alınamaz.", confirmLabel: "Sil", danger: true, action: () => clearRaffle(id).catch(() => setZipMsg("Çekiliş silinemedi — tekrar dene.")) })} className="!py-2 !px-3 text-sm rounded-full border border-line text-brand font-semibold">🗑 Sil</button>
                {wall.raffle.draw?.winners?.length ? (
                  <span className="text-xs text-muted truncate w-full">Son çekim: {wall.raffle.draw.winners.map((w) => w.label).join(", ")}</span>
                ) : null}
              </div>
            </div>
          )}
        </details>

        {/* Çekiliş sonuçları — kalıcı log (Bitir/Sil sonrası da görünür) */}
        {draws.length > 0 && (
          <details className="card p-5">
            <summary className="eyebrow mb-1 cursor-pointer select-none">🏆 Çekiliş sonuçları ({draws.length})</summary>
            <div className="mt-3 flex flex-col gap-3">
              {draws.map((d) => (
                <div key={d.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{d.prize || (d.type === "number" ? "Numara çekilişi" : "Çekiliş")}</p>
                    <span className="text-muted text-xs tabular-nums">
                      {d.createdAt?.toDate?.().toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) ?? ""}
                      {d.poolSize ? ` · havuz ${d.poolSize}` : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {d.winners?.map((w, i) => (
                      <span key={i} className="rounded-full bg-accent-soft text-accent-dark px-3 py-1 text-xs font-semibold">
                        🏅 {w.label}{w.sub ? ` · ${w.sub}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Dilek moderasyonu */}
        {(pendingWishes.length > 0 || approvedWishes.length > 0) && (
          <div className="card p-5">
            <p className="eyebrow mb-1">💌 Dilekler</p>
            <p className="text-muted text-xs mb-3">
              {wall.moderation ? "Moderasyon açık — dilekler onaydan sonra perdeye düşer." : "Moderasyon kapalı — dilekler direkt perdede."}
            </p>

            {pendingWishes.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold mb-2">Onay bekleyen ({pendingWishes.length})</p>
                <div className="flex flex-col gap-2">
                  {pendingWishes.map((w) => (
                    <div key={w.id} className="rounded-xl border border-line p-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{w.text}</p>
                        {w.nickname && <p className="text-muted text-xs">— {w.nickname}</p>}
                      </div>
                      <button onClick={() => setWishStatus(id, w.id, "approved").catch(console.error)} className="!py-1.5 !px-3 text-xs rounded-full font-semibold border border-accent text-accent hover:bg-accent-soft/50 shrink-0">✓ Onayla</button>
                      <button onClick={() => setWishStatus(id, w.id, "rejected").catch(console.error)} className="!py-1.5 !px-3 text-xs rounded-full font-semibold border border-line text-brand shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {approvedWishes.length > 0 && (
              <div>
                <p className="text-muted text-xs mb-2">Perdede ({approvedWishes.length})</p>
                <div className="flex flex-col gap-1.5">
                  {approvedWishes.map((w) => (
                    <div key={w.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 min-w-0 truncate">💌 {w.text}{w.nickname ? ` — ${w.nickname}` : ""}</span>
                      <button onClick={() => deleteWish(id, w.id).catch(console.error)} className="text-muted hover:text-brand text-xs shrink-0" aria-label="Sil">🗑</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
                    <button onClick={() => setConfirmReq({ title: "Kalıcı silme", message: "Bu medya Cloudinary'den ve duvardan KALICI olarak silinsin mi?", confirmLabel: "Kalıcı sil", danger: true, action: () => hardDelete(m) })} className="btn-ghost !py-1.5 !px-2.5 text-xs !border-brand !text-brand" title="Kalıcı sil (Cloudinary dahil)">🗑</button>
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
                    <button onClick={() => setConfirmReq({ title: "Kalıcı silme", message: "Bu medya Cloudinary'den ve duvardan KALICI olarak silinsin mi?", confirmLabel: "Kalıcı sil", danger: true, action: () => hardDelete(m) })} className="btn-ghost !py-1.5 !px-2.5 text-xs !border-brand !text-brand" title="Kalıcı sil (Cloudinary dahil)">🗑</button>
                  </div>
                </MediaCard>
              ))}
            </div>
          </section>
        )}
          </>
        )}
      </div>

      {/* Markalı onay penceresi */}
      {confirmReq && (
        <ConfirmDialog
          title={confirmReq.title}
          message={confirmReq.message}
          confirmLabel={confirmReq.confirmLabel}
          danger={confirmReq.danger}
          onConfirm={() => {
            confirmReq.action();
            setConfirmReq(null);
          }}
          onCancel={() => setConfirmReq(null)}
        />
      )}
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

function StatTile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-line p-3 text-center">
      <p className="font-display text-3xl font-bold tabular-nums leading-none">{value}</p>
      <p className="text-muted text-xs mt-1.5">{label}</p>
      {sub && <p className="text-accent text-[11px] mt-0.5">{sub}</p>}
    </div>
  );
}

function WallPreview({ wall }: { wall: Wall }) {
  const { style, dark } = wallThemeStyle(wall?.theme);
  const textClass = dark ? "text-white" : "text-ink";
  const mutedClass = dark ? "text-white/60" : "text-ink/55";

  return (
    <div className={`w-full aspect-video rounded-xl overflow-hidden shadow-inner border border-line relative flex flex-col items-center justify-center ${textClass}`} style={style}>
      <WallEffectLayer effect={wallEffectOf(wall)} contained />
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
