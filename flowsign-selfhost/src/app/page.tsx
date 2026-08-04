import { redirect } from "next/navigation";
import { ayar } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Kök adres. "Varsayılan ekran" ayarlıysa doğrudan O EKRANIN YAYININA gider —
 * bir televizyonu adres yazmadan açabilmek için (fabrikada ekranı kuran kişi
 * uzun slug'ı elle yazmak zorunda kalıyordu). Ayarsızsa ekran listesine.
 */
export default async function Home() {
  const varsayilan = (await ayar("varsayilanEkran")).trim();
  redirect(varsayilan ? `/play/${encodeURIComponent(varsayilan)}` : "/screens");
}
