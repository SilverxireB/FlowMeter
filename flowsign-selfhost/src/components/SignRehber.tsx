"use client";

/**
 * FlowSign rehberi — çekmece + içerik tek pakette.
 *
 * Ayrı dosya olmasının sebebi paketleme: editör bu bileşeni `next/dynamic` ile
 * geciktirmeli çağırır, böylece rehber metni ve canlı demo editörün ilk
 * yüklemesine binmez — tabela kurarken rehber açmayan kişi bedelini ödemez.
 */
import Rehber from "@/components/Rehber";
import { SIGN_REHBER } from "./signRehberIcerik";

export default function SignRehber({ bolum, onClose }: { bolum?: string | null; onClose: () => void }) {
  return (
    <Rehber
      baslik="FlowSign rehberi"
      altBaslik="Ekranı kur, içeriği yerleştir, yayınla."
      bolumler={SIGN_REHBER}
      bolum={bolum}
      onClose={onClose}
    />
  );
}
