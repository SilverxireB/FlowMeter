import { NextRequest, NextResponse } from "next/server";
import { isAuthed, unauthorized } from "@/lib/serverAuth";
import { createWall, listWalls, screenSummaries } from "@/lib/store";
import { clampScreens } from "@/lib/zones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ekran listesi + kart canlılık özeti (kokpit). */
export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return unauthorized();
  const walls = await listWalls();
  const beats = await screenSummaries(walls.map((w) => w.id));
  return NextResponse.json({ walls, beats });
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as { name?: string; width?: number; height?: number; cols?: number; rows?: number };
  const wall = await createWall(
    String(b.name ?? ""),
    Math.max(1, Math.round(Number(b.width) || 1920)),
    Math.max(1, Math.round(Number(b.height) || 1080)),
    clampScreens(Number(b.cols) || 1),
    clampScreens(Number(b.rows) || 1)
  );
  return NextResponse.json(wall);
}
