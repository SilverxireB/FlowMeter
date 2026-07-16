import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { Presentation, Slide, SlideType } from "./types";

function randomJoinCode(): string {
  // 100000–999999 arası 6 haneli kod
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Benzersiz 6 haneli join kodu üretir (joinCodes/{code} lookup dokümanıyla). */
async function allocateJoinCode(presentationId: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomJoinCode();
    const ref = doc(db(), "joinCodes", code);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, { presentationId });
      return code;
    }
  }
  throw new Error("Join kodu üretilemedi, tekrar deneyin.");
}

export async function createPresentation(ownerId: string, title: string): Promise<string> {
  const ref = await addDoc(collection(db(), "presentations"), {
    ownerId,
    title,
    joinCode: "",
    mode: "presenter-pace",
    currentSlideIndex: -1, // -1 = katılım (QR) ekranı

    isLive: false,
    createdAt: serverTimestamp(),
  });
  const joinCode = await allocateJoinCode(ref.id);
  await updateDoc(ref, { joinCode });
  return ref.id;
}

export async function listPresentations(ownerId: string): Promise<Presentation[]> {
  const q = query(collection(db(), "presentations"), where("ownerId", "==", ownerId));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Presentation);
  return items.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

export async function renamePresentation(id: string, title: string): Promise<void> {
  await updateDoc(doc(db(), "presentations", id), { title });
}

export async function deletePresentation(p: Presentation): Promise<void> {
  // Client-side kademeli silme: slaytlar + joinCode + sunum.
  // (Slayt altındaki responses alt koleksiyonu MVP'de yetim kalır; Faz 4'te
  // Cloud Function ile temizlenecek.)
  const slides = await getDocs(collection(db(), "presentations", p.id, "slides"));
  const batch = writeBatch(db());
  slides.docs.forEach((d) => batch.delete(d.ref));
  if (p.joinCode) batch.delete(doc(db(), "joinCodes", p.joinCode));
  batch.delete(doc(db(), "presentations", p.id));
  await batch.commit();
}

export async function resolveJoinCode(code: string): Promise<string | null> {
  const snap = await getDoc(doc(db(), "joinCodes", code));
  return snap.exists() ? (snap.data().presentationId as string) : null;
}

export async function updateTheme(
  presentationId: string,
  theme: Record<string, string | undefined>
): Promise<void> {
  // Firestore undefined kabul etmez — boş alanları ayıkla
  const clean = Object.fromEntries(
    Object.entries(theme).filter(([, v]) => v !== undefined && v !== null)
  );
  await updateDoc(doc(db(), "presentations", presentationId), { theme: clean });
}

export async function setCurrentSlide(presentationId: string, index: number): Promise<void> {
  await updateDoc(doc(db(), "presentations", presentationId), {
    currentSlideIndex: index,
    isLive: true,
  });
}

export async function setVotingClosed(presentationId: string, closed: boolean): Promise<void> {
  await updateDoc(doc(db(), "presentations", presentationId), { votingClosed: closed });
}

/** Sunumu bitirir — izleyiciler bekleme ekranına döner. */
export async function endPresentation(presentationId: string): Promise<void> {
  await updateDoc(doc(db(), "presentations", presentationId), { isLive: false });
}

/** Bir slaytın tüm cevaplarını siler (sadece sahibi — rules ile korunur). */
export async function resetResponses(presentationId: string, slideId: string): Promise<void> {
  const snap = await getDocs(
    collection(db(), "presentations", presentationId, "slides", slideId, "responses")
  );
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(db());
    docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/** İki slaytın order değerini değiştirir (listede yukarı/aşağı taşıma). */
export async function swapSlideOrder(
  presentationId: string,
  a: { id: string; order: number },
  b: { id: string; order: number }
): Promise<void> {
  const batch = writeBatch(db());
  batch.update(doc(db(), "presentations", presentationId, "slides", a.id), { order: b.order });
  batch.update(doc(db(), "presentations", presentationId, "slides", b.id), { order: a.order });
  await batch.commit();
}

export async function duplicateSlide(presentationId: string, slide: Slide): Promise<string> {
  const ref = await addDoc(collection(db(), "presentations", presentationId, "slides"), {
    type: slide.type,
    question: `${slide.question} (kopya)`,
    options: slide.options,
    order: slide.order + 0.5, // araya girer; sıralama order'a göre
    settings: slide.settings ?? {},
  });
  return ref.id;
}

// ── Slaytlar ────────────────────────────────────────────────────────────────

export async function addSlide(presentationId: string, type: SlideType, order: number): Promise<string> {
  const defaults: Record<string, { question: string; options: string[]; settings: object }> = {
    "multiple-choice": {
      question: "Yeni soru",
      options: ["Seçenek 1", "Seçenek 2"],
      settings: { allowMultiple: false },
    },
    "word-cloud": {
      question: "Aklınıza gelen ilk kelime?",
      options: [],
      settings: { maxEntries: 3 },
    },
    "open-ended": {
      question: "Görüşlerinizi paylaşın",
      options: [],
      settings: { maxEntries: 1 },
    },
    scales: {
      question: "Ne kadar katılıyorsunuz?",
      options: ["İfade 1", "İfade 2"],
      settings: {},
    },
    ranking: {
      question: "Önem sırasına göre sıralayın",
      options: ["Seçenek 1", "Seçenek 2", "Seçenek 3"],
      settings: {},
    },
    content: {
      question: "Başlık",
      options: [],
      settings: { description: "" },
    },
  };
  const base = defaults[type] ?? { question: "Yeni slayt", options: [], settings: {} };
  const ref = await addDoc(collection(db(), "presentations", presentationId, "slides"), {
    type,
    question: base.question,
    options: base.options,
    order,
    settings: base.settings,
  });
  return ref.id;
}

export async function updateSlide(
  presentationId: string,
  slideId: string,
  data: Partial<Pick<Slide, "question" | "options" | "order" | "settings">>
): Promise<void> {
  await updateDoc(doc(db(), "presentations", presentationId, "slides", slideId), data);
}

export async function deleteSlide(presentationId: string, slideId: string): Promise<void> {
  await deleteDoc(doc(db(), "presentations", presentationId, "slides", slideId));
}

export async function listSlides(presentationId: string): Promise<Slide[]> {
  const q = query(collection(db(), "presentations", presentationId, "slides"), orderBy("order"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Slide);
}
