import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { PresentationTemplate } from "./templates";
import { Presentation, Slide, SlideType } from "./types";

function randomJoinCode(): string {
  // 100000–999999 arası 6 haneli kod
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Oturum kimliği — yeni oturum başlatınca yenilenir (izleyici sıfırlaması için). */
function randomSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
    sessionId: randomSessionId(),
    createdAt: serverTimestamp(),
  });
  const joinCode = await allocateJoinCode(ref.id);
  await updateDoc(ref, { joinCode });
  return ref.id;
}

/** Hazır şablondan yeni sunum oluşturur (slaytlar + tema preset). */
export async function createFromTemplate(
  ownerId: string,
  template: PresentationTemplate,
  title?: string
): Promise<string> {
  const newId = await createPresentation(ownerId, title || template.name);
  if (template.themePreset) {
    await updateTheme(newId, { preset: template.themePreset });
  }
  const batch = writeBatch(db());
  template.slides.forEach((s, i) => {
    const ref = doc(collection(db(), "presentations", newId, "slides"));
    batch.set(ref, {
      type: s.type,
      question: s.question,
      options: s.options,
      order: i,
      settings: s.settings ?? {},
    });
  });
  await batch.commit();
  return newId;
}

export async function listPresentations(ownerId: string): Promise<Presentation[]> {
  const q = query(collection(db(), "presentations"), where("ownerId", "==", ownerId));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Presentation);
  return items.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

export async function renamePresentation(id: string, title: string): Promise<void> {
  await updateDoc(doc(db(), "presentations", id), { title, updatedAt: serverTimestamp() });
}

/** Bir sunumun tam kopyasını oluşturur (yeni join kodu + tüm slaytlar + tema). */
export async function duplicatePresentation(
  ownerId: string,
  source: Presentation
): Promise<string> {
  const newId = await createPresentation(ownerId, `${source.title} (kopya)`);
  if (source.theme) {
    await updateTheme(newId, source.theme as Record<string, string | undefined>);
  }
  const slides = await listSlides(source.id);
  if (slides.length) {
    const batch = writeBatch(db());
    slides.forEach((s) => {
      const ref = doc(collection(db(), "presentations", newId, "slides"));
      batch.set(ref, {
        type: s.type,
        question: s.question,
        options: s.options,
        order: s.order,
        settings: s.settings ?? {},
      });
    });
    await batch.commit();
  }
  return newId;
}

/** Dashboard klasörü (boş string = klasörsüz). */
export async function setPresentationFolder(id: string, folder: string): Promise<void> {
  await updateDoc(doc(db(), "presentations", id), { folder, updatedAt: serverTimestamp() });
}

/** Canlı sohbeti aç/kapat. */
export async function setChatEnabled(id: string, enabled: boolean): Promise<void> {
  await updateDoc(doc(db(), "presentations", id), { chatEnabled: enabled });
}

/** Son düzenleme zamanını günceller (dashboard "son düzenlenen" sıralaması). */
async function touchPresentation(id: string): Promise<void> {
  await updateDoc(doc(db(), "presentations", id), { updatedAt: serverTimestamp() }).catch(() => {});
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
  await updateDoc(doc(db(), "presentations", presentationId), {
    theme: clean,
    updatedAt: serverTimestamp(),
  });
}

export async function setCurrentSlide(presentationId: string, index: number): Promise<void> {
  await updateDoc(doc(db(), "presentations", presentationId), {
    currentSlideIndex: index,
    isLive: true,
    ended: false,
  });
}

/** Quiz geri sayımını başlatır (slayt açıldığında bir kez yazılır). */
export async function startQuiz(presentationId: string, slideId: string): Promise<void> {
  await updateDoc(doc(db(), "presentations", presentationId, "slides", slideId), {
    quizStartedAt: serverTimestamp(),
  });
}

export async function setVotingClosed(presentationId: string, closed: boolean): Promise<void> {
  await updateDoc(doc(db(), "presentations", presentationId), { votingClosed: closed });
}

