/**
 * Anı Filmi — canvas render çekirdeği. Tek `renderFrame` hem canlı önizlemeyi
 * (rAF) hem MP4 encode'unu (kare kare) besler → animasyon mantığı tek yerde.
 */
import { Wall } from "@/lib/types";
import { cldFit, cldVideoPoster } from "@/lib/cloudinary";
import { getWallPreset } from "@/lib/themes";
import { FilmScene, PhotoScene, TRANSITION_MS } from "./timeline";

export interface Palette {
  bg: string;
  bg2: string;
  fg: string;
  sub: string;
  accent: string;
}

export function filmColors(wall: Wall): Palette {
  switch (getWallPreset(wall.theme?.preset).id) {
    case "dugun": return { bg: "#2a1d12", bg2: "#3d2a18", fg: "#fbf1e6", sub: "#e6cdae", accent: "#d9a566" };
    case "kurumsal": return { bg: "#0f1424", bg2: "#1b2540", fg: "#f4f7ff", sub: "#c3ccdf", accent: "#7c93ff" };
    case "yilbasi": return { bg: "#052018", bg2: "#083a2a", fg: "#e9f7f0", sub: "#a8d9c5", accent: "#34d399" };
    case "parti": return { bg: "#1a0630", bg2: "#2e0d52", fg: "#f3e8ff", sub: "#d4b8f2", accent: "#c084fc" };
    case "mercan": return { bg: "#2e0d16", bg2: "#4a1522", fg: "#ffe8ec", sub: "#f2b8c2", accent: "#fb7185" };
    case "okyanus": return { bg: "#04202a", bg2: "#083445", fg: "#e4f6fb", sub: "#a8dce8", accent: "#22d3ee" };
    case "antrasit": return { bg: "#141418", bg2: "#222229", fg: "#eaeaee", sub: "#b8b8c2", accent: "#a5b4fc" };
    default: return { bg: "#060a1c", bg2: "#0e1533", fg: "#e9edfb", sub: "#aeb8dc", accent: "#5b8ef7" };
  }
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Foto sahnelerinin görsellerini CORS-temiz önyükler (encode canvas'ı kirletmesin). */
export function photoSrc(s: PhotoScene, longEdge: number): string {
  const m = s.media;
  return m.type === "video" ? cldVideoPoster(m.url, longEdge, longEdge) : cldFit(m.url, longEdge);
}

export function preloadImage(src: string): Promise<HTMLImageElement | null> {
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

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Resmin bulanık dolgu arka planını resim başına BİR KEZ üretir (küçük canvas'a
 * cover çizip büyütünce yumuşak blur; kare başına maliyet ~yok). img üstünde
 * önbelleklenir; yön (W:H) değişirse yeniden üretir.
 */
function getBlurBg(img: HTMLImageElement, W: number, H: number): HTMLCanvasElement {
  const key = `${W}x${H}`;
  const store = img as HTMLImageElement & { _blurBg?: HTMLCanvasElement; _blurBgKey?: string };
  if (store._blurBgKey === key && store._blurBg) return store._blurBg;
  const bw = 128;
  const bh = Math.max(1, Math.round((128 * H) / W));
  const c = document.createElement("canvas");
  c.width = bw;
  c.height = bh;
  const cx = c.getContext("2d");
  if (cx) {
    const cover = Math.max(bw / img.width, bh / img.height);
    const dw = img.width * cover;
    const dh = img.height * cover;
    cx.drawImage(img, (bw - dw) / 2, (bh - dh) / 2, dw, dh);
  }
  store._blurBg = c;
  store._blurBgKey = key;
  return c;
}

/** Resmi TAM göster (contain) + kenarları bulanık dolgu; yüzler kırpılmaz. Ken Burns yumuşak. */
function drawPhoto(ctx: CanvasRenderingContext2D, s: PhotoScene, img: HTMLImageElement, p: number, W: number, H: number, pal: Palette) {
  // 1) Bulanık dolgu arka plan (küçük canvas büyütülünce yumuşak blur) + hafif karartma
  ctx.drawImage(getBlurBg(img, W, H), 0, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.fillRect(0, 0, W, H);

  // 2) Foreground — tüm resim görünür (contain) + Ken Burns (DOĞRUSAL → yavaş,
  //    sürekli sürüklenme; ease-in-out sahne ortasında "hızlı zoom" hissi veriyordu).
  const e = clamp01(p);
  const scale = s.ken.fromScale + (s.ken.toScale - s.ken.fromScale) * e;
  const tx = (s.ken.fromX + (s.ken.toX - s.ken.fromX) * e) * W;
  const ty = (s.ken.fromY + (s.ken.toY - s.ken.fromY) * e) * H;
  const contain = Math.min(W / img.width, H / img.height) * scale;
  const dw = img.width * contain;
  const dh = img.height * contain;
  ctx.save();
  ctx.translate(W / 2 + tx, H / 2 + ty);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  // Alt degrade + isim çipi (okunurluk + sinematik his)
  const g = ctx.createLinearGradient(0, H * 0.62, 0, H);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, H * 0.62, W, H * 0.38);

  if (s.crownded) {
    ctx.font = `600 ${Math.round(H * 0.026)}px system-ui, sans-serif`;
    ctx.fillStyle = pal.accent;
    ctx.textAlign = "left";
    ctx.fillText("👑 En sevilen", W * 0.06, H * 0.9);
  }
  if (s.media.nickname) {
    ctx.font = `700 ${Math.round(H * 0.03)}px system-ui, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(s.media.nickname.slice(0, 28), W * 0.06, H * 0.95);
  }
}

function drawCardBg(ctx: CanvasRenderingContext2D, W: number, H: number, pal: Palette, bg: HTMLImageElement | null) {
  if (bg) {
    const cover = Math.max(W / bg.width, H / bg.height);
    ctx.drawImage(bg, (W - bg.width * cover) / 2, (H - bg.height * cover) / 2, bg.width * cover, bg.height * cover);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, pal.bg);
    g.addColorStop(1, pal.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawCenteredBlock(ctx: CanvasRenderingContext2D, lines: { text: string; size: number; weight: number; color: string; gap: number }[], W: number, H: number) {
  const totalH = lines.reduce((s, l) => s + l.size + l.gap, 0);
  let y = H / 2 - totalH / 2;
  ctx.textAlign = "center";
  for (const l of lines) {
    y += l.size;
    ctx.font = `${l.weight} ${l.size}px system-ui, sans-serif`;
    ctx.fillStyle = l.color;
    ctx.fillText(l.text, W / 2, y);
    y += l.gap;
  }
}

/**
 * Verilen global zamanda (ms) tüm kareyi çizer. Aktif sahneleri crossfade ile
 * bindirir. `images` = foto sahne id → yüklü görsel (null olabilir).
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  scenes: FilmScene[],
  totalMs: number,
  t: number,
  W: number,
  H: number,
  pal: Palette,
  images: Map<string, HTMLImageElement | null>,
  bg: HTMLImageElement | null
) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  for (const s of scenes) {
    const lt = t - s.startMs;
    if (lt < -1 || lt > s.durMs) continue;
    const p = clamp01(lt / s.durMs);
    // crossfade alfası: ilk/son TRANSITION_MS'de yumuşak giriş/çıkış
    const fadeIn = clamp01(lt / TRANSITION_MS);
    const fadeOut = clamp01((s.durMs - lt) / TRANSITION_MS);
    const alpha = Math.min(fadeIn, fadeOut);
    if (alpha <= 0) continue;

    ctx.globalAlpha = alpha;
    if (s.type === "photo") {
      const img = images.get(s.media.id) ?? null;
      if (img) {
        drawPhoto(ctx, s, img, p, W, H, pal);
      } else {
        drawCardBg(ctx, W, H, pal, bg);
      }
    } else if (s.type === "title") {
      drawCardBg(ctx, W, H, pal, bg);
      ctx.fillStyle = pal.accent;
      ctx.textAlign = "center";
      ctx.font = `700 ${Math.round(H * 0.022)}px system-ui, sans-serif`;
      ctx.fillText("F L O W W A L L", W / 2, H * 0.4);
      drawCenteredBlock(ctx, [
        { text: s.title.slice(0, 40), size: Math.round(H * 0.055), weight: 800, color: pal.fg, gap: Math.round(H * 0.02) },
        { text: s.subtitle, size: Math.round(H * 0.028), weight: 500, color: pal.sub, gap: 0 },
      ], W, H);
    } else if (s.type === "wish") {
      drawCardBg(ctx, W, H, pal, bg);
      ctx.fillStyle = pal.accent;
      ctx.font = `${Math.round(H * 0.06)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("💌", W / 2, H * 0.3);
      ctx.font = `600 ${Math.round(H * 0.04)}px system-ui, sans-serif`;
      const lines = wrapLines(ctx, s.text.slice(0, 140), W * 0.8);
      drawCenteredBlock(ctx, lines.map((text) => ({ text, size: Math.round(H * 0.04), weight: 600, color: pal.fg, gap: Math.round(H * 0.014) })), W, H);
      if (s.nickname) {
        ctx.font = `500 ${Math.round(H * 0.026)}px system-ui, sans-serif`;
        ctx.fillStyle = pal.sub;
        ctx.textAlign = "center";
        ctx.fillText(`— ${s.nickname.slice(0, 28)}`, W / 2, H * 0.72);
      }
    } else {
      // outro
      drawCardBg(ctx, W, H, pal, bg);
      drawCenteredBlock(ctx, [
        { text: "Teşekkürler", size: Math.round(H * 0.06), weight: 800, color: pal.fg, gap: Math.round(H * 0.03) },
        { text: `${s.memories} anı  ·  ${s.people} kişi  ·  ❤ ${s.likes}`, size: Math.round(H * 0.032), weight: 600, color: pal.accent, gap: 0 },
      ], W, H);
    }
    ctx.globalAlpha = 1;
  }

  // Hafif vinyet — sinematik derinlik
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}
