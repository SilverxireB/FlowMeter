"use client";

/**
 * FlowSign yayın — kolay link: /flowsign/<ekranadı>. Slug ile duvarı bulur
 * (public, auth yok). Slug eşleşmezse doküman id'si olarak da dener (eski/
 * değişmiş link 7/24 ekranı karartmasın). Her zaman YAYIN (kaydedilmiş) oynar.
 */
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import PlayerStage from "@/components/videowall/PlayerStage";
import { watchVideowall, watchVideowallBySlug } from "@/lib/videowalls";
import { Videowall } from "@/lib/types";

export default function FlowsignPlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const [vw, setVw] = useState<Videowall | null | undefined>(undefined);

  useEffect(() => {
    const key = decodeURIComponent(slug);
    let unsubId: (() => void) | null = null;
    const unsubSlug = watchVideowallBySlug(key, (v) => {
      if (v) {
        setVw(v);
        return;
      }
      // Slug bulunamadı → id ile dene (bir kez bağlan, sonra o da canlı izler).
      if (!unsubId) unsubId = watchVideowall(key, setVw);
    });
    return () => {
      unsubSlug();
      unsubId?.();
    };
  }, [slug]);

  if (vw === undefined) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40">Yükleniyor…</main>;
  if (vw === null) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40">Ekran bulunamadı.</main>;
  return <PlayerStage vw={vw} />;
}
