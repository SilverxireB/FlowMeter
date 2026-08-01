import { NextRequest, NextResponse } from "next/server";
import { canEdit, currentUser, forbidden, unauthorized } from "@/lib/serverAuth";
import { getWall, renameWall } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ad + slug birlikte değişir; eski slug history'ye eklenir (eski link kararmaz). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const cur = await getWall(params.id);
  if (!cur) return NextResponse.json({ error: "Ekran bulunamadı" }, { status: 404 });
  if (!canEdit(cur, me)) return forbidden();
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "Ad boş olamaz" }, { status: 400 });
  const wall = await renameWall(params.id, name);
  return NextResponse.json({ ok: true, slug: wall?.slug });
}
