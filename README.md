# Ücretsiz Yayınlama: Netlify veya Vercel + Supabase

Bu sürüm Google Apps Script kullanmadan yayınlanır.

- Netlify veya Vercel: Web sayfasını ücretsiz yayınlar.
- Supabase: Öğretmen listesini ve giriş/çıkış kayıtlarını saklar.
- Uygulama sayfası kayıt tablosunu göstermez. Kayıtları sadece Supabase paneline giren kişi görür.

## 1. Supabase Kurulumu

1. https://supabase.com adresinden ücretsiz hesap açın.
2. `New project` ile yeni proje oluşturun.
3. Proje açılınca sol menüden `SQL Editor` bölümüne girin.
4. `New query` açın.
5. Bu klasördeki `supabase.sql` dosyasının içeriğini yapıştırıp çalıştırın.

Bu işlem iki tablo oluşturur:

- `teachers`: Öğretmen isimleri
- `attendance_records`: Giriş/çıkış kayıtları

`attendance_records` tablosunda sadece kayıt ekleme izni vardır. Web sayfası kayıtları okuyamaz.

## 2. Supabase Bilgilerini Alma

1. Supabase panelinde `Project Settings > API` bölümüne girin.
2. `Project URL` değerini kopyalayın.
3. `Project API keys` bölümündeki `anon public` anahtarını kopyalayın.
4. `config.js` dosyasını açın.
5. İçindeki alanları doldurun:

```js
window.ATTENDANCE_CONFIG = {
  url: "Project URL buraya",
  anonKey: "anon public key buraya"
};
```

## 3. Öğretmen İsimlerini Düzenleme

Supabase panelinde:

1. `Table Editor` bölümüne girin.
2. `teachers` tablosunu açın.
3. İsimleri buradan ekleyin, düzenleyin veya pasif yapmak için `active` alanını kapatın.

## 4. Netlify ile Yayınlama

En kolay yol Netlify'da sürükle-bırak yapmaktır:

1. https://app.netlify.com/drop adresini açın.
2. Netlify hesabınızla giriş yapın.
3. Bu `supabase-vercel` klasörünü sayfadaki alana sürükleyip bırakın.
4. Netlify size `netlify.app` ile biten bir bağlantı verir.
5. Öğretmenlerle o bağlantıyı paylaşın.

## 5. Vercel ile Yayınlama

GitHub kullanmak isterseniz:

1. Bu `supabase-vercel` klasörünü GitHub'a yükleyin.
2. https://vercel.com adresinden ücretsiz hesap açın.
3. `Add New > Project` deyin.
4. GitHub'daki projeyi seçin.
5. Framework seçmeden statik site olarak yayınlayın.
6. Vercel size bir bağlantı verir. Öğretmenlerle o bağlantıyı paylaşın.

## GitHub Pages ile Yayınlama

GitHub'da da çalışır. GitHub Pages sadece web sayfasını yayınlar; kayıtlar yine Supabase'e yazılır.

Daha basit anlatım için:

```text
GITHUB-PAGES-KURULUM.md
```

## 6. Kayıtları Görme

Supabase panelinde:

1. `Table Editor` bölümüne girin.
2. `attendance_records` tablosunu açın.
3. Kayıtları buradan görebilir, filtreleyebilir veya CSV olarak dışa aktarabilirsiniz.

## Önemli Güvenlik Notu

`anon public` anahtar web sayfasında görünür. Bu normaldir. Asıl güvenlik Supabase tarafındaki RLS kurallarıyla sağlanır. Bu kurulumda web sayfası kayıtları okuyamaz, sadece yeni kayıt ekleyebilir.

Okul dışından sahte kayıt gelmesini istemiyorsanız sonraki adım olarak sayfaya ortak PIN eklemek iyi olur.
