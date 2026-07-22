"use client";

/**
 * FlowWall misafir — tepki çubuğu. Telefondan emoji gönderir, perdeye uçar.
 * Alt ortada sabit, camsı pil. Gönderim walls.ts'te 500ms throttle'lı.
 */
import { useState } from "react";
import { WALL_REACTION_EMOJIS, sendWallReaction } from "@/lib/walls";

export default function WallReactionBar({ wallId }: { wallId: string }) {
  const [pop, setPop] = useState<string | null>(null);

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 flex justify-center pointer-events-none pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md px-2 py-1.5 shadow-xl">
        {WALL_REACTION_EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => {
              sendWallReaction(wallId, e).catch(() => {});
              setPop(e);
              window.setTimeout(() => setPop((p) => (p === e ? null : p)), 300);
            }}
            className={`text-2xl w-11 h-11 grid place-items-center rounded-full transition-transform active:scale-90 ${pop === e ? "scale-125" : ""}`}
            aria-label={`${e} gönder`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
