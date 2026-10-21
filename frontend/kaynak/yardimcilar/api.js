function apiKokunuBul() {
  const ayar = import.meta.env.VITE_API_KOKU;
  if (typeof window === "undefined") {
    return ayar || "http://localhost:8000";
  }

  const mevcutHost = window.location.hostname;
  const yerelHostlar = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
  if (ayar) {
    try {
      const url = new URL(ayar);
      if (!yerelHostlar.has(mevcutHost) && yerelHostlar.has(url.hostname)) {
        url.hostname = mevcutHost;
        return url.origin;
      }
      return url.origin;
    } catch {
      return ayar;
    }
  }

  return `${window.location.protocol}//${mevcutHost}:8000`;
}

const apiKoku = apiKokunuBul();

export async function apiIstegi(yol, { yontem = "GET", govde, formVerisi, belirtec } = {}) {
  const basliklar = {};
  const formGonderiliyor = formVerisi instanceof FormData;

  if (!formGonderiliyor) {
    basliklar["Content-Type"] = "application/json";
  }

  if (belirtec) {
    basliklar.Authorization = `Bearer ${belirtec}`;
  }

  let cevap;
  try {
    cevap = await fetch(`${apiKoku}${yol}`, {
      method: yontem,
      headers: basliklar,
      body: formGonderiliyor ? formVerisi : govde ? JSON.stringify(govde) : undefined,
    });
  } catch (baglantiHatasi) {
    throw new Error("API bağlantısı kurulamadı");
  }
  const veri = await cevap.json().catch(() => ({}));

  if (!cevap.ok) {
    throw new Error(veri.detail || "İşlem tamamlanamadı");
  }

  return veri;
}
