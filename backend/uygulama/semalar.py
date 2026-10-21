from datetime import datetime

from pydantic import BaseModel, Field


class KayitIstegi(BaseModel):
    kullanici_adi: str = Field(min_length=3, max_length=40)
    email: str = Field(min_length=5, max_length=120)
    sifre: str = Field(min_length=6, max_length=120)


class GirisIstegi(BaseModel):
    kimlik: str = Field(min_length=3, max_length=120)
    sifre: str = Field(min_length=6, max_length=120)


class MateryalIstegi(BaseModel):
    kimlik: str = Field(default="", max_length=80)
    ad: str = Field(min_length=1, max_length=160)
    tur: str = Field(default="", max_length=60)
    kaynak: str = Field(default="", max_length=600)
    icerik: str = Field(default="", max_length=2000)
    etiketler: list[str] = Field(default_factory=list, max_length=20)
    ekleyen_id: str = Field(default="", max_length=80)
    ekleyen_adi: str = Field(default="", max_length=120)
    ekleme_zamani: datetime | None = None


class BaslikIstegi(BaseModel):
    ad: str = Field(min_length=2, max_length=120)
    aciklama: str = Field(default="", max_length=1000)
    fotograf_url: str = Field(default="", max_length=800)
    etiketler: list[str] = Field(default_factory=list, max_length=20)
    baglanti_basliklari: list[str] = Field(default_factory=list, max_length=20)
    materyaller: list[MateryalIstegi] = Field(default_factory=list, max_length=80)
