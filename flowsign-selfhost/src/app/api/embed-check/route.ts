import { NextRequest, NextResponse } from "next/server";
import { currentUser, unauthorized } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * URL gömülebilirlik kontrolü. Hedef sayfanın başlıklarına bakar:
 * X-Frame-Options / CSP frame-ancestors iframe'i yasaklıyorsa editör kullanıcıyı
 * DAHA EKLERKEN uyarır. Erişilemeyen adreste hüküm VERMEZ (iç ağ panosu vb.) —
 * yanlış alarm, gerçek uyarıyı değersizleştirir.
 */
export async function GET(req: NextRequest) {
  if (!(await currentUser(req))) return unauthorized();
  const url = req.nextUrl.searchParams.get("url") ?? "";
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ verdict: "invalid" });
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; FlowSign-EmbedCheck)" },
    });
    clearTimeout(t);

    const ourHost = req.nextUrl.hostname;
    const targetHost = new URL(res.url || url).hostname;
    const xfo = (res.headers.get("x-frame-options") ?? "").toLowerCase();
    const csp = (res.headers.get("content-security-policy") ?? "").toLowerCase();
    const fa = csp
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("frame-ancestors"));

    let blocked = false;
    if (xfo.includes("deny")) blocked = true;
    if (xfo.includes("sameorigin") && targetHost !== ourHost) blocked = true;
    if (fa && !fa.includes("*") && !fa.includes(ourHost)) blocked = true;

    return NextResponse.json({ verdict: blocked ? "blocked" : "ok", host: targetHost });
  } catch {
    return NextResponse.json({ verdict: "unknown" });
  }
}
