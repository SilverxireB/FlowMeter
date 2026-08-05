/**
 * FOTO SAHNE veri katmanı (online) — koleksiyon: `sahneler/{id}`.
 *
 * Wall mantığı, sadeleşmiş: sahne KENDİ linki olan bağımsız bir kayıttır;
 * taslak/yayın katmanı YOK — yapılan değişiklik linke ANINDA düşer (kullanıcı
 * onayı). Fotoğraflar `flowsign/sahne/{id}/` klasörüne yüklenir (ekran
 * klasörlerinden ayrı — ekran silme sahneye değemez).
 *
 * Yetki (rules): okuma herkese açık (perde auth istemez), oluşturma giriş
 * yapmış herkese, güncelleme giriş yapmış herkese (fabrika içi delegasyon:
 * sahnenin linkini verdiğin kişi fotoğrafları yönetir), silme sahibi/yönetici.
 */
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { FotoSahneKaydi, SAHNE_MODU_VARSAYILAN, SahneFoto } from "./fotoSahne";

const stripUndefined = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export async function createSahne(ownerId: string, name: string, ownerName?: string): Promise<string> {
  const ref = await addDoc(collection(db(), "sahneler"), {
    ownerId,
    ownerName: ownerName ?? "",
    name: name.trim() || "Foto sahne",
    mod: SAHNE_MODU_VARSAYILAN,
    fotolar: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export function watchSahne(id: string, cb: (s: FotoSahneKaydi | null) => void): () => void {
  return onSnapshot(
    doc(db(), "sahneler", id),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as FotoSahneKaydi) : null),
    () => cb(null)
  );
}

/** Ad / mod / efekt / fotolar (yazı düzenleme fotolar'ın tamamını yazar). */
export async function updateSahne(id: string, patch: Partial<FotoSahneKaydi>): Promise<void> {
  const { id: _i, ownerId: _o, createdAt: _c, ...rest } = patch;
  await updateDoc(doc(db(), "sahneler", id), { ...stripUndefined(rest), updatedAt: serverTimestamp() });
}

/** arrayUnion: iki kişi aynı anda yüklese de birbirinin fotoğrafını ezmez. */
export async function addSahneFoto(id: string, foto: SahneFoto): Promise<void> {
  await updateDoc(doc(db(), "sahneler", id), {
    fotolar: arrayUnion(stripUndefined(foto)),
    updatedAt: serverTimestamp(),
  });
}

export async function removeSahneFoto(sahne: FotoSahneKaydi, src: string): Promise<void> {
  await updateSahne(sahne.id, { fotolar: (sahne.fotolar ?? []).filter((f) => f.src !== src) });
}

/**
 * Sahneyi sil (yalnız kayıt). Cloudinary `flowsign/sahne/{id}/` klasörünün
 * temizliği sonraki adımda /api/wall/destroy'a "sahne" modu eklenince gelecek —
 * kayıt silinince link ölür, dosyalar görünmez ama depoda yer tutar (bilinen
 * eksik, sessiz değil).
 */
export async function deleteSahne(id: string): Promise<void> {
  await deleteDoc(doc(db(), "sahneler", id));
}
