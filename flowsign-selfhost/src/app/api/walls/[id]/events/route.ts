import { NextRequest } from "next/server";
import { currentUser, unauthorized } from "@/lib/serverAuth";
import { emitter, getScreens, getWall } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE — kokpit canlı izleme: duvar dokümanı + ekran kalp atışları tek kanalda.
 * Her yazma emitter'ı tetikler → bağlı istemcilere anında gider (onSnapshot
 * karşılığı; internetsiz iç ağda çalışır). Bağlantı koparsa EventSource
 * tarayıcıda kendiliğinden yeniden bağlanır.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await currentUser(req))) return unauthorized();
  const id = params.id;
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const push = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          open = false;
        }
      };
      const send = async () => {
        const wall = await getWall(id);
        const screens = wall ? await getScreens(id) : [];
        push(`data: ${JSON.stringify({ found: Boolean(wall), wall, screens })}\n\n`);
      };
      const onChange = () => void send().catch(() => {});
      emitter.on(`wall:${id}`, onChange);
      // Proxy'ler sessiz bağlantıyı kesmesin: 25sn'de bir yorum satırı
      const ping = setInterval(() => push(`: ping\n\n`), 25_000);
      cleanup = () => {
        open = false;
        emitter.off(`wall:${id}`, onChange);
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
