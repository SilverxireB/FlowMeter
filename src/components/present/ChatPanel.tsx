"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { deleteChatMessage, sendChatMessage } from "@/lib/chat";
import { useChatMessages } from "@/lib/hooks";
import { getVoterId } from "@/lib/responses";

/**
 * Canlı sohbet paneli — izleyicide alt sayfa (bottom sheet), sunucuda yan panel.
 * isOwner=true mesaj silme (moderasyon) gösterir.
 */
export default function ChatPanel({
  presentationId,
  nickname,
  isOwner = false,
  onClose,
}: {
  presentationId: string;
  nickname: string;
  isOwner?: boolean;
  onClose: () => void;
}) {
  const messages = useChatMessages(presentationId, true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const myId = getVoterId();

  // Yeni mesajda en alta kaydır
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendChatMessage(presentationId, nickname, draft);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-ink/30"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-sm sm:h-full max-h-[75vh] sm:max-h-none rounded-t-3xl sm:rounded-none shadow-2xl flex flex-col animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-display text-lg font-semibold">💬 Canlı sohbet</h2>
          <button onClick={onClose} className="btn-ghost !px-3 !py-1.5 text-sm">Kapat</button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 min-h-[14rem]">
          {messages.length === 0 && (
            <p className="text-muted text-sm text-center py-8">Henüz mesaj yok — ilk yazan sen ol!</p>
          )}
          {messages.map((m) => {
            const mine = m.voterId === myId;
            return (
              <div key={m.id} className={`max-w-[85%] ${mine ? "self-end" : "self-start"}`}>
                <div
                  className={`rounded-2xl px-3.5 py-2 text-sm ${
                    mine ? "bg-accent text-white rounded-br-md" : "bg-paper border border-line rounded-bl-md"
                  }`}
                >
                  {!mine && <p className="text-[11px] font-bold text-accent mb-0.5">{m.nickname}</p>}
                  <p className="break-words">{m.text}</p>
                </div>
                {isOwner && (
                  <button
                    onClick={() => deleteChatMessage(presentationId, m.id)}
                    className="text-muted hover:text-brand text-[11px] font-semibold mt-0.5 cursor-pointer"
                  >
                    Sil
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={send} className="flex gap-2 p-3 border-t border-line">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
            placeholder="Mesaj yaz…"
            className="input-base flex-1 !py-2.5"
          />
          <button type="submit" disabled={!draft.trim() || sending} className="btn-accent !px-5 !py-2.5">
            →
          </button>
        </form>
      </div>
    </div>
  );
}
