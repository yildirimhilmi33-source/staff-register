# GitHub Pages ile Yayınlama

Evet, bu uygulama GitHub'da çalışır. Ama GitHub tek başına kayıt tutmaz. GitHub sadece web sayfasını yayınlar; kayıtlar Supabase'e gider.

Kısaca sistem şöyle olur:

```text
Öğretmen sayfası: GitHub Pages
Kayıt tablosu: Supabase
```

## En Basit Kurulum

1. Supabase hesabı açın.
2. Supabase'te yeni proje oluşturun.
3. `supabase.sql` dosyasının içeriğini Supabase `SQL Editor` içinde çalıştırın.
4. Supabase `Project URL` ve `anon public key` bilgilerini alın.
5. `config.js` dosyasındaki iki alanı doldurun.
6. GitHub'da yeni bir repository oluşturun.
7. Bu klasördeki dosyaları repository içine yükleyin:

```text
index.html
styles.css
app.js
config.js
supabase.sql
```

8. GitHub'da repository sayfasında `Settings > Pages` bölümüne girin.
9. `Deploy from a branch` seçin.
10. Branch olarak `main`, klasör olarak `/root` seçin.
11. `Save` deyin.
12. Birkaç dakika sonra GitHub size bir bağlantı verir.

Bağlantı genellikle şöyle görünür:

```text
https://kullanici-adiniz.github.io/proje-adi/
```

## Kayıtları Nereden Göreceğim?

Kayıtlar GitHub'da görünmez. Supabase panelinde görünür:

```text
Table Editor > attendance_records
```

Öğretmen isimleri:

```text
Table Editor > teachers
```

## Önemli Not

GitHub Pages ücretsizdir ve statik sayfa yayınlar. Yani Node.js sunucu dosyası olan `server.js` GitHub Pages'ta çalışmaz. GitHub için bu klasördeki statik sürümü kullanın.

```text
supabase-vercel/
```