/** Sunumu bitirir — izleyiciler bekleme ekranına döner. */
export async function endPresentation(presentationId: string): Promise<void> {
  await updateDoc(doc(db(), "presentations", presentationId), { isLive: false, ended: true });
}

/**
 * Yeni oturum: sunumu aynı deck ile baştan çalıştırmak için tüm cevapları,
 * katılımcıları ve sohbet mesajlarını temizler; quiz geri sayımlarını sıfırlar
 * ve katılım (QR) ekranına döner. "Birden fazla grupla aynı sunum" için.
 */
export async function resetSession(presentationId: string, slides: Slide[]): Promise<void> {
  async function deleteAll(colPath: string[]) {
    const snap = await getDocs(collection(db(), ...(colPath as [string, ...string[]])));
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db());
      docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // 1) Önce katılım (QR) ekranına dön + yeni oturum kimliği ver. Böylece sunum
  //    ve izleyici ekranı ANINDA temizlenmiş görünür; silmeler arkada olur
  //    (eski sonuçların 1 sn ekranda kalıp sonra silinmesi sorunu biter).
  await updateDoc(doc(db(), "presentations", presentationId), {
    currentSlideIndex: -1,
    isLive: true,
    ended: false,
    votingClosed: false,
    // Yeni oturum kimliği → izleyici telefonları yerel oy/kimliğini sıfırlar
    sessionId: randomSessionId(),
  });

  // 2) Tüm oturum verisini temizle: cevaplar, katılımcılar, sohbet, Q&A, tepkiler
  for (const s of slides) {
    await deleteAll(["presentations", presentationId, "slides", s.id, "responses"]);
    if (s.quizStartedAt) {
      await updateDoc(doc(db(), "presentations", presentationId, "slides", s.id), {
        quizStartedAt: null,
      });
    }
  }
  await deleteAll(["presentations", presentationId, "participants"]);
  await deleteAll(["presentations", presentationId, "messages"]);
  await deleteAll(["presentations", presentationId, "questions"]);
  await deleteAll(["presentations", presentationId, "reactions"]);
}

/**
 * Slaytları verilen id sırasına göre yeniden numaralar (film şeridi sürükle-bırak).
 */
