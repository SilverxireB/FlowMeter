import { NextRequest, NextResponse } from "next/server";
import { currentUser, unauthorized } from "@/lib/serverAuth";
import { createWall, listWalls, screenSummaries } from "@/lib/store";
import { listUsers, publicUser } from "@/lib/users";
import { clampScreens } from "@/lib/zones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ekran listesi + kart canlılık özeti + KULLANICI DEFTERİ (kokpit).
 * Defter listeyle birlikte gelir: kartta "sahibi kim", yetki panelinde de
 * kişi seçici bununla çizilir (ayrı istek atıp yanıp sönmesin).
 */
export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const walls = await listWalls();
  const beats = await screenSummaries(walls.map((w) => w.id));
  const users = (await listUsers()).map(publicUser);
  return NextResponse.json({ walls, beats, users, me: publicUser(me) });
}

export async function POST(req: NextRequest) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as { name?: string; width?: number; height?: number; cols?: number; rows?: number };
  // Oluşturan kişi SAHİBİDİR (yönetici başkası için kurup sonra devreder).
  const wall = await createWall(
    String(b.name ?? ""),
    Math.max(1, Math.round(Number(b.width) || 1920)),
    Math.max(1, Math.round(Number(b.height) || 1080)),
    clampScreens(Number(b.cols) || 1),
    clampScreens(Number(b.rows) || 1),
    me.id
  );
  return NextResponse.json(wall);
}
