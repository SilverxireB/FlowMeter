"use client";

import Avatar from "@/components/Avatar";
import { Participant } from "@/lib/types";

/** id'den deterministik konum (disk içinde düzgün dağılım) ve faz. */
function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pos(id: string): { x: number; y: number; delay: number } {
  const h = hash(id);
  const a = ((h % 1000) / 1000) * Math.PI * 2;
  const r = Math.sqrt(((h >>> 10) % 1000) / 1000); // 0..1, disk için sqrt
  return {
    x: 0.5 + Math.cos(a) * r * 0.46,
    y: 0.5 + Math.sin(a) * r * 0.46,
    delay: ((h >>> 20) % 50) / 10, // 0-5 sn float fazı
  };
}

const RENDER = 64; // Avatar sabit çözünürlükte render, CSS scale ile küçülür (yumuşak)

/**
 * Katılım ekranı avatar bulutu: avatarlar dairesel alanda uçuşur; sayı arttıkça
 * hepsi küçülür, en yeni gelenler büyük kalıp öne çıkar. Çok kişide de akıcı.
 */
export default function ParticipantCloud({
  participants,
  dark = false,
}: {
  participants: Participant[];
  dark?: boolean;
}) {
  const MAX = 90;
  const shown = participants.slice(Math.max(0, participants.length - MAX));
  const overflow = participants.length - shown.length;
  const count = Math.max(1, participants.length);
  const base = Math.max(22, Math.min(56, 320 / Math.sqrt(count)));
  const newest = new Set(participants.slice(-3).map((p) => p.id));

  if (participants.length === 0) {
    return (
      <div className={`w-full aspect-[5/3] max-h-72 grid place-items-center ${dark ? "text-white/40" : "text-muted"}`}>
        <p className="text-sm animate-pulse">İlk katılımcı bekleniyor…</p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[5/3] max-h-72">
      {shown.map((p) => {
        const { x, y, delay } = pos(p.id);
        const isNew = newest.has(p.id);
        const size = isNew ? base * 1.7 : base;
        const ease = "cubic-bezier(.22,1,.36,1)";
        return (
          <span
            key={p.id}
            className="absolute animate-pop"
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              transform: "translate(-50%, -50%)",
              zIndex: isNew ? 20 : 1,
            }}
          >
            <span className="flex flex-col items-center cloud-float" style={{ animationDelay: `${delay}s` }}>
              <span
                className="grid place-items-center"
                style={{ width: size, height: size, transition: `width .6s ${ease}, height .6s ${ease}` }}
              >
                <span
                  className="block"
                  style={{ transform: `scale(${size / RENDER})`, transition: `transform .6s ${ease}` }}
                >
                  {p.avatarSeed ? (
                    <Avatar seed={p.avatarSeed} size={RENDER} className="ring-2 ring-white/80 shadow-md" />
                  ) : (
                    <span className="grid place-items-center rounded-full bg-white shadow-md" style={{ width: RENDER, height: RENDER, fontSize: RENDER * 0.55 }}>
                      {p.emoji ?? "😀"}
                    </span>
                  )}
                </span>
              </span>
              {p.nickname && (
                <span
                  className={`mt-1 px-1.5 py-px rounded-full text-[10px] font-semibold leading-tight truncate ${
                    dark ? "bg-black/35 text-white" : "bg-white/90 text-ink shadow-sm"
                  }`}
                  style={{ maxWidth: Math.max(52, size * 2.2) }}
                >
                  {p.nickname}
                </span>
              )}
            </span>
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="absolute bottom-1 right-2 chip !py-0.5 text-xs tabular-nums">
          +{overflow}
        </span>
      )}
    </div>
  );
}
