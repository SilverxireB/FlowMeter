import { NextRequest, NextResponse } from "next/server";
import { isAuthed, unauthorized } from "@/lib/serverAuth";
import { renameWall } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ad + slug birlikte değişir; eski slug history'ye eklenir (eski link kararmaz). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed(req)) return unauthorized();
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "Ad boş olamaz" }, { status: 400 });
  const wall = await renameWall(params.id, name);
  if (!wall) return NextResponse.json({ error: "Ekran bulunamadı" }, { status: 404 });
  return NextResponse.json({ ok: true, slug: wall.slug });
}
