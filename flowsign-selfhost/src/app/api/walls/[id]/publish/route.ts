import { NextRequest, NextResponse } from "next/server";
import { isAuthed, unauthorized } from "@/lib/serverAuth";
import { publishWall } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** "Kaydet & Yayınla" — taslak anlık görüntüsü sunucuda atomik alınır. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed(req)) return unauthorized();
  const wall = await publishWall(params.id);
  if (!wall) return NextResponse.json({ error: "Ekran bulunamadı" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
