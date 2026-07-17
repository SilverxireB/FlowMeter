"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import Logo from "@/components/Logo";
import QrCode from "@/components/present/QrCode";
import ChatPanel from "@/components/present/ChatPanel";
import Leaderboard from "@/components/present/Leaderboard";
import LeaderboardSlide from "@/components/present/LeaderboardSlide";
import ParticipantCloud from "@/components/present/ParticipantCloud";
import ReactionOverlay from "@/components/present/ReactionOverlay";
import BarChartResult from "@/components/results/BarChartResult";
import Grid2x2Result from "@/components/results/Grid2x2Result";
import GuessNumberResult from "@/components/results/GuessNumberResult";
import HundredPointsResult from "@/components/results/HundredPointsResult";
import OpenEndedResult from "@/components/results/OpenEndedResult";
import PinOnImageResult from "@/components/results/PinOnImageResult";
import QnaResult from "@/components/results/QnaResult";
import QuizResult from "@/components/results/QuizResult";
import QuizTypeResult from "@/components/results/QuizTypeResult";
import RankingResult from "@/components/results/RankingResult";
import ScalesResult from "@/components/results/ScalesResult";
import WordCloudResult from "@/components/results/WordCloudResult";
import {
  useAuthUser,
  useLiveResponses,
  useParticipants,
  usePresentation,
  useSlides,
} from "@/lib/hooks";
import {
  endPresentation,
  resetResponses,
  setCurrentSlide,
  setVotingClosed,
  startQuiz,
} from "@/lib/presentations";
import { isScoringSlide } from "@/lib/quizScores";
import { startQuizMusic, stopQuizMusic } from "@/lib/quizMusic";
import { themeStyle } from "@/lib/themes";
import { withTimeout } from "@/lib/withTimeout";
import { INTERACTIVE_SLIDE_TYPES, SLIDE_TYPE_ICONS, SLIDE_TYPE_LABELS } from "@/lib/types";

/**
 * Sunum modu. index -1 = katılım ekranı (büyük QR + kod + gelen isimler),
 * 0..n-1 = slaytlar (köşede mini QR kartı — geç gelenler de katılabilsin).
 * Klavye ←/→ ile gezinir; "atlandı" işaretli slaytların üzerinden geçer.
 */
