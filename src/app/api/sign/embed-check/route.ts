import { NextRequest, NextResponse } from "next/server";

/**
 * FlowSign — URL gömülebilirlik kontrolü. Hedef sayfanın başlıklarına bakar:
 * X-Frame-Options / CSP frame-ancestors iframe'i yasaklıyorsa editör kullanıcıyı
 * DAHA EKLERKEN uyarır ("Google neden görünmüyor?" karışıklığı yaşanmasın).
 * Erişilemeyen adreste (iç ağ panosu, Vercel'den ulaşılamaz) hüküm VERMEZ —
 * yanlış alarm, gerçek uyarıyı değersizleştirir. Sign paketine aittir.
 */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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
    // sameorigin: hedef bizim domain'imiz değilse gömme reddedilir
    if (xfo.includes("sameorigin") && targetHost !== ourHost) blocked = true;
    // frame-ancestors: '*' ya da bizim host listede yoksa engel ('self'/'none' dahil)
    if (fa && !fa.includes("*") && !fa.includes(ourHost)) blocked = true;

    return NextResponse.json({ verdict: blocked ? "blocked" : "ok", host: targetHost });
  } catch {
    return NextResponse.json({ verdict: "unknown" });
  }
}
