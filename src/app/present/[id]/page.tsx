"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";
import QrCode from "@/components/present/QrCode";
import Leaderboard from "@/components/present/Leaderboard";
import ReactionOverlay from "@/components/present/ReactionOverlay";
import BarChartResult from "@/components/results/BarChartResult";
import OpenEndedResult from "@/components/results/OpenEndedResult";
import QnaResult from "@/components/results/QnaResult";
import QuizResult from "@/components/results/QuizResult";
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
import { themeStyle } from "@/lib/themes";
import { SLIDE_TYPE_ICONS, SLIDE_TYPE_LABELS } from "@/lib/types";

/**
 * Sunum modu. index -1 = katılım ekranı (büyük QR + kod + gelen isimler),
 * 0..n-1 = slaytlar (köşede mini QR kartı — geç gelenler de katılabilsin).
 * Klavye ←/→ ile gezinir.
 */
export default function PresentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const { presentation } = usePresentation(id);
  const { slides } = useSlides(id);
  const participants = useParticipants(id);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [host, setHost] = useState("flowmeter");
  const [hideResults, setHideResults] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  const rawIndex = presentation?.currentSlideIndex ?? -1;
  const index = Math.min(rawIndex, slides.length - 1);
  const slide = rawIndex < 0 ? undefined : slides[index];
  const responses = useLiveResponses(id, slide?.id ?? null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

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
    if (slide?.type === "quiz" && !slide.quizStartedAt) {
      startQuiz(id, slide.id);
    }
  }, [id, slide]);

  // Klavye ile gezinme (←/→), -1 katılım ekranına kadar geri gidilebilir
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" && rawIndex < slides.length - 1) setCurrentSlide(id, rawIndex + 1);
      if (e.key === "ArrowLeft" && rawIndex > -1) setCurrentSlide(id, rawIndex - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, rawIndex, slides.length]);

  if (!presentation) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-wash">
        <p className="text-muted animate-pulse">Yükleniyor…</p>
      </main>
    );
  }

  const { style: themeBg, dark } = themeStyle(presentation.theme);
  const logo = presentation.theme?.logo;

  return (
    <main className="min-h-screen flex flex-col" style={themeBg}>
      <ReactionOverlay presentationId={id} />
      <header className="px-6 py-3.5 flex items-center justify-between border-b border-line bg-white/80 backdrop-blur">
        <div className="flex items-center gap-3">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Sunum logosu" className="h-7 w-auto" />
          )}
          <Logo size="sm" />
        </div>
        <p className="hidden sm:block text-sm text-muted">
          <span className="font-semibold text-ink">{host}</span> · kod{" "}
          <span className="font-display font-semibold text-ink tracking-[0.2em]">
            {presentation.joinCode}
          </span>
        </p>
        <div className="flex items-center gap-4">
          <span className="chip tabular-nums" title="Katılımcı sayısı">
            <span aria-hidden>👥</span> {participants.length}
          </span>
          <Link href={`/edit/${id}`} className="text-muted hover:text-ink text-sm font-semibold">
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
              <p className={`font-display text-6xl md:text-7xl font-semibold tracking-[0.18em] mb-8 ${dark ? "text-white" : "text-brand"}`}>
                {presentation.joinCode}
              </p>
              <p className={`text-sm mb-3 tabular-nums font-semibold ${dark ? "text-white/70" : "text-muted"}`}>
                {participants.length} kişi katıldı
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start max-h-36 overflow-hidden">
                {participants.slice(0, 21).map((p) => (
                  <span key={p.id} className="chip !pl-1">
                    {p.avatarSeed ? (
                      <Avatar seed={p.avatarSeed} size={26} />
                    ) : (
                      <span aria-hidden>{p.emoji ?? "😀"}</span>
                    )}
                    {p.nickname}
                  </span>
                ))}
                {participants.length > 21 && (
                  <span className="text-muted text-sm px-2 py-1 font-semibold">
                    +{participants.length - 21} kişi
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : slide ? (
          <>
            <div key={slide.id} className="w-full max-w-5xl card p-8 md:p-12 animate-pop">
              <p className="eyebrow mb-3">{SLIDE_TYPE_ICONS[slide.type]} {SLIDE_TYPE_LABELS[slide.type]}</p>
              <h1 className="font-display text-3xl md:text-5xl font-semibold tracking-tight mb-10 lg:pr-32">
                {slide.question}
              </h1>
              {hideResults ? (
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
              ) : slide.type === "qna" ? (
                <QnaResult presentationId={id} />
              ) : slide.type === "content" ? (
                <p className="text-ink/80 text-2xl leading-relaxed whitespace-pre-wrap">
                  {slide.settings?.description}
                </p>
              ) : null}
            </div>

            {/* Mini QR: her slaytta köşede — geç gelenler de katılabilsin */}
            {joinUrl && (
              <div className="absolute top-6 right-6 hidden lg:flex flex-col items-center gap-1.5 bg-white border border-line rounded-2xl p-3 shadow-sm">
                <QrCode text={joinUrl} size={92} />
                <span className="font-display text-sm font-semibold tracking-[0.15em] text-brand">
                  {presentation.joinCode}
                </span>
              </div>
            )}
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
            {presentation.votingClosed ? "🔒 Oylama kapalı" : "🔓 Oylama açık"}
          </button>
          {slide && (
            <button
              onClick={async () => {
                if (confirm("Bu slaytın tüm cevapları silinsin mi?")) {
                  await resetResponses(id, slide.id);
                }
              }}
              className="btn-ghost !py-1.5 !px-3.5 text-sm"
              title="Bu slaytın cevaplarını sıfırla"
            >
              ↺ Sıfırla
            </button>
          )}
          {slide && (
            <button
              onClick={() => setHideResults(!hideResults)}
              className="btn-ghost !py-1.5 !px-3.5 text-sm"
              title={hideResults ? "Sonuçları göster" : "Sonuçları gizle"}
            >
              {hideResults ? "🙈 Gizli" : "👁 Görünür"}
            </button>
          )}
          {slides.some((s) => s.type === "quiz") && (
            <button
              onClick={() => setLeaderboardOpen(true)}
              className="btn-ghost !py-1.5 !px-3.5 text-sm"
              title="Skor tablosu"
            >
              🏆
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="btn-ghost !py-1.5 !px-3.5 text-sm"
            title="Tam ekran (aç/kapat)"
          >
            ⛶
          </button>
          <button
            onClick={async () => {
              if (confirm("Sunum bitirilsin mi? İzleyiciler bekleme ekranına döner.")) {
                await endPresentation(id);
                router.push(`/edit/${id}`);
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

        {/* İlerleme noktaları */}
        <div className="hidden md:flex items-center gap-1.5" aria-hidden>
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              rawIndex < 0 ? "bg-brand" : "bg-line"
            }`}
          />
          {slides.map((s, i) => (
            <span
              key={s.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === index && rawIndex >= 0 ? "bg-brand" : "bg-line"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentSlide(id, rawIndex - 1)}
            disabled={rawIndex <= -1}
            className="btn-ghost w-11 h-11 !p-0"
            aria-label="Önceki slayt"
          >
            ←
          </button>
          <span className="text-muted text-sm tabular-nums w-16 text-center font-semibold">
            {rawIndex < 0 ? "Katılım" : `${index + 1} / ${slides.length}`}
          </span>
          <button
            onClick={() => setCurrentSlide(id, rawIndex + 1)}
            disabled={rawIndex >= slides.length - 1}
            className="btn-ghost w-11 h-11 !p-0"
            aria-label="Sonraki slayt"
          >
            →
          </button>
        </div>
      </footer>

      {leaderboardOpen && (
        <Leaderboard
          presentationId={id}
          slides={slides}
          participants={participants}
          onClose={() => setLeaderboardOpen(false)}
        />
      )}
    </main>
  );
}
