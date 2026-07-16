# FlowMeter

Mentimeter tarzı interaktif sunum uygulaması: sunucu slaytlar oluşturur, izleyiciler
6 haneli kodla katılıp oy verir, sonuçlar ekranda **canlı** güncellenir.

- **Stack:** Next.js (App Router) + Tailwind + Firebase (Firestore & Auth) + Vercel
- Proje kuralları: [`CLAUDE.md`](./CLAUDE.md) · Dosya haritası: [`docs/SITEMAP.md`](./docs/SITEMAP.md) · Yol haritası: [`docs/ROADMAP.md`](./docs/ROADMAP.md)

## Kurulum

1. **Firebase projesi oluştur** — [console.firebase.google.com](https://console.firebase.google.com)
   - **Firestore Database** oluştur (production mode).
   - **Authentication** → Sign-in method → **Google** ve **Email/Password** sağlayıcılarını aç.
   - Project Settings → General → *Your apps* → Web app ekle, config değerlerini kopyala.
2. **Güvenlik kurallarını yükle** — `firestore.rules` içeriğini Firestore → Rules'a yapıştır (veya `firebase deploy --only firestore:rules`).
3. **Env değişkenleri** — `.env.example` → `.env.local` kopyala ve doldur. Vercel'de aynı değişkenleri *Environment Variables* bölümüne ekle.
4. **Çalıştır:**

```bash
npm install
npm run dev   # http://localhost:3000
```

## Akış

| Rol | Adımlar |
|---|---|
| Sunucu | Giriş yap → `/dashboard` → sunum oluştur → `/edit/[id]` slayt ekle → **Sun** |
| İzleyici | Ana sayfada 6 haneli kodu gir → oy ver → sonuçları sunum ekranında izle |

## Deploy

`main`'e push = Vercel production. Firebase env değişkenleri Vercel dashboard'da
tanımlı olmalı; tanımlı değilken de build çalışır (Firebase lazy init).
