import { NextRequest, NextResponse } from "next/server";
import { canCopy, currentUser, forbidden, unauthorized } from "@/lib/serverAuth";
import { duplicateWall, getWall } from "@/lib/store";
import { canCreateWalls } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Kopya KOPYALAYANIN olur — "Kopyala" tiki + yeni ekran açma hakkı gerekir. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await currentUser(req);
  if (!me) return unauthorized();
  const cur = await getWall(params.id);
  if (!cur) return NextResponse.json({ error: "Ekran bulunamadı" }, { status: 404 });
  if (!canCopy(cur, me) || !canCreateWalls(me)) return forbidden();
  const wall = await duplicateWall(params.id, me.id);
  return NextResponse.json(wall);
}
