"use client";

/**
 * FlowSign yayın — kolay link: /flowsign/<ekranadı>. Slug ile duvarı bulur
 * (public, auth yok). Slug eşleşmezse doküman id'si olarak da dener (eski/
 * değişmiş link 7/24 ekranı karartmasın). Her zaman YAYIN (kaydedilmiş) oynar.
 */
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import PlayerStage from "@/components/videowall/PlayerStage";
import { watchVideowall, watchVideowallBySlug, watchVideowallBySlugHistory } from "@/lib/videowalls";
import { Videowall } from "@/lib/types";

export default function FlowsignPlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const [vw, setVw] = useState<Videowall | null | undefined>(undefined);

  useEffect(() => {
    const key = decodeURIComponent(slug);
    // Bulma zinciri: güncel slug → eski slug (yeniden adlandırma) → doküman id.
    // Eski link/QR sahadaki 7/24 ekranı asla karartmaz.
    let unsubHist: (() => void) | null = null;
    let unsubId: (() => void) | null = null;
    const unsubSlug = watchVideowallBySlug(key, (v) => {
      if (v) {
        setVw(v);
        return;
      }
      if (!unsubHist)
        unsubHist = watchVideowallBySlugHistory(key, (h) => {
          if (h) {
            setVw(h);
            return;
          }
          if (!unsubId) unsubId = watchVideowall(key, setVw);
        });
    });
    return () => {
      unsubSlug();
      unsubHist?.();
      unsubId?.();
    };
  }, [slug]);

  if (vw === undefined) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40 animate-pulse">Yükleniyor…</main>;
  if (vw === null) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40">Ekran bulunamadı.</main>;
  return <PlayerStage vw={vw} />;
}
