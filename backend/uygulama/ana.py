from contextlib import asynccontextmanager
from datetime import datetime, timezone
from logging import getLogger
from pathlib import Path
from re import escape
from uuid import uuid4

from bson import ObjectId
from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError, ServerSelectionTimeoutError

from .ayarlar import ayarlar
from .guvenlik import (
    aktif_kullanici_getir,
    belirtec_olustur,
    sifre_dogrula,
    sifre_ozeti_olustur,
)
from .semalar import BaslikIstegi, GirisIstegi, KayitIstegi
from .veritabani import basliklar, indeksleri_hazirla, kullanici_konulari, kullanicilar, onaylar


admin_kimligi = "admin@admin.com"
admin_sifresi = "admin123"
gunluk = getLogger("researchbox")
yukleme_koku = Path(__file__).resolve().parents[1] / "yuklemeler"
fotograf_dizini = yukleme_koku / "fotograflar"
fotograf_dizini.mkdir(parents=True, exist_ok=True)
fotograf_turleri = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
azami_fotograf_boyutu = 8 * 1024 * 1024


@asynccontextmanager
async def yasam_dongusu(_: FastAPI):
    try:
        await indeksleri_hazirla()
        await admin_kullanicisini_hazirla()
    except PyMongoError as hata:
        gunluk.warning("Veritabani baslangici tamamlanamadi: %s", hata)
    yield


uygulama = FastAPI(title="Researchbox", lifespan=yasam_dongusu)
uygulama.mount("/yuklemeler", StaticFiles(directory=str(yukleme_koku)), name="yuklemeler")
uygulama.add_middleware(
    CORSMiddleware,
    allow_origins=list(ayarlar.izinli_kokenler),
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):5173",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@uygulama.exception_handler(ServerSelectionTimeoutError)
async def veritabani_baglanti_hatasi(_, __):
    return JSONResponse(status_code=503, content={"detail": "Veritabanı bağlantısı kurulamadı"})


@uygulama.exception_handler(PyMongoError)
async def veritabani_islem_hatasi(_, __):
    return JSONResponse(status_code=503, content={"detail": "Veritabanı işlemi tamamlanamadı"})


def simdi() -> datetime:
    return datetime.now(timezone.utc)


def kucuk_metin(deger: str) -> str:
    return deger.strip().lower()


def dolu_metin(deger: str, alan: str) -> str:
    metin = deger.strip()
    if not metin:
        raise HTTPException(status_code=422, detail=f"{alan} bos olamaz")
    return metin


def nesne_kimligi(deger, alan: str) -> ObjectId:
    if isinstance(deger, ObjectId):
        return deger
    metin = str(deger)
    if not ObjectId.is_valid(metin):
        raise HTTPException(status_code=404, detail=f"{alan} bulunamadi")
    return ObjectId(metin)


def temiz_liste(degerler: list[str]) -> list[str]:
    temizler: list[str] = []
    gorulenler: set[str] = set()
    for deger in degerler:
        metin = deger.strip()
        anahtar = metin.lower()
        if metin and anahtar not in gorulenler:
            temizler.append(metin)
            gorulenler.add(anahtar)
    return temizler


def kucuk_liste(degerler: list[str]) -> list[str]:
    return [kucuk_metin(deger) for deger in degerler]


def arama_sorgusu(arama: str) -> dict:
    metin = arama.strip()
    if not metin:
        return {}

    kucuk = escape(kucuk_metin(metin))
    ham = escape(metin)
    return {
        "$or": [
            {"ad_kucuk": {"$regex": kucuk}},
            {"aciklama_kucuk": {"$regex": kucuk}},
            {"etiketler_kucuk": {"$regex": kucuk}},
            {"baglanti_basliklari_kucuk": {"$regex": kucuk}},
            {"materyaller.ad_kucuk": {"$regex": kucuk}},
            {"materyaller.tur_kucuk": {"$regex": kucuk}},
            {"materyaller.kaynak_kucuk": {"$regex": kucuk}},
            {"materyaller.icerik_kucuk": {"$regex": kucuk}},
            {"materyaller.etiketler_kucuk": {"$regex": kucuk}},
            {"sahip_adi_kucuk": {"$regex": kucuk}},
            {"ad": {"$regex": ham, "$options": "i"}},
            {"aciklama": {"$regex": ham, "$options": "i"}},
            {"etiketler": {"$regex": ham, "$options": "i"}},
            {"baglanti_basliklari": {"$regex": ham, "$options": "i"}},
            {"materyaller.ad": {"$regex": ham, "$options": "i"}},
            {"materyaller.tur": {"$regex": ham, "$options": "i"}},
            {"materyaller.kaynak": {"$regex": ham, "$options": "i"}},
            {"materyaller.icerik": {"$regex": ham, "$options": "i"}},
            {"materyaller.etiketler": {"$regex": ham, "$options": "i"}},
            {"sahip_adi": {"$regex": ham, "$options": "i"}},
        ]
    }


