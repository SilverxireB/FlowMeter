import { createReadStream, promises as fs } from "fs";
import path from "path";
import { Readable } from "stream";
import { NextRequest } from "next/server";
import { MEDIA_DIR } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Yerel medya servisi — /media/{wallId}/{dosya}. Perde bunu doğrudan çeker;
 * internet gerekmez. Video için Range (parçalı) istek desteklenir — yoksa
 * tarayıcı videoyu sarıp oynatamaz/atlayamaz. Dosya adları benzersiz zaman
 * damgalı olduğundan agresif cache güvenlidir.
 */
const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  ogv: "video/ogg",
};

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const rel = params.path.map(decodeURIComponent).join("/");
  const file = path.normalize(path.join(MEDIA_DIR, rel));
  // path traversal kilidi: çözümlenen yol medya klasörünün içinde kalmalı
  if (!file.startsWith(path.normalize(MEDIA_DIR) + path.sep)) return new Response("Yasak", { status: 403 });

  let stat;
  try {
    stat = await fs.stat(file);
  } catch {
    return new Response("Bulunamadı", { status: 404 });
  }
  if (!stat.isFile()) return new Response("Bulunamadı", { status: 404 });

  const ext = path.extname(file).slice(1).toLowerCase();
  const type = TYPES[ext] ?? "application/octet-stream";
  const size = stat.size;
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
      if (start <= end && start < size) {
        headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
        headers["Content-Length"] = String(end - start + 1);
        const nodeStream = createReadStream(file, { start, end });
        return new Response(Readable.toWeb(nodeStream) as ReadableStream, { status: 206, headers });
      }
      return new Response("Aralık geçersiz", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
  }

  headers["Content-Length"] = String(size);
  const nodeStream = createReadStream(file);
  return new Response(Readable.toWeb(nodeStream) as ReadableStream, { status: 200, headers });
}
