import { NextRequest, NextResponse } from "next/server";
import { isAuthed, unauthorized } from "@/lib/serverAuth";
import { beat, deleteScreen } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Perde "canlıyım" yazar — perde auth İSTEMEZ (kiosk cihazı oturum açmaz). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const b = (await req.json().catch(() => ({}))) as {
    screenId?: string;
    ua?: string;
    vwPx?: number;
    vhPx?: number;
    includeStart?: boolean;
  };
  if (!b.screenId) return NextResponse.json({ error: "screenId gerekli" }, { status: 400 });
  await beat(
    params.id,
    b.screenId,
    { ua: String(b.ua ?? "").slice(0, 140), vwPx: Number(b.vwPx) || 0, vhPx: Number(b.vhPx) || 0 },
    Boolean(b.includeStart)
  );
  return NextResponse.json({ ok: true });
}

/** Bayat ekran kaydını sil (kokpit temizliği — yönetici). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed(req)) return unauthorized();
  const screenId = req.nextUrl.searchParams.get("screenId") ?? "";
  if (!screenId) return NextResponse.json({ error: "screenId gerekli" }, { status: 400 });
  await deleteScreen(params.id, screenId);
  return NextResponse.json({ ok: true });
}