def kullanici_ciktisi(kullanici: dict) -> dict:
    return {
        "id": str(kullanici["_id"]),
        "kullanici_adi": kullanici["kullanici_adi"],
        "email": kullanici["email"],
        "rol": kullanici.get("rol", "kullanici"),
    }


def tarih_ciktisi(deger) -> str | None:
    return deger.isoformat() if isinstance(deger, datetime) else None


def materyal_anahtari(materyal: dict) -> str:
    return "|".join(
        kucuk_metin(str(materyal.get(alan, "")))
        for alan in ("ad", "tur", "kaynak", "icerik")
    )


def onceki_materyalleri_indeksle(mevcut_baslik: dict | None) -> tuple[dict[str, dict], dict[str, dict]]:
    kimlikler: dict[str, dict] = {}
    anahtarlar: dict[str, dict] = {}
    if not mevcut_baslik:
        return kimlikler, anahtarlar

    for materyal in mevcut_baslik.get("materyaller", []):
        kimlik = str(materyal.get("kimlik") or "")
        if kimlik:
            kimlikler[kimlik] = materyal
        anahtarlar.setdefault(materyal_anahtari(materyal), materyal)
    return kimlikler, anahtarlar


def materyal_ciktisi(materyal: dict, varsayilan_ekleyen_adi: str = "", varsayilan_ekleyen_id: str = "") -> dict:
    return {
        "kimlik": str(materyal.get("kimlik") or ""),
        "ad": materyal.get("ad", ""),
        "tur": materyal.get("tur", ""),
        "kaynak": materyal.get("kaynak", ""),
        "icerik": materyal.get("icerik", ""),
        "etiketler": materyal.get("etiketler", []),
        "ekleyen_id": str(materyal.get("ekleyen_id") or varsayilan_ekleyen_id or ""),
        "ekleyen_adi": materyal.get("ekleyen_adi") or varsayilan_ekleyen_adi,
        "ekleme_zamani": tarih_ciktisi(materyal.get("ekleme_zamani")),
    }


def baslik_ciktisi(baslik: dict) -> dict:
    return {
        "id": str(baslik["_id"]),
        "ad": baslik["ad"],
        "aciklama": baslik.get("aciklama", ""),
        "fotograf_url": baslik.get("fotograf_url", ""),
        "etiketler": baslik.get("etiketler", []),
        "baglanti_basliklari": baslik.get("baglanti_basliklari", []),
        "materyaller": [
            materyal_ciktisi(materyal, baslik.get("sahip_adi", ""), str(baslik.get("kullanici_id") or ""))
            for materyal in baslik.get("materyaller", [])
        ],
        "sahip_id": str(baslik["kullanici_id"]),
        "sahip_adi": baslik.get("sahip_adi", ""),
        "giren_kullanici_sayisi": baslik.get("giren_kullanici_sayisi", 0),
        "olusturma_zamani": baslik["olusturma_zamani"].isoformat(),
    }


