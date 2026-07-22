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

/**
 * Plus Jakarta Sans'ı (repo içi statik TTF, Türkçe subset) jsPDF'e gömer.
 * jsPDF'in gömülü helvetica'sı WinAnsi (cp1252) → ğ/ş/İ/ı bozuk çıkar; gömülü
 * Unicode font ile Türkçe düzgün. Font /public'ten çekilir (kendi domain, dış
 * servis yok). Başarısız olursa false döner → çağıran helvetica'ya düşer.
 */
async function embedJakarta(doc: import("jspdf").jsPDF): Promise<boolean> {
  try {
    const load = async (path: string): Promise<string> => {
      const r = await fetch(path);
      if (!r.ok) throw new Error(String(r.status));
      const buf = new Uint8Array(await r.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      return btoa(bin);
    };
    const [reg, bold] = await Promise.all([
      load("/fonts/PlusJakartaSans-Regular.ttf"),
      load("/fonts/PlusJakartaSans-Bold.ttf"),
    ]);
    doc.addFileToVFS("PlusJakartaSans-Regular.ttf", reg);
    doc.addFont("PlusJakartaSans-Regular.ttf", "Jakarta", "normal");
    doc.addFileToVFS("PlusJakartaSans-Bold.ttf", bold);
    doc.addFont("PlusJakartaSans-Bold.ttf", "Jakarta", "bold");
    return true;
  } catch {
    return false;
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
  // Türkçe karakterler için Plus Jakarta Sans göm; olmazsa helvetica'ya düş.
  const FONT = (await embedJakarta(doc)) ? "Jakarta" : "helvetica";
  const PW = 210, PH = 297, c = coverColors(wall);
  const [br, bgc, bb] = rgb(c.bg);
  const [ar, ag, ab] = rgb(c.accent);
  const [fr, fg, fb] = rgb(c.fg);

  // Renk yardımcıları — accent/fg'yi bg'ye doğru karıştırıp ince tonlar üret.
  const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
    [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
  const setFill = (c3: [number, number, number]) => doc.setFillColor(c3[0], c3[1], c3[2]);
  const setDraw = (c3: [number, number, number]) => doc.setDrawColor(c3[0], c3[1], c3[2]);
  const setText = (c3: [number, number, number]) => doc.setTextColor(c3[0], c3[1], c3[2]);
  const bg: [number, number, number] = [br, bgc, bb];
  const accent: [number, number, number] = [ar, ag, ab];
  const ink: [number, number, number] = [fr, fg, fb];
  const participants = new Set(approved.map((m) => m.voterId)).size;
  const likes = approved.reduce((s, m) => s + (m.likes ?? 0), 0);
  let dateStr = "";
  try { dateStr = new Date().toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" }); } catch { /* yoksay */ }

  // ── Kapak ─────────────────────────────────────────────────────────────────
  setFill(bg);
  doc.rect(0, 0, PW, PH, "F");
  // İnce çerçeve (accent'in bg'ye karışmış hafif tonu)
  doc.setLineWidth(0.5);
  setDraw(mix(accent, bg, 0.55));
  doc.roundedRect(12, 12, PW - 24, PH - 24, 4, 4, "S");
  // Eyebrow + kısa accent çizgi
  doc.setFont(FONT, "bold");
  setText(accent);
  doc.setFontSize(12);
  doc.text("F L O W W A L L", PW / 2, 56, { align: "center" });
  doc.setLineWidth(1.2);
  setDraw(accent);
  doc.line(PW / 2 - 14, 62, PW / 2 + 14, 62);
  // Başlık
  setText(ink);
  doc.setFontSize(32);
  const title = wall.headline || wall.title || "FlowWall";
  doc.text(title, PW / 2, 132, { align: "center", maxWidth: PW - 44 });
  // İstatistik satırı
  doc.setFont(FONT, "normal");
  doc.setFontSize(12.5);
  setText(mix(ink, bg, 0.35));
  doc.text(`${approved.length} anı   ·   ${participants} kişi   ·   ${likes} beğeni`, PW / 2, 150, { align: "center" });
  // Alt bilgi
  doc.setFont(FONT, "bold");
  doc.setFontSize(10);
  setText(mix(accent, bg, 0.2));
  doc.text("A N I   D E F T E R İ", PW / 2, PH - 40, { align: "center" });
  if (dateStr) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(9.5);
    setText(mix(ink, bg, 0.45));
    doc.text(dateStr, PW / 2, PH - 32, { align: "center" });
  }

  // ── Foto sayfaları — "albüm kartları" (gölge + çerçeve + başlık bandı) ─────
  const PAPER: [number, number, number] = [250, 249, 247];
  const CARD: [number, number, number] = [255, 255, 255];
  const SHADOW: [number, number, number] = [226, 224, 220];
  const BORDER: [number, number, number] = [232, 231, 228];
  const CAP: [number, number, number] = [92, 90, 86];
  const cols = 2, rows = 3, mX = 12, top = 15, bottom = 17, gap = 7;
  const cardW = (PW - mX * 2 - gap * (cols - 1)) / cols;
  const cardH = (PH - top - bottom - gap * (rows - 1)) / rows;
  const per = cols * rows;
  const pages = Math.max(1, Math.ceil(photos.length / per));
  for (let i = 0; i < photos.length; i++) {
    const slot = i % per;
    if (slot === 0) {
      doc.addPage();
      setFill(PAPER);
      doc.rect(0, 0, PW, PH, "F");
      // Sayfa altı: akış rozeti + sayfa no
      doc.setFont(FONT, "normal");
      doc.setFontSize(8);
      setText([170, 168, 164]);
      doc.text("flowwall", mX, PH - 8);
      doc.text(`${Math.floor(i / per) + 1} / ${pages}`, PW - mX, PH - 8, { align: "right" });
    }
    const m = photos[i];
    const cx = mX + (slot % cols) * (cardW + gap);
    const cy = top + Math.floor(slot / cols) * (cardH + gap);
    // Gölge + kart
    setFill(SHADOW);
    doc.roundedRect(cx + 1.3, cy + 1.8, cardW, cardH, 3, 3, "F");
    setFill(CARD);
    setDraw(BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, cy, cardW, cardH, 3, 3, "FD");
    // Görsel alanı (içte pad, altta başlık bandı)
    const pad = 4;
    const capBand = m.nickname ? 9 : pad;
    const areaX = cx + pad, areaY = cy + pad;
    const areaW = cardW - pad * 2, areaH = cardH - pad - capBand;
    const url = m.type === "video" ? cldVideoPoster(m.url, 900, 900) : cldFit(m.url, 900);
    const data = await toDataUrl(url);
    if (data) {
      const r = m.w && m.h ? m.w / m.h : 1;
      let iw = areaW, ih = areaW / r;
      if (ih > areaH) { ih = areaH; iw = areaH * r; }
      const ix = areaX + (areaW - iw) / 2, iy = areaY + (areaH - ih) / 2;
      try { doc.addImage(data, "JPEG", ix, iy, iw, ih); } catch { /* atla */ }
    }
    if (m.nickname) {
      doc.setFont(FONT, "normal");
      setText(CAP);
      doc.setFontSize(9);
      doc.text(m.nickname.slice(0, 34), cx + cardW / 2, cy + cardH - 3.5, { align: "center", maxWidth: cardW - 6 });
    }
    onProgress?.(i + 1, photos.length);
  }

  // ── Dilek sayfaları — accent şeritli alıntı kartları ──────────────────────
  if (okWishes.length) {
    const newWishPage = (withTitle: boolean): number => {
      doc.addPage();
      setFill(PAPER);
      doc.rect(0, 0, PW, PH, "F");
      if (withTitle) {
        doc.setFont(FONT, "bold");
        setText(accent);
        doc.setFontSize(24);
        doc.text("Dilekler", PW / 2, 30, { align: "center" });
        doc.setLineWidth(1.2);
        setDraw(accent);
        doc.line(PW / 2 - 12, 36, PW / 2 + 12, 36);
        return 48;
      }
      return 22;
    };
    let y = newWishPage(true);
    const wX = 14, wW = PW - 28, txtX = wX + 9, txtW = wW - 14;
    for (const w of okWishes) {
      doc.setFont(FONT, "normal");
      doc.setFontSize(12);
      const lines = doc.splitTextToSize(w.text, txtW) as string[];
      const nick = w.nickname ? `— ${w.nickname}` : "";
      const cardH2 = 8 + lines.length * 6 + (nick ? 6 : 0) + 6;
      if (y + cardH2 > PH - 16) y = newWishPage(false);
      // kart + sol accent şerit
      setFill(CARD);
      setDraw(BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(wX, y, wW, cardH2, 2.5, 2.5, "FD");
      setFill(accent);
      doc.roundedRect(wX, y, 2.5, cardH2, 1.2, 1.2, "F");
      // metin
      setText([46, 44, 42]);
      doc.text(lines, txtX, y + 9);
      if (nick) {
        doc.setFontSize(10);
        setText(mix(CAP, PAPER, 0));
        doc.text(nick, PW - 18, y + cardH2 - 5, { align: "right" });
      }
      y += cardH2 + 6;
    }
  }

  // ── Arka kapak ────────────────────────────────────────────────────────────
  doc.addPage();
  setFill(bg);
  doc.rect(0, 0, PW, PH, "F");
  doc.setFont(FONT, "bold");
  setText(accent);
  doc.setFontSize(18);
  doc.text("FLOWWALL", PW / 2, PH / 2 - 4, { align: "center" });
  doc.setFont(FONT, "normal");
  doc.setFontSize(10);
  setText(mix(ink, bg, 0.4));
  doc.text("Bu anı defteri FlowWall ile oluşturuldu", PW / 2, PH / 2 + 6, { align: "center" });
  if (wall.joinCode) {
    doc.setFontSize(9);
    setText(mix(ink, bg, 0.55));
    doc.text(`Katılım kodu · ${wall.joinCode}`, PW / 2, PH / 2 + 14, { align: "center" });
  }

  doc.save(`flowwall-ani-defteri-${wall.joinCode || "kart"}.pdf`);
}