export async function reorderSlides(
  presentationId: string,
  orderedIds: string[]
): Promise<void> {
  const batch = writeBatch(db());
  orderedIds.forEach((id, i) => {
    batch.update(doc(db(), "presentations", presentationId, "slides", id), { order: i });
  });
  await batch.commit();
  await touchPresentation(presentationId);
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

interface SlideDefault {
  question: string;
  options: string[];
  settings: Record<string, unknown>;
}

/** Bir slayt tipinin varsayılan soru/seçenek/ayarları (ekleme + tip değiştirmede). */
export function slideDefaults(type: SlideType): SlideDefault {
  const defaults: Partial<Record<SlideType, SlideDefault>> = {
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
    quiz: {
      question: "Quiz sorusu",
      options: ["Seçenek 1", "Seçenek 2", "Seçenek 3"],
      settings: { correctIndex: 0, timeLimit: 20, scoreMode: "time" },
    },
    "quiz-type": {
      question: "Cevabı yazın",
      options: ["Doğru cevap"],
      settings: { timeLimit: 30, scoreMode: "time" },
    },
    "pin-on-image": {
      question: "Görselde işaretleyin",
      options: [],
      settings: {},
    },
    "guess-number": {
      question: "Sizce sayı kaç?",
      options: [],
      settings: { correctNumber: 50, min: 0, max: 100 },
    },
    "hundred-points": {
      question: "100 puanı dağıtın",
      options: ["Seçenek 1", "Seçenek 2", "Seçenek 3"],
      settings: {},
    },
    "grid-2x2": {
      question: "İşaretleyin",
      options: [],
      settings: { gridLabels: ["Düşük", "Yüksek", "Kolay", "Zor"] },
    },
    qna: {
      question: "Sorularınızı alalım!",
      options: [],
      settings: {},
    },
    content: {
      question: "Başlık",
      options: [],
      settings: { description: "" },
    },
    image: {
      question: "Görsel başlığı",
      options: [],
      settings: { description: "" },
    },
    video: {
      question: "Video",
      options: [],
      settings: { videoUrl: "" },
    },
    instructions: {
      question: "Nasıl katılırsınız?",
      options: ["Adım 1", "Adım 2"],
      settings: {},
    },
    leaderboard: {
      question: "Skor Tablosu",
      options: [],
      settings: {},
    },
  };
  return defaults[type] ?? { question: "Yeni slayt", options: [], settings: {} };
}

/** Seçenek listesi tutan (birbirine dönüştürülünce korunan) slayt tipleri. */
const OPTION_TYPES: SlideType[] = [
  "multiple-choice",
  "quiz",
  "ranking",
  "scales",
  "instructions",
];

export async function addSlide(presentationId: string, type: SlideType, order: number): Promise<string> {
  const base = slideDefaults(type);
  const ref = await addDoc(collection(db(), "presentations", presentationId, "slides"), {
    type,
    question: base.question,
    options: base.options,
    order,
    settings: base.settings,
  });
  await touchPresentation(presentationId);
  return ref.id;
}

/**
 * Slaytın tipini yerinde değiştirir (Menti "Edit" sheet'indeki tip dropdown'u).
 * Soru + ortak ayarlar (label/description/image) korunur; seçenekler iki tip de
 * seçenek tutuyorsa taşınır, aksi halde yeni tipin varsayılanı kullanılır.
 */
export async function changeSlideType(
  presentationId: string,
  slide: Slide,
  newType: SlideType
): Promise<void> {
  if (slide.type === newType) return;
  const def = slideDefaults(newType);
  const keepOptions =
    OPTION_TYPES.includes(slide.type) && OPTION_TYPES.includes(newType) && slide.options.length > 0;
  const preserved: Record<string, unknown> = {};
  if (slide.settings?.label) preserved.label = slide.settings.label;
  if (slide.settings?.description) preserved.description = slide.settings.description;
  if (slide.settings?.image) preserved.image = slide.settings.image;
  await updateDoc(doc(db(), "presentations", presentationId, "slides", slide.id), {
    type: newType,
    options: keepOptions ? slide.options : def.options,
    settings: { ...def.settings, ...preserved },
    quizStartedAt: null,
  });
  await touchPresentation(presentationId);
}

/** Dashboard kart önizlemesi için sunumun ilk (order'ı en küçük) slaytı. */
export async function getFirstSlide(presentationId: string): Promise<Slide | null> {
  const snap = await getDocs(
    query(
      collection(db(), "presentations", presentationId, "slides"),
      orderBy("order"),
      limit(1)
    )
  );
  const d = snap.docs[0];
  return d ? ({ id: d.id, ...d.data() } as Slide) : null;
}

export async function updateSlide(
  presentationId: string,
  slideId: string,
  data: Partial<Pick<Slide, "question" | "options" | "order" | "settings">>
): Promise<void> {
  await updateDoc(doc(db(), "presentations", presentationId, "slides", slideId), data);
  await touchPresentation(presentationId);
}

/** Slaytı sunumda atla/geri al (Menti "Skip slide"). */
export async function setSlideSkipped(
  presentationId: string,
  slide: Slide,
  skipped: boolean
): Promise<void> {
  await updateSlide(presentationId, slide.id, {
    settings: { ...slide.settings, skipped },
  });
}

export async function deleteSlide(presentationId: string, slideId: string): Promise<void> {
  await deleteDoc(doc(db(), "presentations", presentationId, "slides", slideId));
  await touchPresentation(presentationId);
}

export async function listSlides(presentationId: string): Promise<Slide[]> {
  const q = query(collection(db(), "presentations", presentationId, "slides"), orderBy("order"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Slide);
}
