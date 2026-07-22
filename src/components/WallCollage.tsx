"use client";

/**
 * FlowWall kolaj/kapak — etkinlik özetini tek PNG'de toplar (foto ızgarası +
 * başlık + istatistik). Client-side canvas; Cloudinary thumb'ları CORS ile
 * yüklenir (yüklenemeyen atlanır). Sahip kokpitten indirir.
 */
import { Wall, WallMedia } from "@/lib/types";
import { cldThumb, cldVideoPoster } from "@/lib/cloudinary";
import { getWallPreset } from "@/lib/themes";

function colors(wall: Wall): { bg: string; fg: string; accent: string } {
  switch (getWallPreset(wall.theme?.preset).id) {
    case "dugun": return { bg: "#fbf6f0", fg: "#3d2e1f", accent: "#b0895f" };
    case "kurumsal": return { bg: "#f6f8fc", fg: "#18181b", accent: "#4f46e5" };
    case "yilbasi": return { bg: "#06231a", fg: "#e6f5ee", accent: "#34d399" };
    case "parti": return { bg: "#1c0733", fg: "#f0e4ff", accent: "#c084fc" };
    case "mercan": return { bg: "#34101a", fg: "#ffe8ea", accent: "#fb7185" };
    case "okyanus": return { bg: "#06232e", fg: "#e4f6fb", accent: "#22d3ee" };
    case "antrasit": return { bg: "#17171b", fg: "#eaeaee", accent: "#a5b4fc" };
    default: return { bg: "#070c22", fg: "#e6eaf5", accent: "#5b8ef7" };
  }
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function downloadCollage(wall: Wall, media: WallMedia[]): Promise<void> {
  const approved = media.filter((m) => m.status === "approved");
  if (approved.length === 0) return;
  // Seçim: en çok beğenilen önce, en fazla 24 (hepsi zaten dahil, beğeniye göre sıralı).
  const pick = [...approved].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 24);
  const n = pick.length;

  const W = 1600, H = 1600, c = colors(wall);
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  // Başlık
  ctx.fillStyle = c.accent;
  ctx.font = '700 28px system-ui, sans-serif';
  ctx.fillText("F L O W W A L L", W / 2, 78);
  ctx.fillStyle = c.fg;
  ctx.font = '800 60px system-ui, sans-serif';
  const title = (wall.headline || wall.title || "FlowWall").slice(0, 42);
  ctx.fillText(title, W / 2, 150);

  // Izgara
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  const gap = 16, top = 200, bottom = 120, side = 60;
  const cell = Math.min((W - side * 2 - gap * (cols - 1)) / cols, (H - top - bottom - gap * (rows - 1)) / rows);
  const gridW = cols * cell + gap * (cols - 1);
  const startX = (W - gridW) / 2;
  const px = Math.round(cell);
  const imgs = await Promise.all(pick.map((m) => loadImg(m.type === "video" ? cldVideoPoster(m.url, px, px) : cldThumb(m.url, px, px))));
  imgs.forEach((img, i) => {
    const cx = startX + (i % cols) * (cell + gap);
    const cy = top + Math.floor(i / cols) * (cell + gap);
    if (!img) {
      ctx.fillStyle = c.accent + "22";
      roundRect(ctx, cx, cy, cell, cell, 14); ctx.fill();
      return;
    }
    ctx.save();
    roundRect(ctx, cx, cy, cell, cell, 14);
    ctx.clip();
    // c_fill benzeri: kareye ortalayarak sığdır
    ctx.drawImage(img, cx, cy, cell, cell);
    ctx.restore();
  });

  // İstatistik
  const participants = new Set(approved.map((m) => m.voterId)).size;
  const likes = approved.reduce((s, m) => s + (m.likes ?? 0), 0);
  ctx.fillStyle = c.fg;
  ctx.font = '600 30px system-ui, sans-serif';
  ctx.fillText(`${approved.length} anı  ·  ${participants} kişi  ·  ❤ ${likes}`, W / 2, H - 52);

  cv.toBlob((b) => {
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `flowwall-kolaj-${wall.joinCode || "kart"}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
}
