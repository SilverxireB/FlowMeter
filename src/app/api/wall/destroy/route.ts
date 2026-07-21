/**
 * FlowWall — Cloudinary'den KALICI dosya silme (yalnız duvar sahibi).
 * Secret istemciye asla inmez; imza burada üretilir.
 *
 * Güvenlik zinciri:
 *  1. Firebase idToken doğrulanır (identitytoolkit REST) → uid
 *  2. walls/{wallId}.ownerId == uid kontrolü (Firestore REST; walls herkese okunur)
 *  3. Cloudinary destroy çağrısı imzalanıp yapılır
 *
 * Env (Vercel, server-side): CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * (+ mevcut NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_FIREBASE_API_KEY,
 *  NEXT_PUBLIC_FIREBASE_PROJECT_ID)
 */
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const KEY = process.env.CLOUDINARY_API_KEY;
  const SECRET = process.env.CLOUDINARY_API_SECRET;
  const FB_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const FB_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!CLOUD || !KEY || !SECRET) {
    return NextResponse.json(
      { ok: false, error: "not-configured", message: "CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET tanımlı değil." },
      { status: 501 }
    );
  }
  if (!FB_KEY || !FB_PROJECT) {
    return NextResponse.json({ ok: false, error: "firebase-env" }, { status: 500 });
  }

  let body: { wallId?: string; cloudinaryId?: string; resourceType?: string; idToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const { wallId, cloudinaryId, idToken } = body;
  const resourceType = body.resourceType === "video" ? "video" : "image";
  if (!wallId || !cloudinaryId || !idToken) {
    return NextResponse.json({ ok: false, error: "missing-params" }, { status: 400 });
  }

  // 1) idToken → uid
  const lookup = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FB_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  if (!lookup.ok) {
    return NextResponse.json({ ok: false, error: "auth-failed" }, { status: 401 });
  }
  const uid: string | undefined = (await lookup.json())?.users?.[0]?.localId;
  if (!uid) return NextResponse.json({ ok: false, error: "auth-failed" }, { status: 401 });

  // 2) sahiplik: walls/{wallId}.ownerId == uid
  const wallRes = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/walls/${wallId}`
  );
  if (!wallRes.ok) return NextResponse.json({ ok: false, error: "wall-not-found" }, { status: 404 });
  const ownerId = (await wallRes.json())?.fields?.ownerId?.stringValue;
  if (ownerId !== uid) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  // Test tohumu / Cloudinary-dışı kayıtlar: silinecek dosya yok
  if (cloudinaryId.startsWith("seed/")) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 3) imzalı destroy
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `invalidate=true&public_id=${cloudinaryId}&timestamp=${timestamp}${SECRET}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");

  const form = new URLSearchParams();
  form.set("public_id", cloudinaryId);
  form.set("invalidate", "true");
  form.set("timestamp", String(timestamp));
  form.set("api_key", KEY);
  form.set("signature", signature);

  const destroy = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/${resourceType}/destroy`, {
    method: "POST",
    body: form,
  });
  const result = await destroy.json().catch(() => ({}));
  if (!destroy.ok || (result.result && result.result !== "ok" && result.result !== "not found")) {
    return NextResponse.json({ ok: false, error: "cloudinary", detail: result }, { status: 502 });
  }
  return NextResponse.json({ ok: true, result: result.result ?? "ok" });
}
