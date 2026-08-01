/**
 * FlowSign self-host — tek yönetici parolası + imzalı çerez oturumu.
 * Fabrika iç ağı modeli: yayın (perde) linki AUTH İSTEMEZ; kokpit/yazma
 * uçları bu çerezi arar. Parola .env'de (SIGN_ADMIN_PASSWORD).
 */
import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

export const SESSION_COOKIE = "flowsign_session";

function adminPassword(): string {
  return process.env.SIGN_ADMIN_PASSWORD || "";
}

/** Oturum belirteci: parolaya bağlı HMAC — parola değişince tüm oturumlar düşer. */
export function sessionToken(): string {
  return createHmac("sha256", `flowsign:${adminPassword()}`).update("admin-session-v1").digest("hex");
}

export function checkPassword(pw: string): boolean {
  const expected = adminPassword();
  if (!expected) return false; // parola tanımlanmadan giriş yok (güvenli varsayılan)
  const a = Buffer.from(pw);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isAuthed(req: NextRequest): boolean {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  const expected = sessionToken();
  if (!adminPassword() || cookie.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
}

export const unauthorized = () => Response.json({ error: "Oturum gerekli" }, { status: 401 });
