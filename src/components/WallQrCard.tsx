"use client";

import QRCode from "qrcode";
import { Wall } from "@/lib/types";
import { getWallPreset } from "@/lib/themes";

/**
 * Yazdırılabilir QR kartı — A6 oranında (105×148 mm), 2× çözünürlükle (2100×2960)
 * Canvas'a çizilip PNG indirilir. Masalara konur. Tema rengine uyum sağlar,
 * URL kart üzerinde joinUrl'den türetilir (hardcoded değil), marka ikonu = kamera.
 */

const W = 1050;
const H = 1480;
const SCALE = 2; // baskı keskinliği

interface CardColors { bg: string; fg: string; accent: string; onAccent: string }

function cardColors(wall: Wall): CardColors {
  const preset = getWallPreset(wall.theme?.preset);
  if (preset.id === "dugun") return { bg: "#fbf6f0", fg: "#3d2e1f", accent: "#b0895f", onAccent: "#ffffff" };
  if (preset.id === "kurumsal") return { bg: "#f6f8fc", fg: "#18181b", accent: "#4f46e5", onAccent: "#ffffff" };
  if (preset.id === "yilbasi") return { bg: "#0e1a36", fg: "#e8edf8", accent: "#6bb0f0", onAccent: "#0e1a36" };
  if (preset.id === "parti") return { bg: "#1c0733", fg: "#f0e4ff", accent: "#c084fc", onAccent: "#1c0733" };
  return { bg: "#070c22", fg: "#e6eaf5", accent: "#5b8ef7", onAccent: "#070c22" }; // gece
}

const FONT = (spec: string) => `${spec} "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif`;
const withAlpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, "0");

export async function downloadQrCard(wall: Wall, joinUrl: string): Promise<void> {
  // Yüklü web fontu hazırsa canvas onu kullanabilsin.
  try { await (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready; } catch { /* yoksa fallback */ }

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.textAlign = "center";
  const c = cardColors(wall);
  const isDark = ["#0e1a36", "#1c0733", "#070c22"].includes(c.bg);

  // ── Arka plan + ince çerçeve ──
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  // yumuşak üst renk lekesi (accent ışıltısı)
  const glow = ctx.createRadialGradient(W / 2, 120, 40, W / 2, 120, 620);
  glow.addColorStop(0, withAlpha(c.accent, isDark ? 0.16 : 0.1));
  glow.addColorStop(1, withAlpha(c.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // çerçeve
  ctx.strokeStyle = withAlpha(c.accent, 0.35);
  ctx.lineWidth = 2.5;
  roundRect(ctx, 46, 46, W - 92, H - 92, 40);
  ctx.stroke();

  // ── Eyebrow ──
  ctx.fillStyle = c.accent;
  ctx.font = FONT("700 26px");
  drawSpaced(ctx, "FLOWWALL", W / 2, 132, 8);

  // ── Marka kamera ikonu (O halkası = lens) ──
  drawCamera(ctx, W / 2, 232, 62, c.accent, c.bg);

  // ── Başlık + alt yazı ──
  ctx.fillStyle = c.fg;
  ctx.font = FONT("800 62px");
  ctx.fillText("Anını Paylaş", W / 2, 372);
  ctx.fillStyle = withAlpha(c.fg, 0.7);
  ctx.font = FONT("400 29px");
  ctx.fillText("Fotoğrafını çek, perdede canlı parlasın", W / 2, 418);

  // ── Etkinlik başlığı ──
  const eventTitle = (wall.headline || wall.title || "").trim();
  let qrTop = 508;
  if (eventTitle) {
    ctx.fillStyle = c.accent;
    ctx.font = FONT("700 40px");
    const lines = wrapText(ctx, eventTitle, W - 220).slice(0, 2);
    let y = 494;
    for (const line of lines) { ctx.fillText(line, W / 2, y); y += 50; }
    qrTop = y + 22;
  }

  // ── QR paneli (beyaz, yuvarlak, hafif kenar) ──
  const panel = 520;
  const panelX = (W - panel) / 2;
  const qrSize = 430;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, panelX, qrTop, panel, panel, 36);
  ctx.fill();
  ctx.restore();

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, joinUrl, { width: qrSize * 3, margin: 0, color: { dark: "#0b1020", light: "#ffffff" } });
  const qrX = W / 2 - qrSize / 2;
  const qrY = qrTop + (panel - qrSize) / 2;
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  const belowPanel = qrTop + panel;

  // ── "Karekodu okut" ──
  ctx.fillStyle = c.fg;
  ctx.font = FONT("600 30px");
  ctx.fillText("Karekodu telefonunla okut", W / 2, belowPanel + 62);

  // ── Ayraç: — ya da kodu gir — ──
  ctx.font = FONT("500 24px");
  const orText = "ya da kodu gir";
  const orW = ctx.measureText(orText).width;
  const midY = belowPanel + 108;
  ctx.strokeStyle = withAlpha(c.fg, 0.25);
  ctx.lineWidth = 1.5;
  const gap = orW / 2 + 26;
  line(ctx, W / 2 - gap - 120, midY, W / 2 - gap, midY);
  line(ctx, W / 2 + gap, midY, W / 2 + gap + 120, midY);
  ctx.fillStyle = withAlpha(c.fg, 0.6);
  ctx.fillText(orText, W / 2, midY + 8);

  // ── Katılım kodu (büyük, garantili aralık) ──
  ctx.fillStyle = c.accent;
  ctx.font = FONT("800 96px");
  drawSpaced(ctx, wall.joinCode || "------", W / 2, belowPanel + 210, 14);

  // ── Site adresi (joinUrl'den türetilir) ──
  let host = "";
  try { host = new URL(joinUrl).host; } catch { host = ""; }
  if (host) {
    ctx.fillStyle = withAlpha(c.fg, 0.55);
    ctx.font = FONT("500 26px");
    ctx.fillText(host, W / 2, belowPanel + 262);
  }

  // ── Alt marka ──
  ctx.fillStyle = withAlpha(c.fg, 0.4);
  ctx.font = FONT("700 24px");
  drawSpaced(ctx, "FLOWWALL", W / 2, H - 60, 6);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `flowwall-${wall.joinCode || "kart"}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
}

// ── Çizim yardımcıları ────────────────────────────────────────────────────────

/** Marka kamera ikonu — gövde + tepe + lens (renkli O halkası, logo kimliği). */
function drawCamera(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string, bg: string) {
  const w = s * 1.7, h = s * 1.18;
  const x = cx - w / 2, y = cy - h / 2;
  ctx.fillStyle = color;
  // tepe çıkıntı (vizör)
  roundRect(ctx, cx - s * 0.34, y - s * 0.2, s * 0.68, s * 0.26, s * 0.07);
  ctx.fill();
  // gövde
  roundRect(ctx, x, y, w, h, s * 0.2);
  ctx.fill();
  // lens: eş merkezli katmanlar → bg boşluk + renkli halka + bg göz
  disc(ctx, cx, cy, s * 0.4, bg);     // gövdeden lensi ayıran boşluk
  disc(ctx, cx, cy, s * 0.32, color); // renkli lens halkası (dış)
  disc(ctx, cx, cy, s * 0.18, bg);    // ortadaki göz (boşluk)
  // flaş noktası
  disc(ctx, x + w - s * 0.22, y + s * 0.24, s * 0.055, bg);
}

/** Dolu daire çizer. */
function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Metni sabit harf aralığıyla çizer (canvas letterSpacing desteğine bağımlı değil). */
function drawSpaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, gap: number) {
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((s, w) => s + w, 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + gap;
  });
  ctx.textAlign = prevAlign;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [text];
}
