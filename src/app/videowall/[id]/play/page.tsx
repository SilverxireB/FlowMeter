"use client";

/**
 * FlowSign yayın — id ile. `?draft=1` → editörün ÖNİZLE'si (taslak oynar);
 * parametresiz → kaydedilmiş yayın. Kolay public link: /flowsign/[slug].
 */
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import PlayerStage from "@/components/videowall/PlayerStage";
import { watchVideowall } from "@/lib/videowalls";
import { Videowall } from "@/lib/types";

export default function VideowallPlayPage() {
  const { id } = useParams<{ id: string }>();
  const [vw, setVw] = useState<Videowall | null | undefined>(undefined);
  const [draft, setDraft] = useState(false);

  useEffect(() => watchVideowall(id, setVw), [id]);
  useEffect(() => setDraft(new URLSearchParams(window.location.search).get("draft") === "1"), []);

  if (vw === undefined) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40 animate-pulse">Yükleniyor…</main>;
  if (vw === null) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40">Duvar bulunamadı.</main>;
  return <PlayerStage vw={vw} draft={draft} />;
}
