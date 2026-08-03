"use client";

/**
 * FlowWall rehberi — çekmece + içerik tek pakette.
 *
 * Ayrı dosya olmasının sebebi paketleme: kokpit bunu `next/dynamic` ile
 * geciktirmeli çağırır, böylece rehber metni ilk yüklemeye binmez.
 */
import Rehber from "@/components/Rehber";
import { WALL_REHBER } from "./wallIcerik";

export default function WallRehber({ bolum, onClose }: { bolum?: string | null; onClose: () => void }) {
  return (
    <Rehber
      baslik="FlowWall rehberi"
      altBaslik="Duvarı kur, perdeyi ayarla, etkinliği yönet."
      bolumler={WALL_REHBER}
      bolum={bolum}
      onClose={onClose}
    />
  );
}
