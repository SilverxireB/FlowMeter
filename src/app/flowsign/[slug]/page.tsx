"use client";

/**
 * FlowSign yayın — kolay link: /flowsign/<ekranadı>. Slug ile duvarı bulur
 * (public, auth yok). Tabela PC'sinde açması kolay olsun diye asıl rota bu.
 */
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import PlayerStage from "@/components/videowall/PlayerStage";
import { watchVideowallBySlug } from "@/lib/videowalls";
import { Videowall } from "@/lib/types";

export default function FlowsignPlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const [vw, setVw] = useState<Videowall | null | undefined>(undefined);
  useEffect(() => watchVideowallBySlug(decodeURIComponent(slug), setVw), [slug]);

  if (vw === undefined) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40">Yükleniyor…</main>;
  if (vw === null) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40">Ekran bulunamadı.</main>;
  return <PlayerStage vw={vw} />;
}
