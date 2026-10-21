from datetime import datetime, timedelta, timezone
from hashlib import pbkdf2_hmac
from hmac import compare_digest
from secrets import token_hex

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from .ayarlar import ayarlar
from .veritabani import kullanicilar


oauth2_sema = OAuth2PasswordBearer(tokenUrl="/giris")
sifre_yontemi = "pbkdf2_sha256"
sifre_tekrar_sayisi = 390000


def sifre_ozeti_olustur(sifre: str) -> str:
    tuz = token_hex(16)
    ozet = pbkdf2_hmac(
        "sha256",
        sifre.encode("utf-8"),
        tuz.encode("utf-8"),
        sifre_tekrar_sayisi,
    ).hex()
    return f"{sifre_yontemi}${sifre_tekrar_sayisi}${tuz}${ozet}"


def sifre_dogrula(sifre: str, sifre_ozeti: str) -> bool:
    try:
        yontem, tekrar, tuz, beklenen_ozet = sifre_ozeti.split("$", 3)
        tekrar_sayisi = int(tekrar)
    except ValueError:
        return False

    if yontem != sifre_yontemi:
        return False

    ozet = pbkdf2_hmac(
        "sha256",
        sifre.encode("utf-8"),
        tuz.encode("utf-8"),
        tekrar_sayisi,
    ).hex()
    return compare_digest(ozet, beklenen_ozet)


def belirtec_olustur(kullanici_id: str) -> str:
    bitis = datetime.now(timezone.utc) + timedelta(minutes=ayarlar.erisim_dakika)
    veri = {"sub": kullanici_id, "exp": bitis}
    return jwt.encode(veri, ayarlar.jwt_gizli_anahtar, algorithm=ayarlar.jwt_algoritmasi)


async def aktif_kullanici_getir(belirtec: str = Depends(oauth2_sema)) -> dict:
    hata = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Oturum gecersiz",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        veri = jwt.decode(
            belirtec,
            ayarlar.jwt_gizli_anahtar,
            algorithms=[ayarlar.jwt_algoritmasi],
        )
        kullanici_id = veri.get("sub")
    except JWTError as yanlis_belirtec:
        raise hata from yanlis_belirtec

    if not kullanici_id or not ObjectId.is_valid(kullanici_id):
        raise hata

    kullanici = await kullanicilar.find_one({"_id": ObjectId(kullanici_id)})
    if not kullanici:
        raise hata
    return kullanici
