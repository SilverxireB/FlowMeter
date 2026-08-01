import { NextRequest, NextResponse } from "next/server";
import { canEdit, currentUser, forbidden, unauthorized } from "@/lib/serverAuth";
import { duplicateWall, getWall } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kopya KOPYALAYANIN olur (yetkili de kendine kopya çıkarabilir). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const cur = await getWall(params.id);
  if (!cur) return NextResponse.json({ error: "Ekran bulunamadı" }, { status: 404 });
  if (!canEdit(cur, me)) return forbidden();
  const wall = await duplicateWall(params.id, me.id);
  return NextResponse.json(wall);
}
