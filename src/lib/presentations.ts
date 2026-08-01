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
import { Presentation, PresentationMode, SessionRecord, Slide, SlideType } from "./types";

function randomJoinCode(): string {
  // 100000–999999 arası 6 haneli kod
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Oturum kimliği — yeni oturum başlatınca yenilenir (izleyici sıfırlaması için). */
function randomSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Bir koleksiyondaki tüm dokümanları sayfa sayfa siler — tüm dokümanları belleğe
 *  almadan (büyük veride bile takılmaz): her turda en çok 450 oku + tek batch'te sil. */
async function deleteAllDocs(colPath: [string, ...string[]]): Promise<void> {
  const col = collection(db(), ...colPath);
  for (let guard = 0; guard < 10000; guard++) {
    const snap = await getDocs(query(col, limit(450)));
    if (snap.empty) break;
    const batch = writeBatch(db());
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < 450) break;
  }
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
    sessionStartedAt: serverTimestamp(),
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

/** Sunum temposu: sunucu yönetir (canlı) / katılımcı kendi ilerler (anket). */
export async function setPresentationMode(id: string, mode: PresentationMode): Promise<void> {
  await updateDoc(doc(db(), "presentations", id), { mode });
}

/** Q&A moderasyonunu aç/kapat (açıkken sorular /moderate onayı bekler). */
export async function setQnaModeration(id: string, enabled: boolean): Promise<void> {
  await updateDoc(doc(db(), "presentations", id), { qnaModeration: enabled });
}

/** Açık metin moderasyonu (open-ended/word-cloud): açıkken cevaplar onay bekler. */
export async function setTextModeration(id: string, enabled: boolean): Promise<void> {
  await updateDoc(doc(db(), "presentations", id), { textModeration: enabled });
}

/** Katılımcı yüzeyi dilini ayarla (yalnız izleyici ekranlarını etkiler). */
export async function setAudienceLanguage(id: string, language: "tr" | "en"): Promise<void> {
  await updateDoc(doc(db(), "presentations", id), { language });
}

/** Son düzenleme zamanını günceller (dashboard "son düzenlenen" sıralaması). */
async function touchPresentation(id: string): Promise<void> {
  await updateDoc(doc(db(), "presentations", id), { updatedAt: serverTimestamp() }).catch(() => {});
}

export async function deletePresentation(p: Presentation): Promise<void> {
  // Tam temizlik (yetim veri bırakmaz): önce her slaytın cevap alt koleksiyonu,
  // sonra sunum altındaki izleyici koleksiyonları (katılımcı/tepki/mesaj/soru),
  // en son slaytlar + joinCode + sunum dokümanı. 450'lik parçalarla ilerler →
  // binlerce katılımcı/tepkili (ör. sim) sunumda bile takılmadan siler.
  const slidesSnap = await getDocs(collection(db(), "presentations", p.id, "slides"));
  for (const s of slidesSnap.docs) {
    await deleteAllDocs(["presentations", p.id, "slides", s.id, "responses"]);
  }
  await deleteAllDocs(["presentations", p.id, "participants"]);
  await deleteAllDocs(["presentations", p.id, "reactions"]);
  await deleteAllDocs(["presentations", p.id, "messages"]);
  await deleteAllDocs(["presentations", p.id, "questions"]);
  await deleteAllDocs(["presentations", p.id, "sessions"]);

  const batch = writeBatch(db());
  slidesSnap.docs.forEach((d) => batch.delete(d.ref));
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
  for (const s of slides) {
    await deleteAllDocs(["presentations", presentationId, "slides", s.id, "responses"]);
    if (s.quizStartedAt) {
      await updateDoc(doc(db(), "presentations", presentationId, "slides", s.id), {
        quizStartedAt: null,
      });
    }
  }
  await deleteAllDocs(["presentations", presentationId, "participants"]);
  await deleteAllDocs(["presentations", presentationId, "reactions"]);
  await deleteAllDocs(["presentations", presentationId, "messages"]);

  await updateDoc(doc(db(), "presentations", presentationId), {
    currentSlideIndex: -1,
    isLive: true,
    ended: false,
    votingClosed: false,
    // Yeni oturum kimliği → izleyici telefonları yerel oy/kimliğini sıfırlar
    sessionId: randomSessionId(),
    sessionStartedAt: serverTimestamp(),
  });
}

/**
 * Yeni oturum kimliği atar (SİLMEZ — anında, 1000'lerce katılımcıda bile).
 * Canlı sonuç/katılımcı ekranları sessionId'ye göre filtrelendiği için yeni
 * oturum "taze" başlar; eski cevaplar Firestore'da saklı kalır. Katılım (QR)
 * ekranına döner. newCode=true ise yeni bir 6 haneli kod da atar (eski serbest).
 */
export async function newSession(
  presentationId: string,
  opts?: { newCode?: boolean; live?: boolean }
): Promise<string | undefined> {
  const ref = doc(db(), "presentations", presentationId);
  const before = await getDoc(ref);
  const beforeData = before.exists() ? before.data() : undefined;

  // Biten oturumu arşive yaz: sonuçlar sayfasındaki "Geçmiş oturumlar"
  // seçicisi bu kayıtları listeler (veri sessionId etiketiyle saklı kalır).
  const oldSessionId = beforeData?.sessionId as string | undefined;
  if (oldSessionId) {
    await setDoc(
      doc(db(), "presentations", presentationId, "sessions", oldSessionId),
      {
        startedAt: beforeData?.sessionStartedAt ?? beforeData?.createdAt ?? null,
        endedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});
  }

  // Quiz geri sayımlarını sıfırla — aksi halde yeni oturumda quiz slaytı eski
  // zaman damgasıyla "süre doldu" açılır ve kimse (gerçek izleyici dahil) oy veremez.
  const slidesSnap = await getDocs(collection(db(), "presentations", presentationId, "slides"));
  const quizBatch = writeBatch(db());
  let hasQuizReset = false;
  slidesSnap.docs.forEach((d) => {
    if (d.data().quizStartedAt) {
      quizBatch.update(d.ref, { quizStartedAt: null });
      hasQuizReset = true;
    }
  });
  if (hasQuizReset) await quizBatch.commit();

  let newCode: string | undefined;
  const oldCode = beforeData?.joinCode as string | undefined;
  if (opts?.newCode) {
    newCode = await allocateJoinCode(presentationId);
  }
  const patch: Record<string, unknown> = {
    currentSlideIndex: -1,
    isLive: opts?.live ?? false,
    ended: false,
    votingClosed: false,
    sessionId: randomSessionId(),
    sessionStartedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (newCode) patch.joinCode = newCode;
  await updateDoc(ref, patch);
  if (opts?.newCode && oldCode && oldCode !== newCode) {
    await deleteDoc(doc(db(), "joinCodes", oldCode)).catch(() => {});
  }
  return newCode;
}

/** Geçmiş oturum kayıtlarını (en yeni önce) getirir. */
export async function listSessions(presentationId: string): Promise<SessionRecord[]> {
  const snap = await getDocs(collection(db(), "presentations", presentationId, "sessions"));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SessionRecord);
  return items.sort((a, b) => (b.endedAt?.toMillis() ?? 0) - (a.endedAt?.toMillis() ?? 0));
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
