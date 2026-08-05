import { NextRequest } from "next/server";
import { emitter } from "@/lib/store";
import { getSahne } from "@/lib/sahneStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SSE — sahneyi canlı izle. PUBLIC (perde auth istemez): /sahne/{id} yayın
 * sayfası ve Sign perdesindeki yerel çizim bunu dinler; foto/mod değişikliği
 * ANINDA düşer. Bağlantı koparsa EventSource kendiliğinden yeniden bağlanır.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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
        const sahne = await getSahne(id);
        push(`data: ${JSON.stringify({ found: Boolean(sahne), sahne })}\n\n`);
      };
      const onChange = () => void send().catch(() => {});
      emitter.on(`sahne:${id}`, onChange);
      // Proxy'ler sessiz bağlantıyı kesmesin: 25sn'de bir yorum satırı
      const ping = setInterval(() => push(`: ping\n\n`), 25_000);
      cleanup = () => {
        open = false;
        emitter.off(`sahne:${id}`, onChange);
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