def baslik_verisi_hazirla(istek: BaslikIstegi, kullanici: dict | None = None, mevcut_baslik: dict | None = None) -> dict:
    ad = dolu_metin(istek.ad, "Baslik")
    etiketler = temiz_liste(istek.etiketler)
    baglanti_basliklari = temiz_liste(istek.baglanti_basliklari)
    materyaller = materyalleri_hazirla(istek.materyaller, kullanici, mevcut_baslik)
    aciklama = istek.aciklama.strip()
    fotograf_url = istek.fotograf_url.strip()
    return {
        "ad": ad,
        "ad_kucuk": kucuk_metin(ad),
        "aciklama": aciklama,
        "aciklama_kucuk": kucuk_metin(aciklama),
        "fotograf_url": fotograf_url,
        "etiketler": etiketler,
        "etiketler_kucuk": kucuk_liste(etiketler),
        "baglanti_basliklari": baglanti_basliklari,
        "baglanti_basliklari_kucuk": kucuk_liste(baglanti_basliklari),
        "materyaller": materyaller,
    }


def materyalleri_hazirla(materyaller, kullanici: dict | None = None, mevcut_baslik: dict | None = None) -> list[dict]:
    temizler: list[dict] = []
    gorulenler: set[str] = set()
    onceki_kimlikler, onceki_anahtarlar = onceki_materyalleri_indeksle(mevcut_baslik)
    varsayilan_ekleyen_id = str(mevcut_baslik.get("kullanici_id") or "") if mevcut_baslik else ""
    varsayilan_ekleyen_adi = mevcut_baslik.get("sahip_adi", "") if mevcut_baslik else ""
    varsayilan_ekleme_zamani = mevcut_baslik.get("olusturma_zamani") if mevcut_baslik else None
    ekleme_zamani = simdi()
    for materyal in materyaller:
        ad = materyal.ad.strip()
        if not ad:
            continue
        tur = materyal.tur.strip()
        kaynak = materyal.kaynak.strip()
        icerik = materyal.icerik.strip()
        etiketler = temiz_liste(materyal.etiketler)
        belge = {
            "ad": ad,
            "ad_kucuk": kucuk_metin(ad),
            "tur": tur,
            "tur_kucuk": kucuk_metin(tur),
            "kaynak": kaynak,
            "kaynak_kucuk": kucuk_metin(kaynak),
            "icerik": icerik,
            "icerik_kucuk": kucuk_metin(icerik),
            "etiketler": etiketler,
            "etiketler_kucuk": kucuk_liste(etiketler),
        }
        anahtar = materyal_anahtari(belge)
        if anahtar in gorulenler:
            continue
        onceki = onceki_kimlikler.get(materyal.kimlik.strip()) or onceki_anahtarlar.get(anahtar)
        if onceki:
            belge["kimlik"] = str(onceki.get("kimlik") or materyal.kimlik.strip() or uuid4().hex)
            belge["ekleyen_id"] = str(onceki.get("ekleyen_id") or materyal.ekleyen_id or varsayilan_ekleyen_id)
            belge["ekleyen_adi"] = onceki.get("ekleyen_adi") or materyal.ekleyen_adi or varsayilan_ekleyen_adi
            belge["ekleme_zamani"] = onceki.get("ekleme_zamani") or materyal.ekleme_zamani or varsayilan_ekleme_zamani or ekleme_zamani
        else:
            belge["kimlik"] = uuid4().hex
            belge["ekleyen_id"] = str(kullanici["_id"]) if kullanici else ""
            belge["ekleyen_adi"] = kullanici.get("kullanici_adi", "") if kullanici else ""
            belge["ekleme_zamani"] = ekleme_zamani
        temizler.append(belge)
        gorulenler.add(anahtar)
    return temizler


def baslik_verisi_ciktisi(veri: dict) -> dict:
    return {
        "ad": veri.get("ad", ""),
        "aciklama": veri.get("aciklama", ""),
        "fotograf_url": veri.get("fotograf_url", ""),
        "etiketler": veri.get("etiketler", []),
        "baglanti_basliklari": veri.get("baglanti_basliklari", []),
        "materyaller": [materyal_ciktisi(materyal) for materyal in veri.get("materyaller", [])],
    }


