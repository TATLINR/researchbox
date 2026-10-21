from dataclasses import dataclass
from os import getenv
from pathlib import Path

from dotenv import load_dotenv


kok_dizin = Path(__file__).resolve().parents[1]
load_dotenv(kok_dizin / ".env")


def listeye_cevir(deger: str) -> tuple[str, ...]:
    return tuple(parca.strip() for parca in deger.split(",") if parca.strip())


@dataclass(frozen=True)
class Ayarlar:
    mongodb_uri: str = getenv("MONGODB_URI", "mongodb://localhost:27017")
    mongodb_veritabani: str = getenv("MONGODB_VERITABANI", "researchbox")
    mongodb_zaman_asimi_ms: int = int(getenv("MONGODB_ZAMAN_ASIMI_MS", "3000"))
    jwt_gizli_anahtar: str = getenv("JWT_GIZLI_ANAHTAR", "gelistirme_anahtari")
    jwt_algoritmasi: str = getenv("JWT_ALGORITMASI", "HS256")
    erisim_dakika: int = int(getenv("ERISIM_DAKIKA", "1440"))
    izinli_kokenler: tuple[str, ...] = listeye_cevir(
        getenv("IZINLI_KOKENLER", "http://localhost:5173,http://127.0.0.1:5173")
    )


ayarlar = Ayarlar()
