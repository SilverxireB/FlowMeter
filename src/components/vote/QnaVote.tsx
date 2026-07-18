"use client";

import { FormEvent, useState } from "react";
import { useQuestions } from "@/lib/hooks";
import { hasUpvoted, submitQuestion, upvoteQuestion } from "@/lib/questions";

/** Q&A izleyici: soru gönder + diğer soruları upvote et. */
export default function QnaVote({ presentationId }: { presentationId: string }) {
  const questions = useQuestions(presentationId).filter((q) => !q.hidden);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [voted, setVoted] = useState(0); // upvote sonrası yeniden çizim için

  async function submit(e: FormEvent) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      await submitQuestion(presentationId, clean);
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={250}
          rows={3}
          placeholder="Sorunu yaz…"
          className="input-base resize-none"
        />
        <button type="submit" disabled={!text.trim() || sending} className="btn-accent py-3">
          {sending ? "Gönderiliyor…" : "Soruyu gönder"}
        </button>
      </form>

      {questions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Sorular — beğendiğini oyla</p>
          {[...questions.filter((q) => !q.answered), ...questions.filter((q) => q.answered)].map(
            (q) => {
              const upvoted = hasUpvoted(q.id);
              return (
                <div
                  key={q.id}
                  className={`flex items-start gap-3 bg-white border border-line rounded-2xl px-4 py-3 ${
                    q.answered ? "opacity-70" : ""
                  }`}
                >
                  <button
                    onClick={async () => {
                      await upvoteQuestion(presentationId, q.id);
                      setVoted((v) => v + 1);
                    }}
                    disabled={upvoted || q.answered}
                    aria-label="Soruyu oyla"
                    className={`flex flex-col items-center shrink-0 rounded-xl px-2.5 py-1 cursor-pointer transition-colors ${
                      upvoted || q.answered
                        ? "bg-accent-soft text-accent-dark"
                        : "bg-paper hover:bg-accent-soft/60"
                    }`}
                  >
                    <span className="text-sm font-bold">{q.answered ? "✓" : "▲"}</span>
                    <span className="text-sm font-bold tabular-nums">{q.upvotes}</span>
                  </button>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="break-words">{q.text}</p>
                    {q.answered && (
                      <span className="chip !py-0.5 text-xs text-accent mt-1.5">✓ Cevaplandı</span>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}
