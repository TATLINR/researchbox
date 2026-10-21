from motor.motor_asyncio import AsyncIOMotorClient

from .ayarlar import ayarlar


istemci = AsyncIOMotorClient(
    ayarlar.mongodb_uri,
    serverSelectionTimeoutMS=ayarlar.mongodb_zaman_asimi_ms,
)
veritabani = istemci[ayarlar.mongodb_veritabani]
kullanicilar = veritabani["kullanicilar"]
basliklar = veritabani["basliklar"]
kullanici_konulari = veritabani["kullanici_konulari"]
onaylar = veritabani["onaylar"]


async def indeksleri_hazirla() -> None:
    await kullanicilar.create_index("email_kucuk", unique=True)
    await kullanicilar.create_index("kullanici_adi_kucuk", unique=True)
    await basliklar.create_index("ad_kucuk")
    await basliklar.create_index("aciklama_kucuk")
    await basliklar.create_index("etiketler")
    await basliklar.create_index("etiketler_kucuk")
    await basliklar.create_index("baglanti_basliklari")
    await basliklar.create_index("baglanti_basliklari_kucuk")
    await basliklar.create_index("sahip_adi_kucuk")
    await basliklar.create_index("materyaller.ad_kucuk")
    await basliklar.create_index("materyaller.tur_kucuk")
    await basliklar.create_index("materyaller.kaynak_kucuk")
    await basliklar.create_index("materyaller.icerik_kucuk")
    await basliklar.create_index("materyaller.etiketler_kucuk")
    await basliklar.create_index([("giren_kullanici_sayisi", -1), ("olusturma_zamani", -1)])
    await kullanici_konulari.create_index(
        [("kullanici_id", 1), ("baslik_id", 1), ("tur", 1)],
        unique=True,
    )
    await kullanici_konulari.create_index([("kullanici_id", 1), ("tur", 1), ("guncelleme_zamani", -1)])
    await onaylar.create_index([("durum", 1), ("olusturma_zamani", -1)])
    await onaylar.create_index([("baslik_id", 1), ("tur", 1), ("durum", 1)])
