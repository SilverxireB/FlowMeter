import { NextRequest, NextResponse } from "next/server";
import { isAuthed, unauthorized } from "@/lib/serverAuth";
import { duplicateWall } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed(req)) return unauthorized();
  const wall = await duplicateWall(params.id);
  if (!wall) return NextResponse.json({ error: "Ekran bulunamadı" }, { status: 404 });
  return NextResponse.json(wall);
}
