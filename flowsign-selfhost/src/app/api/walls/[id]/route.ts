import { NextRequest, NextResponse } from "next/server";
import { isAuthed, unauthorized } from "@/lib/serverAuth";
import { deleteWall, getWall, patchWall } from "@/lib/store";
import { Videowall } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed(req)) return unauthorized();
  const wall = await getWall(params.id);
  if (!wall) return NextResponse.json({ error: "Ekran bulunamadı" }, { status: 404 });
  return NextResponse.json(wall);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed(req)) return unauthorized();
  const patch = (await req.json().catch(() => null)) as Partial<Videowall> | null;
  if (!patch || typeof patch !== "object") return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  const wall = await patchWall(params.id, patch);
  if (!wall) return NextResponse.json({ error: "Ekran bulunamadı" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed(req)) return unauthorized();
  await deleteWall(params.id);
  return NextResponse.json({ ok: true });
}
