"use client";

/**
 * FlowPulse — telefon oyu (posterdeki QR buraya gelir). Auth yok; günde 1 oy
 * (localStorage). Oy sonrası opsiyonel anonim yorum.
 */
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { VoteButtons } from "@/components/pulse/shared";
import { addComment, castVote, dayKey, watchPulse } from "@/lib/pulses";
import { Pulse } from "@/lib/types";

export default function PulseVotePage() {
  const { id } = useParams<{ id: string }>();
  const [pulse, setPulse] = useState<Pulse | null | undefined>(undefined);
  const [done, setDone] = useState(false);
  const [comment, setComment] = useState("");
  const [commentSent, setCommentSent] = useState(false);

  const key = `pulse-voted-${id}`;
  useEffect(() => watchPulse(id, setPulse), [id]);
  useEffect(() => {
    try {
      if (localStorage.getItem(key) === dayKey()) setDone(true);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const vote = async (v: number) => {
    if (done) return;
    setDone(true);
    try {
      localStorage.setItem(key, dayKey());
    } catch {}
    castVote(id, v, "qr").catch(() => {});
  };

  const sendComment = async () => {
    if (!pulse || !comment.trim()) return;
    setCommentSent(true);
    addComment(id, comment, pulse.moderation !== false).catch(() => {});
  };

  if (pulse === undefined) return <main className="min-h-screen grid place-items-center bg-[#101014] text-white/40 animate-pulse">Yükleniyor…</main>;
  if (pulse === null) return <main className="min-h-screen grid place-items-center bg-[#101014] text-white/40">Nokta bulunamadı.</main>;

  return (
    <main className="min-h-screen bg-[#101014] text-white flex flex-col items-center justify-center gap-8 px-4 py-10" style={{ colorScheme: "dark" }}>
      {!done ? (
        <>
          <p className="text-white/40 text-sm">{pulse.title}</p>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-center leading-snug">{pulse.question.text}</h1>
          <VoteButtons pulse={pulse} onVote={vote} size="phone" />
          <p className="text-white/30 text-xs">Geri bildirimin anonimdir · günde 1 oy</p>
        </>
      ) : (
        <div className="text-center max-w-sm w-full animate-pop">
          <p className="text-6xl mb-4" aria-hidden>🙏</p>
          <h1 className="font-display font-bold text-2xl mb-2">Teşekkürler!</h1>
          <p className="text-white/50 text-sm mb-6">Bugünkü oyun alındı — yarın yine bekleriz.</p>
          {pulse.commentsEnabled !== false && !commentSent && (
            <div className="flex flex-col gap-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 200))}
                rows={3}
                placeholder="Eklemek istediğin bir şey var mı? (anonim, opsiyonel)"
                className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-sm focus:outline-none focus:border-white/40 resize-none"
              />
              <button onClick={sendComment} disabled={!comment.trim()} className="rounded-xl bg-accent hover:bg-accent-dark text-white py-2.5 font-semibold disabled:opacity-40">
                Yorumu gönder
              </button>
            </div>
          )}
          {commentSent && <p className="text-emerald-400 text-sm font-semibold">✓ Yorumun iletildi.</p>}
        </div>
      )}
    </main>
  );
}
