"use client";

/**
 * FlowMeter rehberi — çekmece + içerik tek pakette.
 *
 * Ayrı dosya olmasının sebebi paketleme: kokpit bunu `next/dynamic` ile
 * geciktirmeli çağırır, böylece rehber metni ilk yüklemeye binmez.
 */
import Rehber from "@/components/Rehber";
import { METER_REHBER } from "./meterIcerik";

export default function MeterRehber({ bolum, onClose }: { bolum?: string | null; onClose: () => void }) {
  return (
    <Rehber
      baslik="FlowMeter rehberi"
      altBaslik="Slaytları hazırla, sun, sonuçları oku."
      bolumler={METER_REHBER}
      bolum={bolum}
      onClose={onClose}
    />
  );
}
