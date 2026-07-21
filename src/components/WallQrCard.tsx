"use client";

import QRCode from "qrcode";
import { Wall } from "@/lib/types";
import { getWallPreset } from "@/lib/themes";

/**
 * Yazdırılabilir QR kartı — A6 oranında (1050×1480 px, ~300 DPI) Canvas ile
 * çizilip PNG olarak indirilir. Masalara konur: "📸 Anını paylaş" + QR + kod.
 */

/** Duvarın tema preset renginden koyu renk türetir (kart arka planı). */
function cardColors(wall: Wall): { bg: string; fg: string; accent: string; qrDark: string } {
  const preset = getWallPreset(wall.theme?.preset);
  if (preset.id === "dugun") {
    return { bg: "#fdf8f4", fg: "#3d2e1f", accent: "#b08968", qrDark: "#3d2e1f" };
  }
  if (preset.id === "kurumsal") {
    return { bg: "#f8f9fc", fg: "#18181b", accent: "#4f46e5", qrDark: "#18181b" };
  }
  if (preset.id === "yilbasi") {
    return { bg: "#0e1a36", fg: "#e8edf8", accent: "#5ba3e8", qrDark: "#5ba3e8" };
  }
  if (preset.id === "parti") {
    return { bg: "#1e0838", fg: "#f0e4ff", accent: "#c084fc", qrDark: "#c084fc" };
  }
  // Varsayılan (gece)
  return { bg: "#05091c", fg: "#e2e6f0", accent: "#4f8ef7", qrDark: "#4f8ef7" };
}

export async function downloadQrCard(wall: Wall, joinUrl: string): Promise<void> {
  const W = 1050;
  const H = 1480;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const colors = cardColors(wall);

  // ── Arka plan ──
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);

  // İnce dekoratif çerçeve
  ctx.strokeStyle = colors.accent + "30";
  ctx.lineWidth = 3;
  roundRect(ctx, 40, 40, W - 80, H - 80, 32);
  ctx.stroke();

  // ── Üst: Kamera ikonu + CTA ──
  const topY = 140;
  ctx.font = "bold 72px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.fg;
  ctx.textAlign = "center";
  ctx.fillText("📸", W / 2, topY);

  ctx.font = "bold 56px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.fg;
  ctx.fillText("Anını paylaş!", W / 2, topY + 80);

  // Alt açıklama
  ctx.font = "32px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.fg + "99";
  ctx.fillText("Fotoğrafını at, perdede parla", W / 2, topY + 130);

  // ── Etkinlik başlığı ──
  const title = wall.headline || wall.title || "FlowWall";
  ctx.font = "bold 40px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.accent;
  const titleLines = wrapText(ctx, title, W - 160);
  let titleY = topY + 200;
  for (const line of titleLines) {
    ctx.fillText(line, W / 2, titleY);
    titleY += 48;
  }

  // ── QR Kod ──
  const qrSize = 420;
  const qrX = (W - qrSize) / 2;
  const qrY = titleY + 20;

  // Beyaz QR arka planı (koyu temalarda okunabilirlik)
  const qrPad = 24;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, qrX - qrPad, qrY - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2, 24);
  ctx.fill();

  // QR'ı ayrı canvas'a çizip yapıştır
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, joinUrl, {
    width: qrSize * 2,
    margin: 1,
    color: { dark: "#0b0b0b", light: "#ffffff" },
  });
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  // ── Katılım kodu ──
  const codeY = qrY + qrSize + 140;

  const code = wall.joinCode || "------";
  ctx.font = "bold 96px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.accent;
  ctx.letterSpacing = "16px";
  ctx.fillText(code, W / 2, codeY);
  ctx.letterSpacing = "0px";

  // ── Katılım URL'si ──
  ctx.font = "26px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.fg + "88";
  ctx.fillText("https://flowmetermanisa.vercel.app/wall", W / 2, codeY + 70);

  // ── Alt: FlowWall markası ──
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.fg + "44";
  ctx.fillText("FLOWWALL", W / 2, H - 70);

  // ── İndir ──
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `flowwall-qr-${wall.joinCode || "kart"}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
}

/** Canvas'ta yuvarlak köşeli dikdörtgen çizer (path ekler, doldurmaz). */
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

/** Metni verilen genişliğe göre satırlara böler. */
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
