/**
 * FlowWall hatıra kitabı — tüm foto + dilekleri A4 PDF'e dizer ("anı defteri").
 * jsPDF dinamik import (SSR güvenli); görseller Cloudinary'den dataURL olarak
 * gömülür (yüklenemeyen atlanır). Sahip kokpitten üretir.
 */
import { Wall, WallMedia, WallWish } from "./types";
import { cldFit, cldVideoPoster } from "./cloudinary";
import { getWallPreset } from "./themes";

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function coverColors(wall: Wall): { bg: string; fg: string; accent: string } {
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

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const b = await r.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => res(null);
      fr.readAsDataURL(b);
    });
  } catch {
    return null;
  }
}

export async function generateMemoryBook(
  wall: Wall,
  media: WallMedia[],
  wishes: WallWish[],
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const approved = media.filter((m) => m.status === "approved");
  const photos = [...approved].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)).slice(0, 120);
  const okWishes = wishes.filter((w) => (w.status ?? "approved") === "approved");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const PW = 210, PH = 297, c = coverColors(wall);
  const [br, bgc, bb] = rgb(c.bg);
  const [ar, ag, ab] = rgb(c.accent);
  const [fr, fg, fb] = rgb(c.fg);

  // ── Kapak (temalı) ──
  doc.setFillColor(br, bgc, bb);
  doc.rect(0, 0, PW, PH, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(ar, ag, ab);
  doc.setFontSize(14);
  doc.text("F L O W W A L L", PW / 2, 40, { align: "center" });
  doc.setTextColor(fr, fg, fb);
  doc.setFontSize(30);
  doc.text(wall.headline || wall.title || "FlowWall", PW / 2, 128, { align: "center", maxWidth: PW - 30 });
  const participants = new Set(approved.map((m) => m.voterId)).size;
  const likes = approved.reduce((s, m) => s + (m.likes ?? 0), 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`${approved.length} anı  ·  ${participants} kişi  ·  ${likes} beğeni`, PW / 2, 152, { align: "center" });

  // ── Foto sayfaları (beyaz, 2×3) ──
  const cols = 2, rows = 3, margin = 14, gap = 8, capH = 8;
  const cw = (PW - margin * 2 - gap * (cols - 1)) / cols;
  const ch = (PH - margin * 2 - gap * (rows - 1) - capH * rows) / rows;
  for (let i = 0; i < photos.length; i++) {
    if (i % (cols * rows) === 0) doc.addPage();
    const m = photos[i];
    const slot = i % (cols * rows);
    const cx = margin + (slot % cols) * (cw + gap);
    const cy = margin + Math.floor(slot / cols) * (ch + gap + capH);
    const url = m.type === "video" ? cldVideoPoster(m.url, 900, 900) : cldFit(m.url, 900);
    const data = await toDataUrl(url);
    if (data) {
      const r = m.w && m.h ? m.w / m.h : 1;
      let iw = cw, ih = cw / r;
      if (ih > ch) { ih = ch; iw = ch * r; }
      const ix = cx + (cw - iw) / 2, iy = cy + (ch - ih) / 2;
      try { doc.addImage(data, "JPEG", ix, iy, iw, ih); } catch { /* atla */ }
    }
    if (m.nickname) {
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(9);
      doc.text(m.nickname.slice(0, 32), cx + cw / 2, cy + ch + 5, { align: "center" });
    }
    onProgress?.(i + 1, photos.length);
  }

  // ── Dilek sayfaları (beyaz) ──
  if (okWishes.length) {
    doc.addPage();
    doc.setTextColor(ar, ag, ab);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Dilekler", PW / 2, 26, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(12);
    let y = 44;
    for (const w of okWishes) {
      const lines = doc.splitTextToSize(`"${w.text}"${w.nickname ? "  — " + w.nickname : ""}`, PW - 40);
      if (y + lines.length * 7 > PH - 18) { doc.addPage(); y = 26; }
      doc.text(lines, 20, y);
      y += lines.length * 7 + 6;
    }
  }

  // ── Arka kapak ──
  doc.addPage();
  doc.setFillColor(br, bgc, bb);
  doc.rect(0, 0, PW, PH, "F");
  doc.setTextColor(ar, ag, ab);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FLOWWALL", PW / 2, PH / 2, { align: "center" });

  doc.save(`flowwall-ani-defteri-${wall.joinCode || "kart"}.pdf`);
}
