# Researchbox

Researchbox, kullanıcıların araştırma başlıkları açabildiği, etiket ekleyebildiği ve başlıklar arasında bağlantı kurabildiği iki parçalı bir uygulamadır.

## Backend

MongoDB yerelde çalışmıyorsa:

```bash
docker run --name researchbox-mongo -p 27017:27017 -d mongo:7
```

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r gereksinimler.txt
python -m uvicorn uygulama.ana:uygulama --reload
```

Backend varsayılan olarak `http://localhost:8000` adresinde çalışır.

MongoDB ayarları `backend/.env` içindedir.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend varsayılan olarak `http://localhost:5173` adresinde çalışır.

API adresi `frontend/.env` içindeki `VITE_API_KOKU` değeriyle ayarlanır.

Yeni konu sayfası `http://localhost:5173/yeni`, arama sayfası `http://localhost:5173/arama`, profil sayfası `http://localhost:5173/profil` adresindedir.

Admin sayfası `http://localhost:5173/admin` adresindedir. Geçici admin hesabı:

```text
Kullanıcı adı: admin@admin.com
Şifre: admin123
```

## Özellikler

- Kayıt
- Giriş
- Oturum doğrulama
- Ana sayfada kare konu kartları
- Sağ artı butonuyla yeni konu sayfasına geçme
- Başlık açma isteğini admin onayına gönderme
- Her kullanıcının başlık düzenleme isteği gönderebilmesi
- Konuya doğrudan fotoğraf dosyası yükleme
- Konulara veri/materyal ekleme isteğini onaya gönderme
- Konu açıklaması ve verilerinde markdown editörü, URL, fotoğraf yükleme, fotoğraf bağlantısı, başlık, kalın, italik, kod, alıntı, liste ve büyük harf desteği
- `/admin` sayfasından başlık ve düzenleme isteklerini onaylama veya reddetme
- `/admin` sayfasından yayındaki konuları silme
- `/arama` sayfasında başlık, tag, açıklama, kaynak ve veri arama
- `/profil` sayfasında kullanıcının açtığı başlıkları ve düzenlemelerini görme
- Etiket ekleme
- Bağlantılı başlık adı ekleme
- Son başlıkları listeleme
- Başlıkları giren kişi sayısına göre öne çıkarma
- Kaydedilen konuları MongoDB üzerinde saklama
- Son gezilen konuları MongoDB üzerinde saklama
- Swiper arama sonuç şeridi
- Lenis smooth scroll
- ScrollMagic ve ScrollReveal scroll animasyonları
- Animate.css giriş animasyonları
- Oturum açıkken son gezilen ve kaydedilen konular
