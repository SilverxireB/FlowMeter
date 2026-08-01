"use client";

import { Icon } from "@/components/Icon";
import { usePresentation, useQuestions } from "@/lib/hooks";
import { usePlayTarget } from "@/lib/usePlayTarget";
import { deleteQuestion, setQuestionAnswered, setQuestionHidden } from "@/lib/questions";

/** Q&A sunum görünümü: upvote sırasına göre sorular + moderasyon + ✓ cevaplandı. */
export default function QnaResult({ presentationId }: { presentationId: string }) {
  const { presentation } = usePresentation(presentationId);
  const playTarget = usePlayTarget();
  const allQuestions = useQuestions(presentationId);
  // Moderasyon açıkken onaysız sorular ekranda görünmez (onay: /moderate/<kod>)
  const moderation = !!presentation?.qnaModeration;
  const questions = moderation ? allQuestions.filter((q) => q.approved) : allQuestions;
  const pendingCount = moderation
    ? allQuestions.filter((q) => !q.approved && !q.hidden).length
    : 0;
  const visible = questions.filter((q) => !q.hidden && !q.answered);
  const answered = questions.filter((q) => !q.hidden && q.answered);
  const hidden = questions.filter((q) => q.hidden);

  const pendingBadge =
    pendingCount > 0 ? (
      <a
        href={`/moderate/${presentation?.joinCode || presentationId}`}
        target={playTarget}
        className="chip !py-1 text-xs font-semibold text-accent self-start inline-flex items-center gap-1.5"
        title="Moderasyon ekranını aç"
      >
        <Icon name="shield" size={13} /> {pendingCount} soru onay bekliyor →
      </a>
    ) : null;

  if (questions.length === 0) {
    return (
      <div className="text-center py-8 flex flex-col items-center gap-3">
        <p className="text-4xl animate-pulse" aria-hidden>🙋</p>
        <p className="text-muted text-lg">Sorular bekleniyor…</p>
        {pendingBadge}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-h-[26rem] overflow-y-auto pr-1">
      {pendingBadge}
      {visible.map((q, i) => (
        <div
          key={q.id}
          className={`flex items-start gap-4 rounded-2xl px-5 py-4 ${
            i === 0 ? "bg-accent-soft/50 border border-accent/30" : "bg-paper"
          }`}
        >
          <span className="flex flex-col items-center shrink-0 pt-0.5">
            <span className="text-accent font-bold">▲</span>
            <span className="font-display font-semibold tabular-nums">{q.upvotes}</span>
          </span>
          <p className={`flex-1 break-words ${i === 0 ? "text-xl font-semibold" : "text-lg"}`}>
            {q.text}
          </p>
          <span className="flex gap-1 shrink-0">
            <button
              onClick={() => setQuestionAnswered(presentationId, q.id, true)}
              className="text-muted hover:text-accent text-sm px-2 py-1 cursor-pointer"
              title="Cevaplandı olarak işaretle"
            >
              ✓
            </button>
            <button
              onClick={() => setQuestionHidden(presentationId, q.id, true)}
              className="text-muted hover:text-ink text-sm px-2 py-1 cursor-pointer"
              title="Gizle"
            >
              🙈
            </button>
            <button
              onClick={() => deleteQuestion(presentationId, q.id)}
              className="text-muted hover:text-brand text-sm px-2 py-1 cursor-pointer"
              title="Sil"
            >
              ✕
            </button>
          </span>
        </div>
      ))}
      {answered.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <p className="eyebrow text-accent">✓ Cevaplananlar</p>
          {answered.map((q) => (
            <div key={q.id} className="flex items-start gap-4 rounded-2xl px-5 py-3 bg-paper opacity-70">
              <span className="flex flex-col items-center shrink-0 pt-0.5 text-accent">
                <span className="font-bold">✓</span>
                <span className="font-display font-semibold tabular-nums text-sm">{q.upvotes}</span>
              </span>
              <p className="flex-1 break-words line-clamp-2">{q.text}</p>
              <button
                onClick={() => setQuestionAnswered(presentationId, q.id, false)}
                className="text-muted hover:text-ink text-xs px-2 py-1 cursor-pointer shrink-0 font-semibold"
                title="Cevaplandı işaretini geri al"
              >
                ↩ Geri al
              </button>
            </div>
          ))}
        </div>
      )}
      {hidden.length > 0 && (
        <details className="text-sm text-muted">
          <summary className="cursor-pointer font-semibold">
            {hidden.length} gizli soru
          </summary>
          <div className="flex flex-col gap-2 mt-2">
            {hidden.map((q) => (
              <div key={q.id} className="flex items-center gap-3 opacity-60 px-2">
                <p className="flex-1 break-words line-through">{q.text}</p>
                <button
                  onClick={() => setQuestionHidden(presentationId, q.id, false)}
                  className="text-accent font-semibold cursor-pointer shrink-0"
                >
                  Göster
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