def onay_ciktisi(onay: dict) -> dict:
    baslik_id = onay.get("baslik_id")
    return {
        "id": str(onay["_id"]),
        "tur": onay["tur"],
        "durum": onay["durum"],
        "baslik_id": str(baslik_id) if baslik_id else None,
        "baslik_verisi": baslik_verisi_ciktisi(onay.get("baslik_verisi", {})),
        "kullanici_id": str(onay["kullanici_id"]),
        "kullanici_adi": onay.get("kullanici_adi", ""),
        "olusturma_zamani": tarih_ciktisi(onay.get("olusturma_zamani")),
        "karar_zamani": tarih_ciktisi(onay.get("karar_zamani")),
    }


async def admin_kullanicisini_hazirla() -> None:
    await kullanicilar.update_one(
        {"email_kucuk": admin_kimligi},
        {
            "$set": {
                "kullanici_adi": admin_kimligi,
                "kullanici_adi_kucuk": admin_kimligi,
                "email": admin_kimligi,
                "email_kucuk": admin_kimligi,
                "sifre_ozeti": sifre_ozeti_olustur(admin_sifresi),
                "rol": "admin",
            },
            "$setOnInsert": {"olusturma_zamani": simdi()},
        },
        upsert=True,
    )


async def aktif_admin_getir(kullanici: dict = Depends(aktif_kullanici_getir)) -> dict:
    if kullanici.get("rol") != "admin" and kullanici.get("email_kucuk") != admin_kimligi:
        raise HTTPException(status_code=403, detail="Admin yetkisi gerekli")
    return kullanici


async def baslik_getir(baslik_id: str) -> dict:
    baslik = await basliklar.find_one({"_id": nesne_kimligi(baslik_id, "Baslik")})
    if not baslik:
        raise HTTPException(status_code=404, detail="Baslik bulunamadi")
    return baslik


async def onay_getir(onay_id: str) -> dict:
    if not ObjectId.is_valid(onay_id):
        raise HTTPException(status_code=404, detail="Onay kaydi bulunamadi")

    onay = await onaylar.find_one({"_id": ObjectId(onay_id)})
    if not onay:
        raise HTTPException(status_code=404, detail="Onay kaydi bulunamadi")
    return onay


async def kullanici_konu_listesi(kullanici: dict, tur: str) -> list[dict]:
    imlec = kullanici_konulari.find({"kullanici_id": kullanici["_id"], "tur": tur}).sort("guncelleme_zamani", -1).limit(8)
    kayitlar = [kayit async for kayit in imlec]
    baslik_idleri = [kayit["baslik_id"] for kayit in kayitlar]
    if not baslik_idleri:
        return []

    baslik_imleci = basliklar.find({"_id": {"$in": baslik_idleri}})
    bulunanlar = {baslik["_id"]: baslik async for baslik in baslik_imleci}
    return [baslik_ciktisi(bulunanlar[baslik_id]) for baslik_id in baslik_idleri if baslik_id in bulunanlar]


async def kullanici_konu_cevabi(kullanici: dict) -> dict:
    return {
        "son_gezdigin": await kullanici_konu_listesi(kullanici, "son_gezdigin"),
        "kaydedilen": await kullanici_konu_listesi(kullanici, "kaydedilen"),
    }


async def kullanici_konusu_yaz(kullanici: dict, baslik_id: str, tur: str) -> dict:
    baslik = await baslik_getir(baslik_id)
    yeni_kayit = False
    try:
        sonuc = await kullanici_konulari.update_one(
            {"kullanici_id": kullanici["_id"], "baslik_id": baslik["_id"], "tur": tur},
            {
                "$set": {
                    "kullanici_id": kullanici["_id"],
                    "baslik_id": baslik["_id"],
                    "tur": tur,
                    "guncelleme_zamani": simdi(),
                }
            },
            upsert=True,
        )
        yeni_kayit = sonuc.upserted_id is not None
    except DuplicateKeyError:
        await kullanici_konulari.update_one(
            {"kullanici_id": kullanici["_id"], "baslik_id": baslik["_id"], "tur": tur},
            {"$set": {"guncelleme_zamani": simdi()}},
        )

    if tur == "son_gezdigin" and yeni_kayit:
        guncel_baslik = await basliklar.find_one_and_update(
            {"_id": baslik["_id"]},
            {"$inc": {"giren_kullanici_sayisi": 1}},
            return_document=ReturnDocument.AFTER,
        )
        if guncel_baslik:
            baslik = guncel_baslik

    cevap = await kullanici_konu_cevabi(kullanici)
    cevap["baslik"] = baslik_ciktisi(baslik)
    return cevap


