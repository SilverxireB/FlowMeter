import { NextRequest, NextResponse } from "next/server";
import { checkPassword, SESSION_COOKIE, sessionToken } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!checkPassword(password ?? "")) {
    return NextResponse.json({ error: "Parola hatalı." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 gün
  });
  return res;
}
