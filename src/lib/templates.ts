import { Slide } from "./types";

/** Bir şablon slaytı: id/order hariç slayt tanımı. */
export type TemplateSlide = Pick<Slide, "type" | "question" | "options" | "settings">;

export interface PresentationTemplate {
  id: string;
  name: string;
  /** Galeri kartındaki simge. BURADA EMOJİ BİLİNÇLİ: şablon simgesi işlevsel
   *  bir glif değil KİMLİK — renkli emoji kartları sıcak ve birbirinden kolay
   *  ayırt edilir kılıyor. (İşlevsel yerlerde kural hâlâ SVG.) */
  emoji: string;
  /** Galeri gruplaması — kullanıcı şablonlar arasında hızlı bulsun. */
  category: "Toplantı" | "Eğitim" | "Etkinlik" | "Ekip";
  description: string;
  /** "Ne zaman kullanılır" ipucu (kart altı). */
  useCase: string;
  themePreset?: string;
  slides: TemplateSlide[];
}

/**
 * Hazır sunum şablonları. Tamamı repo içi, dış servis yok.
 *
 * TASARIM İLKESİ: şablon "iskelet" DEĞİL, kullanıma hazır olmalı — soru
 * metinleri gerçek, seçenekler dolu, süre/puanlama ayarlanmış, izleyici
 * açıklaması (description) ve konuşmacı notu (notes) yazılmış. Kullanıcı
 * şablonu açtığında ideal olarak yalnız kendi konusuna göre birkaç kelime
 * değiştirip sunuma başlayabilmeli. ("A / B / C / D" gibi yer tutucular ancak
 * kaçınılmazsa kalır ve notes alanında "değiştir" uyarısı yazar.)
 */
