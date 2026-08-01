"use client";

/**
 * FlowSign yayın — tek kapı: /play/<ekranadı-veya-id>. Bulma zinciri sunucuda:
 * güncel slug → eski slug (yeniden adlandırma) → doküman id. Eski link/QR
 * sahadaki 7/24 ekranı asla karartmaz. `?draft=1` → editörün ÖNİZLE'si
 * (taslak oynar); parametresiz → her zaman YAYIN (kaydedilmiş) oynar.
 * Auth istemez — tabela cihazı oturum açmaz.
 */
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import PlayerStage from "@/components/PlayerStage";
import { watchWallByKey } from "@/lib/client";
import { Videowall } from "@/lib/types";

export default function PlayPage() {
  const { key } = useParams<{ key: string }>();
  const [vw, setVw] = useState<Videowall | null | undefined>(undefined);
  const [draft, setDraft] = useState(false);

  useEffect(() => watchWallByKey(key, setVw), [key]);
  useEffect(() => setDraft(new URLSearchParams(window.location.search).get("draft") === "1"), []);

  if (vw === undefined) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40 animate-pulse">Yükleniyor…</main>;
  if (vw === null) return <main className="w-screen h-screen grid place-items-center bg-black text-white/40">Ekran bulunamadı.</main>;
  return <PlayerStage vw={vw} draft={draft} />;
}