@uygulama.get("/saglik")
async def saglik() -> dict:
    return {"durum": "calisiyor"}


@uygulama.post("/kayit", status_code=status.HTTP_201_CREATED)
async def kayit(istek: KayitIstegi) -> dict:
    kullanici_adi = dolu_metin(istek.kullanici_adi, "Kullanici adi")
    email = dolu_metin(istek.email, "Email")
    if "@" not in email:
        raise HTTPException(status_code=422, detail="Email gecersiz")

    belge = {
        "kullanici_adi": kullanici_adi,
        "kullanici_adi_kucuk": kucuk_metin(kullanici_adi),
        "email": email,
        "email_kucuk": kucuk_metin(email),
        "sifre_ozeti": sifre_ozeti_olustur(istek.sifre),
        "olusturma_zamani": simdi(),
    }

    try:
        sonuc = await kullanicilar.insert_one(belge)
    except DuplicateKeyError as cakisan_kayit:
        raise HTTPException(status_code=409, detail="Kullanici adi veya email kullaniliyor") from cakisan_kayit

    belge["_id"] = sonuc.inserted_id
    return {
        "belirtec": belirtec_olustur(str(sonuc.inserted_id)),
        "kullanici": kullanici_ciktisi(belge),
    }


@uygulama.post("/giris")
async def giris(istek: GirisIstegi) -> dict:
    kimlik = kucuk_metin(istek.kimlik)
    kullanici = await kullanicilar.find_one(
        {"$or": [{"email_kucuk": kimlik}, {"kullanici_adi_kucuk": kimlik}]}
    )

    if not kullanici or not sifre_dogrula(istek.sifre, kullanici["sifre_ozeti"]):
        raise HTTPException(status_code=401, detail="Giris bilgileri hatali")

    return {
        "belirtec": belirtec_olustur(str(kullanici["_id"])),
        "kullanici": kullanici_ciktisi(kullanici),
    }


@uygulama.get("/ben")
async def ben(kullanici: dict = Depends(aktif_kullanici_getir)) -> dict:
    return {"kullanici": kullanici_ciktisi(kullanici)}


@uygulama.get("/ben/konular")
async def ben_konular(kullanici: dict = Depends(aktif_kullanici_getir)) -> dict:
    return await kullanici_konu_cevabi(kullanici)


@uygulama.get("/ben/profil")
async def ben_profil(kullanici: dict = Depends(aktif_kullanici_getir)) -> dict:
    baslik_imleci = basliklar.find({"kullanici_id": kullanici["_id"]}).sort("olusturma_zamani", -1).limit(100)
    duzenleme_imleci = onaylar.find({"kullanici_id": kullanici["_id"], "tur": "duzenleme"}).sort(
        "olusturma_zamani", -1
    ).limit(100)
    return {
        "kullanici": kullanici_ciktisi(kullanici),
        "actigi_basliklar": [baslik_ciktisi(baslik) async for baslik in baslik_imleci],
        "duzenlemeler": [onay_ciktisi(onay) async for onay in duzenleme_imleci],
    }


@uygulama.post("/fotograflar", status_code=status.HTTP_201_CREATED)
async def fotograf_yukle(
    istek: Request,
    dosya: UploadFile = File(...),
    kullanici: dict = Depends(aktif_kullanici_getir),
) -> dict:
    uzanti = fotograf_turleri.get(dosya.content_type or "")
    if not uzanti:
        raise HTTPException(status_code=422, detail="Sadece jpg, png, webp veya gif yuklenebilir")

    icerik = await dosya.read()
    if not icerik:
        raise HTTPException(status_code=422, detail="Fotograf bos olamaz")
    if len(icerik) > azami_fotograf_boyutu:
        raise HTTPException(status_code=413, detail="Fotograf en fazla 8 MB olabilir")

    dosya_adi = f"{kullanici['_id']}-{uuid4().hex}{uzanti}"
    hedef = fotograf_dizini / dosya_adi
    hedef.write_bytes(icerik)
    kok = str(istek.base_url).rstrip("/")
    return {"fotograf_url": f"{kok}/yuklemeler/fotograflar/{dosya_adi}"}


