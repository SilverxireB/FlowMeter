"use client";

/**
 * FlowWall perde — çekiliş KAYIT bandı. Kayıt açıkken (registerUntil geçmediyse)
 * perdede üstte "çekilişe katıl · kod · katılımcı sayısı · geri sayım" gösterir.
 * Tam kaplamaz; anons/yarışma banner diliyle uyumlu (temaya uygun renk).
 */
import { useEffect, useState } from "react";
import { Wall } from "@/lib/types";
import { raffleRegistrationOpen } from "@/lib/walls";
import { wallBannerColors } from "@/lib/themes";

export default function WallRaffleBanner({ wall, count }: { wall: Wall; count: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (!raffleRegistrationOpen(wall, now)) return null;
  const bc = wallBannerColors(wall.theme?.preset);
  const until = wall.raffle?.registerUntil?.toMillis?.() ?? 0;
  const remain = until ? Math.max(0, Math.round((until - now) / 1000)) : 0;
  const cd = until ? `${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, "0")}` : null;

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 rounded-3xl px-6 py-3 shadow-2xl border border-white/20 text-white text-center ww-pop pointer-events-none" style={{ background: bc.gradient }}>
      <p className="font-bold text-sm sm:text-lg">🎁 Çekilişe katıl{wall.raffle?.prize ? ` · ${wall.raffle.prize}` : ""}</p>
      <p className="text-white/85 text-xs sm:text-sm mt-0.5 tabular-nums">
        Kod <b className="tracking-widest">{wall.joinCode}</b> · 👥 {count}{cd ? ` · ⏳ ${cd}` : ""}
      </p>
    </div>
  );
}
