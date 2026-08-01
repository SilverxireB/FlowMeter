import { NextRequest } from "next/server";
import { emitter, getScreens, getWall, getWallByKey } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE — PUBLIC yayın izleme (perde). Bulma zinciri: güncel slug → eski slug
 * (slugHistory) → doküman id; eski link/QR sahadaki 7/24 ekranı asla karartmaz.
 * Çözüm bulununca duvarın id'sine KİLİTLENİR (ad değişse de id kalıcı);
 * bulunamazsa herhangi bir yazmada yeniden çözmeyi dener.
 */
export async function GET(req: NextRequest, { params }: { params: { key: string } }) {
  const key = decodeURIComponent(params.key);
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      let lockedId: string | null = null;
      const push = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          open = false;
        }
      };
      const send = async () => {
        const wall = lockedId ? await getWall(lockedId) : await getWallByKey(key);
        if (wall && !lockedId) {
          lockedId = wall.id;
          emitter.on(`wall:${wall.id}`, onWall);
        }
        if (!wall && lockedId) {
          // duvar silindi → kilidi bırak, yeniden çözmeye dön
          emitter.off(`wall:${lockedId}`, onWall);
          lockedId = null;
        }
        const screens = wall ? await getScreens(wall.id) : [];
        push(`data: ${JSON.stringify({ found: Boolean(wall), wall, screens })}\n\n`);
      };
      const onWall = () => void send().catch(() => {});
      const onAny = () => {
        if (!lockedId) void send().catch(() => {});
      };
      emitter.on("walls", onAny);
      const ping = setInterval(() => push(`: ping\n\n`), 25_000);
      cleanup = () => {
        open = false;
        emitter.off("walls", onAny);
        if (lockedId) emitter.off(`wall:${lockedId}`, onWall);
        clearInterval(ping);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
      await send();
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  });
}