export default function PresentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { presentation, loading: presLoading } = usePresentation(id);
  const { slides } = useSlides(id);
  const [slow, setSlow] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const sessionId = presentation?.sessionId;
  const participants = useParticipants(id, sessionId);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [host, setHost] = useState("flowmeter");
  const [hideResults, setHideResults] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  const rawIndex = presentation?.currentSlideIndex ?? -1;
  const index = Math.min(rawIndex, slides.length - 1);
  const slide = rawIndex < 0 ? undefined : slides[index];
  const responses = useLiveResponses(id, slide?.id ?? null, sessionId);

  /** dir yönünde, atlanmayan bir sonraki slayt index'i (-1 = katılım ekranı). */
  function nextVisibleIndex(from: number, dir: -1 | 1): number | null {
    let i = from + dir;
    while (i >= 0 && i < slides.length && slides[i]?.settings?.skipped) i += dir;
    if (dir === -1 && i <= -1) return from > -1 ? -1 : null;
    if (i < -1 || i >= slides.length) return null;
    return i;
  }

  function go(dir: -1 | 1) {
    const next = nextVisibleIndex(rawIndex, dir);
    if (next === null) return;
    setWriteError(null);
    withTimeout(setCurrentSlide(id, next)).catch((err) => {
      setWriteError(err instanceof Error ? err.message : "Slayt değiştirilemedi, tekrar dene.");
      setTimeout(() => setWriteError(null), 8000);
    });
  }

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // Doküman uzun süre gelmezse "bağlantı kurulamıyor" ipucu göster
  useEffect(() => {
    if (presentation) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, [presentation]);

  // Sunum ekranı açılınca canlı yayına al — katılım (QR) ekranından başla
  useEffect(() => {
    if (presentation && !presentation.isLive) {
      setCurrentSlide(id, -1);
    }
  }, [presentation, id]);

  useEffect(() => {
    setHost(window.location.host);
    if (presentation?.joinCode) {
      setJoinUrl(`${window.location.origin}/join/${presentation.joinCode}`);
    }
  }, [presentation?.joinCode]);

  // Quiz slaytı açılınca geri sayımı bir kez başlat
  useEffect(() => {
    if ((slide?.type === "quiz" || slide?.type === "quiz-type") && !slide.quizStartedAt) {
      startQuiz(id, slide.id);
    }
  }, [id, slide]);

  // Quiz müziği: geri sayım sürerken çal, süre dolunca / slayt değişince sus
  useEffect(() => {
    const isQuiz = slide?.type === "quiz" || slide?.type === "quiz-type";
    if (!isQuiz || !slide?.settings?.music || !slide.quizStartedAt) {
      stopQuizMusic();
      return;
    }
    const endMs = slide.quizStartedAt.toMillis() + (slide.settings?.timeLimit ?? 20) * 1000;
    if (Date.now() >= endMs) {
      stopQuizMusic();
      return;
    }
    startQuizMusic();
    const t = window.setTimeout(stopQuizMusic, endMs - Date.now());
    return () => {
      window.clearTimeout(t);
      stopQuizMusic();
    };
  }, [slide]);

  // Klavye ile gezinme (←/→), -1 katılım ekranına kadar geri gidilebilir
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, rawIndex, slides]);

  if (!presentation) {
    const stillLoading = presLoading || authLoading;
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-wash text-center px-6">
        {stillLoading ? (
          <>
            <p className="text-muted animate-pulse">Yükleniyor…</p>
            {slow && (
              <p className="text-muted text-sm mt-4 max-w-xs">
                Bağlantı kurulamıyor olabilir. İnternetini kontrol et; kurulu uygulamada
                sorun sürerse tarayıcıda açmayı dene.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-5xl mb-3" aria-hidden>🔍</p>
            <p className="text-xl font-bold mb-1">Sunum bulunamadı</p>
            <p className="text-muted mb-6 max-w-xs">
              Bu sunum silinmiş olabilir ya da adres hatalı.
            </p>
            <a href="/dashboard" className="btn-primary">Panele dön</a>
          </>
        )}
      </main>
    );
  }

  const { style: themeBg } = themeStyle(presentation.theme);
  const dark = themeStyle(presentation.theme).dark;
  const logo = presentation.theme?.logo;
  const collectsVotes =
    slide && INTERACTIVE_SLIDE_TYPES.includes(slide.type) && slide.type !== "qna";
  const nextIdx = nextVisibleIndex(rawIndex, 1);
  const nextSlide = nextIdx !== null && nextIdx >= 0 ? slides[nextIdx] : undefined;
  const nextName = nextSlide
    ? nextSlide.settings?.label?.trim() || SLIDE_TYPE_LABELS[nextSlide.type]
    : null;
  const slideImage =
    slide && slide.type !== "pin-on-image" && slide.type !== "image"
      ? slide.settings?.image
      : undefined;

  return (
    <main className="min-h-screen flex flex-col" style={themeBg}>
      <ReactionOverlay presentationId={id} />
      {writeError && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-lg animate-pop"
        >
          {writeError}
        </div>
      )}
      <header
        className={`px-6 py-3.5 flex items-center justify-between border-b backdrop-blur ${
          dark ? "border-white/10 bg-black/20" : "border-line bg-white/80"
        }`}
      >
        <div className="flex items-center gap-3">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Sunum logosu" className="h-7 w-auto" />
          )}
          <Logo size="sm" onDark={dark} />
        </div>
        <p className={`hidden sm:block text-sm ${dark ? "text-white/70" : "text-muted"}`}>
          <span className={`font-semibold ${dark ? "text-white" : "text-ink"}`}>{host}</span> · kod{" "}
          <span className={`font-display font-semibold tracking-[0.2em] ${dark ? "text-white" : "text-ink"}`}>
            {presentation.joinCode}
          </span>
        </p>
        <div className="flex items-center gap-4">
          <span className="chip tabular-nums" title="Katılımcı sayısı">
            {participants.length} kişi
          </span>
          <Link
            href={`/edit/${id}`}
            className={`text-sm font-semibold ${dark ? "text-white/70 hover:text-white" : "text-muted hover:text-ink"}`}
          >
            Editör
          </Link>
        </div>
      </header>

      <section className="relative flex-1 flex flex-col items-center justify-center px-6 py-6">
        {rawIndex < 0 ? (
          /* ── Katılım ekranı: büyük QR + kod + canlı gelen isimler ── */
          <div className="w-full max-w-5xl flex flex-col md:flex-row items-center gap-10 md:gap-16">
            <div className="card p-7 shrink-0">
              {joinUrl && <QrCode text={joinUrl} size={300} />}
            </div>
            <div className="flex-1 text-center md:text-left">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Logo" className="h-12 w-auto mb-4 inline-block" />
              )}
              <p className={`eyebrow mb-3 ${dark ? "!text-white/60" : ""}`}>Canlı sunum</p>
              <h1 className={`font-display text-4xl md:text-5xl font-semibold tracking-tight mb-4 ${dark ? "text-white" : ""}`}>
                {presentation.title}
              </h1>
              <p className={`text-lg mb-1 ${dark ? "text-white/70" : "text-muted"}`}>
                QR kodu okut veya <span className={`font-semibold ${dark ? "text-white" : "text-ink"}`}>{host}</span>
                &apos;a gir, kodu yaz:
              </p>
              <p className={`font-display text-6xl md:text-7xl font-semibold tracking-[0.18em] mb-8 ${dark ? "text-white" : "text-accent"}`}>
                {presentation.joinCode}
              </p>
              <p className={`text-sm mb-3 tabular-nums font-semibold ${dark ? "text-white/70" : "text-muted"}`}>
                {participants.length} kişi katıldı
              </p>
              <ParticipantCloud participants={participants} dark={dark} />
            </div>
          </div>
        ) : slide ? (
          <>
            <div key={slide.id} className="w-full max-w-5xl card p-8 md:p-12 animate-pop">
              <div className="flex items-start justify-between gap-4">
                <p className="eyebrow mb-3">
                  {slide.settings?.label?.trim() ||
                    `${SLIDE_TYPE_ICONS[slide.type]} ${SLIDE_TYPE_LABELS[slide.type]}`}
                </p>
                {/* "X / Y yanıtladı" — Menti'deki responded sayacı */}
                {collectsVotes && participants.length > 0 && (
                  <span className="chip tabular-nums shrink-0" title="Yanıt veren katılımcı">
                    {new Set(responses.map((r) => r.voterId)).size} / {participants.length} yanıtladı
                  </span>
                )}
              </div>
              <h1 className="font-display text-3xl md:text-5xl font-semibold tracking-tight mb-10 lg:pr-32">
                {slide.question}
              </h1>
              <div className={slideImage ? "grid md:grid-cols-[minmax(0,320px)_1fr] gap-8 items-start" : ""}>
                {slideImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slideImage}
                    alt=""
                    className="w-full h-auto rounded-2xl border border-line bg-white"
                  />
                )}
                <div className="min-w-0">
                  {hideResults && collectsVotes ? (
                    <div className="text-center py-16">
                      <p className="text-5xl mb-4" aria-hidden>🙈</p>
                      <p className="text-xl font-bold">Sonuçlar gizli</p>
                      <p className="text-muted mt-1 tabular-nums">{responses.length} cevap toplandı</p>
                    </div>
                  ) : slide.type === "multiple-choice" ? (
                    <BarChartResult slide={slide} responses={responses} />
                  ) : slide.type === "word-cloud" ? (
                    <div className="min-h-[18rem] flex items-center justify-center">
                      <WordCloudResult responses={responses} />
                    </div>
                  ) : slide.type === "open-ended" ? (
                    <OpenEndedResult responses={responses} />
                  ) : slide.type === "scales" ? (
                    <ScalesResult slide={slide} responses={responses} />
                  ) : slide.type === "ranking" ? (
                    <RankingResult slide={slide} responses={responses} />
                  ) : slide.type === "quiz" ? (
                    <QuizResult slide={slide} responses={responses} />
                  ) : slide.type === "quiz-type" ? (
                    <QuizTypeResult slide={slide} responses={responses} />
                  ) : slide.type === "pin-on-image" ? (
                    <PinOnImageResult slide={slide} responses={responses} />
                  ) : slide.type === "guess-number" ? (
                    <GuessNumberResult slide={slide} responses={responses} />
                  ) : slide.type === "hundred-points" ? (
                    <HundredPointsResult slide={slide} responses={responses} />
                  ) : slide.type === "grid-2x2" ? (
                    <Grid2x2Result slide={slide} responses={responses} />
                  ) : slide.type === "qna" ? (
                    <QnaResult presentationId={id} />
                  ) : slide.type === "leaderboard" ? (
                    <LeaderboardSlide
                      presentationId={id}
                      slides={slides}
                      participants={participants}
                      sessionId={sessionId}
                      final={!slides.slice(index + 1).some(isScoringSlide)}
                    />
                  ) : slide.type === "image" ? (
                    <div className="flex flex-col items-center gap-4">
                      {slide.settings?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={slide.settings.image}
                          alt={slide.question}
                          className="max-h-[26rem] w-auto max-w-full rounded-2xl border border-line"
                        />
                      ) : (
                        <p className="text-muted py-10">Editörden görsel ekleyin.</p>
                      )}
                      {slide.settings?.description && (
                        <p className="text-ink/70 text-lg text-center">{slide.settings.description}</p>
                      )}
                    </div>
                  ) : slide.type === "video" ? (
                    slide.settings?.videoUrl ? (
                      <video
                        src={slide.settings.videoUrl}
                        controls
                        className="w-full max-h-[26rem] rounded-2xl border border-line bg-black"
                      />
                    ) : (
                      <p className="text-muted py-10">Editörden video URL&apos;i ekleyin.</p>
                    )
                  ) : slide.type === "instructions" ? (
                    <ol className="flex flex-col gap-3">
                      {slide.options.map((step, i) => (
                        <li key={i} className="flex items-start gap-3 text-xl md:text-2xl">
                          <span
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-base font-bold shrink-0 mt-0.5"
                            style={{ background: `var(--series-${(i % 8) + 1})` }}
                            aria-hidden
                          >
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  ) : slide.type === "content" ? (
                    <p className="text-ink/80 text-2xl leading-relaxed whitespace-pre-wrap">
                      {slide.settings?.description}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Mini QR: her slaytta köşede — geç gelenler de katılabilsin */}
            {joinUrl && (
              <div className="absolute top-6 right-6 hidden lg:flex flex-col items-center gap-1.5 bg-white border border-line rounded-2xl p-3 shadow-sm">
                <QrCode text={joinUrl} size={92} />
                <span className="font-display text-sm font-semibold tracking-[0.15em] text-accent">
                  {presentation.joinCode}
                </span>
              </div>
            )}

            {/* Kalıcı katıl pili (Menti "Join at menti.com XXXX") */}
            <div
              className={`absolute bottom-3 right-4 flex items-center gap-2 rounded-full px-4 py-1.5 text-sm shadow-sm ${
                dark ? "bg-white/10 text-white backdrop-blur border border-white/20" : "bg-white border border-line"
              }`}
            >
              <span className={dark ? "text-white/70" : "text-muted"}>{host}&apos;da katıl</span>
              <span className="font-display font-semibold tracking-[0.18em]">{presentation.joinCode}</span>
            </div>
          </>
        ) : (
          <p className="text-muted text-xl">Henüz slayt yok — editörden slayt ekleyin.</p>
        )}
      </section>

      <footer className="px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white/80 backdrop-blur">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setVotingClosed(id, !presentation.votingClosed)}
            className={`btn-ghost !py-1.5 !px-3.5 text-sm ${
              presentation.votingClosed ? "!border-brand !text-brand" : ""
            }`}
            title={presentation.votingClosed ? "Oylamayı aç" : "Oylamayı kapat"}
          >
            {presentation.votingClosed ? "Oylama kapalı" : "Oylama açık"}
          </button>
          {slide && collectsVotes && (
            <button
              onClick={async () => {
                if (confirm("Bu slaytın tüm cevapları silinsin mi?")) {
                  await resetResponses(id, slide.id);
                }
              }}
              className="btn-ghost !py-1.5 !px-3.5 text-sm"
              title="Bu slaytın cevaplarını sıfırla"
            >
              Sıfırla
            </button>
          )}
          {slide && collectsVotes && (
            <button
              onClick={() => setHideResults(!hideResults)}
              className="btn-ghost !py-1.5 !px-3.5 text-sm"
              title={hideResults ? "Sonuçları göster" : "Sonuçları gizle"}
            >
              {hideResults ? "Sonuçlar gizli" : "Sonuçlar görünür"}
            </button>
          )}
          {slides.some(isScoringSlide) && (
            <button
              onClick={() => setLeaderboardOpen(true)}
              className="btn-ghost !py-1.5 !px-3.5 text-sm"
              title="Skor tablosu"
            >
              Skor
            </button>
          )}
          {presentation.chatEnabled && (
            <button
              onClick={() => setChatOpen(true)}
              className="btn-ghost !py-1.5 !px-3.5 text-sm"
              title="Canlı sohbet"
            >
              Sohbet
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="btn-ghost !py-1.5 !px-3.5 text-sm"
            title="Tam ekran (aç/kapat)"
          >
            Tam ekran
          </button>
          <button
            onClick={async () => {
              if (confirm("Sunum bitirilsin mi? Cevaplar kaydedilir; izleyiciler bekleme ekranına döner.")) {
                await endPresentation(id);
                router.push(`/dashboard`);
              }
            }}
            className="btn-ghost !py-1.5 !px-3.5 text-sm text-muted"
          >
            Bitir
          </button>
          <span className="text-muted text-sm tabular-nums font-semibold hidden xl:inline ml-2">
            {participants.length} katılımcı
          </span>
        </div>

        {/* İlerleme noktaları (atlananlar silik çarpı) */}
        <div className="hidden md:flex items-center gap-1.5" aria-hidden>
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              rawIndex < 0 ? "bg-accent" : "bg-line"
            }`}
          />
          {slides.map((s, i) => (
            <span
              key={s.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                s.settings?.skipped
                  ? "bg-line/40 scale-75"
                  : i === index && rawIndex >= 0
                    ? "bg-accent"
                    : "bg-line"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => go(-1)}
            disabled={rawIndex <= -1}
            className="btn-ghost w-11 h-11 !p-0"
            aria-label="Önceki slayt"
          >
            <Icon name="chevronLeft" />
          </button>
          <span className="text-muted text-sm tabular-nums w-16 text-center font-semibold">
            {rawIndex < 0 ? "Katılım" : `${index + 1} / ${slides.length}`}
          </span>
          {/* Bağlamsal sonraki buton — sonraki slaytın adını gösterir (Menti) */}
          <button
            onClick={() => go(1)}
            disabled={nextIdx === null}
            className="btn-ghost h-11 !px-4 flex items-center gap-1.5"
            aria-label={nextName ? `Sonraki: ${nextName}` : "Sonraki slayt"}
            title={nextName ?? undefined}
          >
            {nextName && (
              <span className="hidden sm:inline max-w-[9rem] truncate text-sm font-semibold">
                {nextName}
              </span>
            )}
            <Icon name="chevronRight" />
          </button>
        </div>
      </footer>

      {leaderboardOpen && (
        <Leaderboard
          presentationId={id}
          slides={slides}
          participants={participants}
          sessionId={sessionId}
          onClose={() => setLeaderboardOpen(false)}
        />
      )}
      {chatOpen && (
        <ChatPanel
          presentationId={id}
          nickname="Sunucu 🎤"
          isOwner
          onClose={() => setChatOpen(false)}
        />
      )}
    </main>
  );
}