export const TEMPLATES: PresentationTemplate[] = [
  // ── TOPLANTI ────────────────────────────────────────────────────────────
  {
    id: "buzkirici",
    name: "Buz Kırıcı",
    emoji: "🧊",
    category: "Toplantı",
    description: "Salonu ısıtan 5 dakikalık açılış — herkes bir şey söylemiş olur.",
    useCase: "Toplantı, ders veya atölyenin ilk 5 dakikası",
    themePreset: "morsis",
    slides: [
      {
        type: "word-cloud",
        question: "Bugünkü ruh hâlini tek kelimeyle anlat",
        options: [],
        settings: {
          maxEntries: 2,
          description: "Tek kelime yaz, ekranda hep birlikte görelim.",
          notes: "Bulut dolarken birkaç kelimeyi yüksek sesle oku — salon anında ısınır.",
        },
      },
      {
        type: "multiple-choice",
        question: "Bugün buraya nasıl geldin?",
        options: ["Kahvemi almış, hazırım", "Uyanmaya çalışıyorum", "Toplantıdan toplantıya", "Bugün formumdayım"],
        settings: { description: "Dürüst ol, kimse görmüyor.", notes: "Şaka payı yüksek; sonucu gülerek yorumla." },
      },
      {
        type: "scales",
        question: "Şu an nerede duruyorsun?",
        options: ["Enerjim yerinde", "Konuya hâkimim", "Katkı vermeye hazırım"],
        settings: { description: "Her satır için 1–5 arası puan ver." },
      },
      {
        type: "open-ended",
        question: "Bu oturumdan tek bir şey kazanacak olsan, o ne olurdu?",
        options: [],
        settings: {
          maxEntries: 1,
          description: "Bir cümle yeter.",
          notes: "Beklentileri kapanışta tekrar göster — 'söz verdiklerimizi tuttuk mu?' kontrolü.",
        },
      },
    ],
  },
  {
    id: "toplanti-acilis",
    name: "Toplantı Açılışı & Gündem",
    emoji: "📋",
    category: "Toplantı",
    description: "Gündemi göster, beklentileri topla, engelleri masaya yatır.",
    useCase: "Haftalık ekip toplantısı, proje başlangıcı",
    themePreset: "kagit",
    slides: [
      {
        type: "content",
        question: "Bugünün gündemi",
        options: [],
        settings: {
          label: "Hoş geldiniz",
          description: "1) Geçen haftanın özeti · 2) Bu haftanın hedefleri · 3) Engeller · 4) Kararlar",
          notes: "Gündemi oku, 'eklemek isteyen var mı?' diye sor — sonraki slayt tam bunun için.",
        },
      },
      {
        type: "open-ended",
        question: "Gündeme eklemek istediğin bir konu var mı?",
        options: [],
        settings: { maxEntries: 2, description: "Yoksa boş bırakabilirsin." },
      },
      {
        type: "multiple-choice",
        question: "Geçen haftaki hedeflerin neresindeyiz?",
        options: ["Tamamlandı", "Yolunda", "Gecikme var", "Tıkandık"],
        settings: { description: "Kendi işin için işaretle.", notes: "'Tıkandık' çıkarsa hemen sebebini sor; asıl toplantı orada başlar." },
      },
      {
        type: "open-ended",
        question: "Seni yavaşlatan bir engel var mı?",
        options: [],
        settings: {
          maxEntries: 2,
          description: "Kısa yaz: ne, neyin yüzünden.",
          notes: "Engelleri sahiplendirmeden geçme — her birine bir isim ve tarih yaz.",
        },
      },
      {
        type: "hundred-points",
        question: "100 puanı bu haftanın önceliklerine dağıt",
        options: ["Müşteri işleri", "Ürün geliştirme", "Teknik borç", "Acil düzeltmeler"],
        settings: { description: "Toplam 100 puanı istediğin gibi böl.", notes: "Ekip nereye ağırlık veriyor? Yönetimin beklentisiyle karşılaştır." },
      },
      {
        type: "qna",
        question: "Soru & Cevap",
        options: [],
        settings: { description: "Sorunu yaz, beğendiğin soruyu yukarı oyla.", notes: "En çok oy alan 3 soruyu cevapla, kalanını yazılı takip et." },
      },
    ],
  },
  {
    id: "karar-matrisi",
    name: "Karar Toplantısı",
    emoji: "⚖️",
    category: "Toplantı",
    description: "Seçenekleri etki/zorluk matrisine yerleştir, oylayıp karara bağla.",
    useCase: "Öncelik belirleme, yol haritası kararı",
    themePreset: "graf",
    slides: [
      {
        type: "content",
        question: "Bugün neye karar veriyoruz?",
        options: [],
        settings: {
          label: "Karar",
          description: "Kararın çerçevesi: neyi, ne zamana kadar, kim onaylayacak.",
          notes: "Kapsamı baştan daralt; 'her şeyi konuşalım' toplantısı karar üretmez.",
        },
      },
      {
        type: "open-ended",
        question: "Masadaki seçenekler neler?",
        options: [],
        settings: { maxEntries: 3, description: "Her seçeneği ayrı gönder.", notes: "Gelenleri 4-5 seçeneğe indir; sonraki slaytlara elle yaz." },
      },
      {
        type: "grid-2x2",
        question: "Seçenekleri matrise yerleştir",
        options: ["Seçenek A", "Seçenek B", "Seçenek C", "Seçenek D"],
        settings: {
          gridLabels: ["Düşük etki", "Yüksek etki", "Zor", "Kolay"],
          description: "Her seçeneği etkisine ve zorluğuna göre yerleştir.",
          notes: "Seçenek adlarını değiştirmeyi unutma. Sağ üst = hemen yap, sol alt = konuşmayı bırak.",
        },
      },
      {
        type: "ranking",
        question: "Sıraya koy: önce hangisi?",
        options: ["Seçenek A", "Seçenek B", "Seçenek C", "Seçenek D"],
        settings: { description: "Sürükleyerek sırala." },
      },
      {
        type: "multiple-choice",
        question: "Karar: hangisiyle ilerliyoruz?",
        options: ["Seçenek A", "Seçenek B", "Seçenek C", "Daha çok veri lazım"],
        settings: { description: "Tek seçim.", notes: "Sonucu ekranda bırak, karar sahibini yüksek sesle söyle — toplantının çıktısı budur." },
      },
      {
        type: "open-ended",
        question: "Bu karara itirazı olan? Endişeni yaz",
        options: [],
        settings: { maxEntries: 1, description: "Anonim — çekinme.", notes: "İtiraz varsa okumadan toplantıyı kapatma." },
      },
    ],
  },

  // ── EĞİTİM ──────────────────────────────────────────────────────────────
  {
    id: "quiz-yarismasi",
    name: "Quiz Yarışması",
    emoji: "⚡",
    category: "Eğitim",
    description: "Süreli 5 soru + podyum. Sorular hazır, kendi konuna göre değiştir.",
    useCase: "Eğitim tekrarı, şirket etkinliği, ders sonu yarışma",
    themePreset: "gece",
    slides: [
      {
        type: "content",
        question: "Kurallar",
        options: [],
        settings: {
          label: "Quiz",
          description: "5 soru · her soru için süre · hızlı doğru cevap daha çok puan · sonunda podyum",
          notes: "Telefonlar hazır mı diye sor, sonra ilk soruya geç.",
        },
      },
      {
        type: "quiz",
        question: "Türkiye'nin yüzölçümü bakımından en büyük ili hangisidir?",
        options: ["Konya", "Sivas", "Ankara", "Erzurum"],
        settings: { correctIndex: 0, timeLimit: 20, scoreMode: "time", music: true, description: "Tek doğru cevap." },
      },
      {
        type: "quiz",
        question: "Bir yılda kaç hafta vardır?",
        options: ["48", "50", "52", "54"],
        settings: { correctIndex: 2, timeLimit: 15, scoreMode: "time", music: true },
      },
      {
        type: "quiz",
        question: "Aşağıdakilerden hangisi bir ölçü birimi DEĞİLDİR?",
        options: ["Kelvin", "Amper", "Hertz", "Newtonyum"],
        settings: { correctIndex: 3, timeLimit: 20, scoreMode: "time", music: true },
      },
      {
        type: "guess-number",
        question: "Sence bu salonda toplam kaç yıllık iş tecrübesi var?",
        options: [],
        settings: {
          min: 0,
          max: 500,
          unit: "yıl",
          correctNumber: 120,
          description: "Tahminini yaz — en yakın kazanır.",
          notes: "Doğru sayıyı kendi ekibine göre güncelle (kişi sayısı × ortalama tecrübe).",
        },
      },
      {
        type: "quiz-type",
        question: "Şirketimizin kuruluş yılı?",
        options: ["2015", "2015 yılı"],
        settings: {
          timeLimit: 25,
          scoreMode: "time",
          description: "Cevabı yazarak gönder.",
          notes: "Doğru yılı ve kabul edilecek yazımları güncelle.",
        },
      },
      {
        type: "leaderboard",
        question: "Podyum",
        options: [],
        settings: { notes: "İlk üçü alkışlat; ödül verilecekse burada ver." },
      },
    ],
  },
  {
    id: "egitim-degerlendirme",
    name: "Eğitim Değerlendirme",
    emoji: "🎓",
    category: "Eğitim",
    description: "Eğitim sonu ölçüm: öğrenim, anlatım, uygulanabilirlik, tavsiye oranı.",
    useCase: "Kurum içi eğitim, seminer, atölye kapanışı",
    themePreset: "okyanus",
    slides: [
      {
        type: "scales",
        question: "Eğitimi değerlendir",
        options: ["İçeriğin faydası", "Eğitmenin anlatımı", "Süre yönetimi", "Materyaller", "Genel memnuniyet"],
        settings: { description: "Her satıra 1–5 arası puan ver." },
      },
      {
        type: "multiple-choice",
        question: "Öğrendiklerini işinde ne kadar kullanabilirsin?",
        options: ["Hemen bugün", "Bu ay içinde", "Fırsat olursa", "Şu an işime uymuyor"],
        settings: { description: "Tek seçim.", notes: "'İşime uymuyor' oranı yüksekse hedef kitle yanlış seçilmiş demektir." },
      },
      {
        type: "word-cloud",
        question: "Eğitimden aklında kalan tek kavram?",
        options: [],
        settings: { maxEntries: 2, description: "Tek kelime ya da kısa ifade.", notes: "Anahtar kavram büyük çıkmadıysa mesaj geçmemiş — kapanışta tekrar özetle." },
      },
      {
        type: "open-ended",
        question: "Bir şeyi değiştirebilseydin, ne olurdu?",
        options: [],
        settings: { maxEntries: 1, description: "Açık konuş — anonim." },
      },
      {
        type: "multiple-choice",
        question: "Bu eğitimi bir arkadaşına önerir misin?",
        options: ["Kesinlikle öneririm", "Öneririm", "Kararsızım", "Önermem"],
        settings: { notes: "İlk iki seçeneğin toplamı kurumsal raporlarda 'tavsiye oranı' olarak kullanılır." },
      },
    ],
  },
  {
    id: "ders-tekrari",
    name: "Ders Tekrarı & Yoklama",
    emoji: "📚",
    category: "Eğitim",
    description: "Kim geldi, ne anlaşıldı, nerede takılındı — tek sunumda.",
    useCase: "Okul/üniversite dersi, kurum içi teknik eğitim",
    themePreset: "orman",
    slides: [
      {
        type: "word-cloud",
        question: "Adını yaz (yoklama)",
        options: [],
        settings: { maxEntries: 1, description: "Adın ve soyadının ilk harfi yeterli.", notes: "Ekrandaki isim sayısı katılımı gösterir; ekran görüntüsü al." },
      },
      {
        type: "multiple-choice",
        question: "Geçen dersin konusunu hatırlıyor musun?",
        options: ["Net hatırlıyorum", "Kısmen", "Pek hatırlamıyorum"],
        settings: { notes: "Çoğunluk 'kısmen' derse 2 dakikalık hızlı özet yap." },
      },
      {
        type: "quiz",
        question: "Bugünkü konudan: aşağıdakilerden hangisi doğrudur?",
        options: ["Birinci ifade", "İkinci ifade", "Üçüncü ifade", "Hiçbiri"],
        settings: {
          correctIndex: 1,
          timeLimit: 25,
          scoreMode: "fixed",
          description: "Doğru cevabı işaretle.",
          notes: "Soruyu ve seçenekleri kendi konunla değiştir. Puanlama sabit: hız değil doğruluk ölçülüyor.",
        },
      },
      {
        type: "open-ended",
        question: "Anlamadığın, tekrar edilmesini istediğin konu?",
        options: [],
        settings: { maxEntries: 2, description: "Çekinme — anonim.", notes: "Gelen konulara dersin son 10 dakikasını ayır." },
      },
      {
        type: "scales",
        question: "Kendini nasıl değerlendiriyorsun?",
        options: ["Konuyu anladım", "Örnek çözebilirim", "Sınava hazırım"],
        settings: {},
      },
    ],
  },

  // ── ETKİNLİK ────────────────────────────────────────────────────────────
  {
    id: "etkinlik-geribildirim",
    name: "Etkinlik Geri Bildirimi",
    emoji: "💬",
    category: "Etkinlik",
    description: "Salon dağılmadan topla — tavsiye oranı, bölüm puanları, öneriler.",
    useCase: "Konferans, lansman, bayi toplantısı kapanışı",
    themePreset: "gunbatimi",
    slides: [
      {
        type: "multiple-choice",
        question: "Bu etkinliği bir meslektaşına önerir misin?",
        options: ["Kesinlikle öneririm", "Öneririm", "Kararsızım", "Önermem"],
        settings: { description: "Tek seçim.", notes: "Bu slaytın sonucu etkinlik raporunun ilk satırıdır." },
      },
      {
        type: "scales",
        question: "Bölümleri puanla",
        options: ["Açılış", "Ana sunum", "Atölye", "İkram ve mekân", "Organizasyon"],
        settings: { description: "Her satıra 1–5 arası puan ver." },
      },
      {
        type: "hundred-points",
        question: "100 puanı en değerli bulduğun bölümlere dağıt",
        options: ["Açılış konuşması", "Ana sunum", "Atölye", "Tanışma/networking", "Kapanış"],
        settings: { description: "Toplam 100 puanı böl.", notes: "Puanın yığıldığı bölümü gelecek etkinlikte uzat." },
      },
      {
        type: "word-cloud",
        question: "Bugünü tek kelimeyle özetle",
        options: [],
        settings: { maxEntries: 2, notes: "Bu bulutun ekran görüntüsü, etkinlik sonrası paylaşımların en iyi görselidir." },
      },
      {
        type: "open-ended",
        question: "Gelecek etkinlikte ne görmek isterdin?",
        options: [],
        settings: { maxEntries: 2, description: "Konu, konuşmacı, format — hepsi olur." },
      },
    ],
  },
  {
    id: "sirket-toplantisi",
    name: "Şirket Toplantısı",
    emoji: "📣",
    category: "Etkinlik",
    description: "Yönetim bilgilendirmesi + nabız ölçümü + anonim soru havuzu.",
    useCase: "Çeyreklik/yıllık tüm çalışan toplantısı",
    themePreset: "graf",
    slides: [
      {
        type: "content",
        question: "Bugün neleri konuşacağız?",
        options: [],
        settings: {
          label: "Hoş geldiniz",
          description: "1) Nerede olduğumuz · 2) Rakamlar · 3) Önümüzdeki dönem · 4) Sorularınız",
          notes: "Soru slaytının sonda olduğunu baştan duyur — insanlar soru yazmaya erken başlasın.",
        },
      },
      {
        type: "word-cloud",
        question: "Bu dönemi tek kelimeyle nasıl özetlersin?",
        options: [],
        settings: { maxEntries: 2, description: "Dürüst ol — anonim." },
      },
      {
        type: "scales",
        question: "Şirket olarak nerede duruyoruz?",
        options: ["Yönümüz net", "İşim anlamlı", "Sesim duyuluyor", "Geleceğe güveniyorum"],
        settings: { description: "Her satıra 1–5 arası puan ver.", notes: "Düşük çıkan satırı geçiştirme; bir sonraki toplantıya aksiyonla gel." },
      },
      {
        type: "multiple-choice",
        question: "Önümüzdeki dönem en çok neye odaklanmalıyız?",
        options: ["Müşteri memnuniyeti", "Ürün kalitesi", "Yeni pazarlar", "İç süreçler ve verimlilik", "Ekip ve kültür"],
        settings: { allowMultiple: true, description: "En fazla iki seçenek işaretle." },
      },
      {
        type: "qna",
        question: "Yönetime sorular",
        options: [],
        settings: {
          description: "Sorunu yaz, beğendiklerini yukarı oyla. Anonim.",
          notes: "Moderasyonu açık tut. En çok oy alandan başla; cevaplayamadıklarına yazılı dönüş sözü ver.",
        },
      },
    ],
  },
  {
    id: "urun-testi",
    name: "Ürün / Kampanya Testi",
    emoji: "🚀",
    category: "Etkinlik",
    description: "Yeni fikri salona test ettir: ilk izlenim, fiyat algısı, isim oylaması.",
    useCase: "Lansman öncesi bayi/müşteri toplantısı, pazarlama atölyesi",
    themePreset: "gul",
    slides: [
      {
        type: "content",
        question: "Karşınızda: yeni ürünümüz",
        options: [],
        settings: {
          label: "Tanıtım",
          description: "Kısa tanıtımı yaptıktan sonra ilerleyin.",
          notes: "Bu slaytta yalnız sen konuşuyorsun. Görsel eklemek için slayt ayarlarından resim yükle.",
        },
      },
      {
        type: "word-cloud",
        question: "İlk izlenimin tek kelimeyle?",
        options: [],
        settings: { maxEntries: 2, description: "İlk aklına gelen kelime.", notes: "Olumsuz kelimeler de çıkacak — üstüne konuş, sansürleme." },
      },
      {
        type: "multiple-choice",
        question: "Bu ürünü kime satarsın?",
        options: ["Mevcut müşterilerime", "Yeni müşteri kitlesine", "İkisine de", "Satmakta zorlanırım"],
        settings: { notes: "'Zorlanırım' oranı yüksekse konumlandırma sorunu var demektir." },
      },
      {
        type: "guess-number",
        question: "Sence bu ürünün raf fiyatı ne olmalı?",
        options: [],
        settings: {
          min: 0,
          max: 10000,
          unit: "TL",
          description: "Tahmini fiyatı yaz.",
          notes: "Dağılımın tepe noktası algılanan değeri gösterir — hedef fiyatınla karşılaştır.",
        },
      },
      {
        type: "ranking",
        question: "İsim adaylarını sırala",
        options: ["Aday 1", "Aday 2", "Aday 3", "Aday 4"],
        settings: { description: "En beğendiğin en üstte olacak şekilde sırala.", notes: "Adayları kendi listenle değiştir." },
      },
      {
        type: "open-ended",
        question: "Eksik bulduğun tek şey ne?",
        options: [],
        settings: { maxEntries: 1, description: "Tek cümle." },
      },
    ],
  },
  {
    id: "kutlama",
    name: "Kutlama & Eğlence",
    emoji: "🎉",
    category: "Etkinlik",
    description: "Yılbaşı, yıl dönümü, mezuniyet — eğlenceli sorular + dilek bulutu.",
    useCase: "Şirket yemeği, yılbaşı partisi, kutlama gecesi",
    themePreset: "morsis",
    slides: [
      {
        type: "word-cloud",
        question: "Bu yılı tek kelimeyle anlat",
        options: [],
        settings: { maxEntries: 2, notes: "Perdede dururken fotoğraf çekilsin diye biraz bekle." },
      },
      {
        type: "multiple-choice",
        question: "Bu yılın en iyi anısı hangisiydi?",
        options: ["Yeni projeye başlamak", "Ekip etkinlikleri", "Kişisel başarım", "Aramıza yeni katılanlar", "Zor bir günü birlikte atlatmak"],
        settings: { description: "Tek seçim." },
      },
      {
        type: "quiz",
        question: "Ekipten kim bu yıl en çok kahve içti?",
        options: ["Birinci isim", "İkinci isim", "Üçüncü isim", "Hepimiz berabere"],
        settings: {
          correctIndex: 3,
          timeLimit: 20,
          scoreMode: "time",
          music: true,
          notes: "İsimleri kendi ekibinle değiştir — eğlencenin tamamı burada.",
        },
      },
      {
        type: "guess-number",
        question: "Bu yıl kaç toplantı yaptık sence?",
        options: [],
        settings: { min: 0, max: 2000, unit: "toplantı", correctNumber: 340, description: "Tahminini yaz.", notes: "Gerçek sayıyı takvimden bakıp buraya yaz." },
      },
      {
        type: "open-ended",
        question: "Gelecek yıl için dileğin?",
        options: [],
        settings: { maxEntries: 1, description: "Bir cümle.", notes: "Dilekleri yüksek sesle oku — gecenin en sıcak anı budur." },
      },
      {
        type: "leaderboard",
        question: "Podyum",
        options: [],
        settings: {},
      },
    ],
  },

  // ── EKİP ────────────────────────────────────────────────────────────────
  {
    id: "ekip-nabzi",
    name: "Ekip Nabzı",
    emoji: "💓",
    category: "Ekip",
    description: "5 dakikada ekip sağlığı: iş yükü, moral, engeller, takdir.",
    useCase: "Haftalık ekip toplantısının ilk 5 dakikası",
    themePreset: "okyanus",
    slides: [
      {
        type: "scales",
        question: "Bu hafta nasıl geçti?",
        options: ["İş yüküm dengeli", "Moralim iyi", "Ne yapacağım net", "Destek alabiliyorum"],
        settings: { description: "Her satıra 1–5 arası puan ver — anonim.", notes: "Aynı soruları her hafta sor; asıl değer trendde." },
      },
      {
        type: "multiple-choice",
        question: "Bu hafta iş yükün nasıldı?",
        options: ["Boştaydım", "Dengeliydi", "Yoğundu ama yetiştirdim", "Boğuldum"],
        settings: { notes: "'Boğuldum' çıkarsa toplantıdan sonra birebir konuş." },
      },
      {
        type: "open-ended",
        question: "Bu hafta seni en çok ne zorladı?",
        options: [],
        settings: { maxEntries: 2, description: "Kısa yaz." },
      },
      {
        type: "open-ended",
        question: "Bu hafta kime teşekkür etmek istersin?",
        options: [],
        settings: { maxEntries: 2, description: "İsim ve sebep yaz — ekranda okunacak.", notes: "Bunları yüksek sesle oku; haftanın en moral verici dakikası." },
      },
      {
        type: "multiple-choice",
        question: "Gelecek hafta odağın?",
        options: ["Devam eden işler", "Yeni başlayacak iş", "Teknik borç/temizlik", "Öğrenme ve gelişim"],
        settings: {},
      },
    ],
  },
  {
    id: "beyin-firtinasi",
    name: "Beyin Fırtınası",
    emoji: "💡",
    category: "Ekip",
    description: "Fikir topla, grupla, oyla, sahiplendir — atölyenin tamamı.",
    useCase: "Fikir atölyesi, problem çözme oturumu",
    themePreset: "kagit",
    slides: [
      {
        type: "content",
        question: "Çözmeye çalıştığımız problem",
        options: [],
        settings: {
          label: "Beyin fırtınası",
          description: "Kurallar: eleştiri yok · miktar kaliteden önce gelir · tuhaf fikir serbest",
          notes: "Problemi tek cümlede yaz, kuralları oku, süreyi söyle (ör. 6 dakika).",
        },
      },
      {
        type: "open-ended",
        question: "Aklına gelen çözümleri yaz",
        options: [],
        settings: {
          maxEntries: 5,
          description: "İstediğin kadar gönder — filtreleme yok.",
          notes: "Sessizlik olursa kendi çılgın fikrinden birini yaz; akış açılır.",
        },
      },
      {
        type: "word-cloud",
        question: "Fikirlerin ortak teması ne?",
        options: [],
        settings: { maxEntries: 3, description: "Tek kelimelik başlıklar.", notes: "Bu bulut fikirleri gruplamana yardım eder." },
      },
      {
        type: "hundred-points",
        question: "100 puanı en umut vaat eden fikirlere dağıt",
        options: ["Fikir 1", "Fikir 2", "Fikir 3", "Fikir 4", "Fikir 5"],
        settings: { description: "Puanı istediğin gibi böl.", notes: "Seçenekleri, önceki slayttan gelen GERÇEK fikirlerle değiştir." },
      },
      {
        type: "grid-2x2",
        question: "Öne çıkan fikirleri matrise yerleştir",
        options: ["Fikir 1", "Fikir 2", "Fikir 3"],
        settings: { gridLabels: ["Düşük etki", "Yüksek etki", "Zor", "Kolay"], description: "Etki ve zorluğa göre yerleştir." },
      },
      {
        type: "open-ended",
        question: "Hangi fikri sen sahiplenirsin?",
        options: [],
        settings: { maxEntries: 1, description: "Fikir ve adını yaz.", notes: "Sahibi olmayan fikir uygulanmaz — atölyeyi bu slaytla bitir." },
      },
    ],
  },
];

export function getTemplate(id: string): PresentationTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Galeri gruplama sırası. */
export const TEMPLATE_CATEGORIES = ["Toplantı", "Eğitim", "Etkinlik", "Ekip"] as const;