@uygulama.post("/ben/son-gezdigin/{baslik_id}")
async def son_gezdigin_yaz(baslik_id: str, kullanici: dict = Depends(aktif_kullanici_getir)) -> dict:
    return await kullanici_konusu_yaz(kullanici, baslik_id, "son_gezdigin")


@uygulama.post("/ben/kaydedilen/{baslik_id}")
async def kaydedilen_yaz(baslik_id: str, kullanici: dict = Depends(aktif_kullanici_getir)) -> dict:
    return await kullanici_konusu_yaz(kullanici, baslik_id, "kaydedilen")


@uygulama.delete("/ben/kaydedilen/{baslik_id}")
async def kaydedilen_sil(baslik_id: str, kullanici: dict = Depends(aktif_kullanici_getir)) -> dict:
    if not ObjectId.is_valid(baslik_id):
        raise HTTPException(status_code=404, detail="Baslik bulunamadi")

    await kullanici_konulari.delete_one(
        {"kullanici_id": kullanici["_id"], "baslik_id": ObjectId(baslik_id), "tur": "kaydedilen"}
    )
    return await kullanici_konu_cevabi(kullanici)


@uygulama.post("/basliklar", status_code=status.HTTP_201_CREATED)
async def baslik_olustur(
    istek: BaslikIstegi,
    kullanici: dict = Depends(aktif_kullanici_getir),
) -> dict:
    belge = {
        "tur": "olusturma",
        "durum": "bekliyor",
        "baslik_id": None,
        "baslik_verisi": baslik_verisi_hazirla(istek, kullanici),
        "kullanici_id": kullanici["_id"],
        "kullanici_adi": kullanici["kullanici_adi"],
        "olusturma_zamani": simdi(),
    }
    sonuc = await onaylar.insert_one(belge)
    belge["_id"] = sonuc.inserted_id
    return {"onay": onay_ciktisi(belge), "mesaj": "Başlık onaya gönderildi"}


@uygulama.put("/basliklar/{baslik_id}", status_code=status.HTTP_201_CREATED)
async def baslik_duzenleme_gonder(
    baslik_id: str,
    istek: BaslikIstegi,
    kullanici: dict = Depends(aktif_kullanici_getir),
) -> dict:
    mevcut_baslik = await baslik_getir(baslik_id)
    belge = {
        "tur": "duzenleme",
        "durum": "bekliyor",
        "baslik_id": mevcut_baslik["_id"],
        "baslik_verisi": baslik_verisi_hazirla(istek, kullanici, mevcut_baslik),
        "kullanici_id": kullanici["_id"],
        "kullanici_adi": kullanici["kullanici_adi"],
        "olusturma_zamani": simdi(),
    }
    sonuc = await onaylar.insert_one(belge)
    belge["_id"] = sonuc.inserted_id
    return {"onay": onay_ciktisi(belge), "mesaj": "Düzenleme onaya gönderildi"}


@uygulama.get("/basliklar")
async def basliklari_listele(arama: str = Query(default="", max_length=120)) -> dict:
    imlec = basliklar.find(arama_sorgusu(arama)).sort(
        [("giren_kullanici_sayisi", -1), ("olusturma_zamani", -1)]
    ).limit(50)
    bulunanlar = [baslik_ciktisi(baslik) async for baslik in imlec]
    return {"basliklar": bulunanlar}


@uygulama.get("/basliklar/{baslik_id}")
async def baslik_detay(baslik_id: str) -> dict:
    return {"baslik": baslik_ciktisi(await baslik_getir(baslik_id))}


@uygulama.get("/admin/onaylar")
async def admin_onaylari_listele(
    durum: str = Query(default="bekliyor"),
    _: dict = Depends(aktif_admin_getir),
) -> dict:
    if durum not in {"bekliyor", "onaylandi", "reddedildi", "tum"}:
        raise HTTPException(status_code=422, detail="Onay durumu gecersiz")
    sorgu = {} if durum == "tum" else {"durum": durum}
    imlec = onaylar.find(sorgu).sort("olusturma_zamani", -1).limit(100)
    return {"onaylar": [onay_ciktisi(onay) async for onay in imlec]}


