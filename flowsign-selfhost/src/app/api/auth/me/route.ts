import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/serverAuth";
import { publicUser } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Oturum sahibi kim? (kokpit başlığı + yetki düğmelerini buna göre çizer) */
export async function GET(req: NextRequest) {
  const me = await currentUser(req);
  return NextResponse.json({ ok: !!me, user: me ? publicUser(me) : null });
}
