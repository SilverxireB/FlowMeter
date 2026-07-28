"use client";

/** FlowSign yayın — id ile. Asıl sahne PlayerStage'de; kolay link: /flowsign/[slug]. */
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import PlayerStage from "@/components/videowall/PlayerStage";
import { watchVideowall } from "@/lib/videowalls";
import { Videowall } from "@/lib/types";

export default function VideowallPlayPage() {
  const { id } = useParams<{ id: string }>();
  const [vw, setVw] = useState<Videowall | null | undefined>(undefined);
  useEffect(() => watchVideowall(id, setVw), [id]);

  if (vw === undefined) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40">Yükleniyor…</main>;
  if (vw === null) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40">Duvar bulunamadı.</main>;
  return <PlayerStage vw={vw} />;
}