@uygulama.get("/admin/basliklar")
async def admin_basliklari_listele(_: dict = Depends(aktif_admin_getir)) -> dict:
    imlec = basliklar.find({}).sort([("olusturma_zamani", -1)]).limit(200)
    return {"basliklar": [baslik_ciktisi(baslik) async for baslik in imlec]}


@uygulama.delete("/admin/basliklar/{baslik_id}")
async def admin_baslik_sil(baslik_id: str, _: dict = Depends(aktif_admin_getir)) -> dict:
    baslik = await baslik_getir(baslik_id)
    await basliklar.delete_one({"_id": baslik["_id"]})
    await kullanici_konulari.delete_many({"baslik_id": baslik["_id"]})
    await onaylar.delete_many({"baslik_id": baslik["_id"], "durum": "bekliyor"})
    return {"mesaj": "Konu silindi", "baslik": baslik_ciktisi(baslik)}


@uygulama.post("/admin/onaylar/{onay_id}/onayla")
async def admin_onayla(onay_id: str, admin: dict = Depends(aktif_admin_getir)) -> dict:
    onay = await onay_getir(onay_id)
    if onay["durum"] != "bekliyor":
        raise HTTPException(status_code=409, detail="Onay kaydi daha once karara baglanmis")

    karar_zamani = simdi()
    baslik_verisi = onay["baslik_verisi"]
    if onay["tur"] == "olusturma":
        baslik_belgesi = {
            **baslik_verisi,
            "kullanici_id": onay["kullanici_id"],
            "sahip_adi": onay.get("kullanici_adi", ""),
            "sahip_adi_kucuk": kucuk_metin(onay.get("kullanici_adi", "")),
            "giren_kullanici_sayisi": 0,
            "olusturma_zamani": onay.get("olusturma_zamani", karar_zamani),
            "onay_zamani": karar_zamani,
        }
        sonuc = await basliklar.insert_one(baslik_belgesi)
        baslik_belgesi["_id"] = sonuc.inserted_id
        baslik = baslik_belgesi
        baslik_id = sonuc.inserted_id
    elif onay["tur"] == "duzenleme":
        ham_baslik_id = onay.get("baslik_id")
        if not ham_baslik_id:
            raise HTTPException(status_code=422, detail="Duzenleme basligi eksik")
        baslik_id = nesne_kimligi(ham_baslik_id, "Baslik")
        baslik = await basliklar.find_one_and_update(
            {"_id": baslik_id},
            {"$set": {**baslik_verisi, "guncelleme_zamani": karar_zamani}},
            return_document=ReturnDocument.AFTER,
        )
        if not baslik:
            raise HTTPException(status_code=404, detail="Baslik bulunamadi")
    else:
        raise HTTPException(status_code=422, detail="Onay turu gecersiz")

    guncel_onay = await onaylar.find_one_and_update(
        {"_id": onay["_id"]},
        {
            "$set": {
                "durum": "onaylandi",
                "karar_zamani": karar_zamani,
                "karar_veren_id": admin["_id"],
                "baslik_id": baslik_id,
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    return {"onay": onay_ciktisi(guncel_onay), "baslik": baslik_ciktisi(baslik)}


@uygulama.post("/admin/onaylar/{onay_id}/reddet")
async def admin_reddet(onay_id: str, admin: dict = Depends(aktif_admin_getir)) -> dict:
    onay = await onay_getir(onay_id)
    if onay["durum"] != "bekliyor":
        raise HTTPException(status_code=409, detail="Onay kaydi daha once karara baglanmis")

    guncel_onay = await onaylar.find_one_and_update(
        {"_id": onay["_id"]},
        {
            "$set": {
                "durum": "reddedildi",
                "karar_zamani": simdi(),
                "karar_veren_id": admin["_id"],
            }
        },
        return_document=ReturnDocument.AFTER,
    )
    return {"onay": onay_ciktisi(guncel_onay)}
