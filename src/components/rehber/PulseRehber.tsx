"use client";

/**
 * FlowPulse rehberi — çekmece + içerik tek pakette.
 *
 * Ayrı dosya olmasının sebebi paketleme: kokpit bunu `next/dynamic` ile
 * geciktirmeli çağırır, böylece rehber metni ilk yüklemeye binmez.
 */
import Rehber from "@/components/Rehber";
import { PULSE_REHBER } from "./pulseIcerik";

export default function PulseRehber({ bolum, onClose }: { bolum?: string | null; onClose: () => void }) {
  return (
    <Rehber
      baslik="FlowPulse rehberi"
      altBaslik="Noktayı kur, oyları topla, skoru oku."
      bolumler={PULSE_REHBER}
      bolum={bolum}
      onClose={onClose}
    />
  );
}
