import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bookmark,
  BookOpen,
  Bold,
  Check,
  Clock3,
  Code,
  ExternalLink,
  Eye,
  FilePlus,
  Heading1,
  Heading2,
  Image,
  Italic,
  Link2,
  List,
  LockKeyhole,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Quote,
  RefreshCw,
  Search,
  ShieldCheck,
  Tags,
  Trash2,
  Type,
  UserRound,
  UserPlus,
  X,
} from "lucide-react";
import Lenis from "lenis";

import "animate.css";
import "./bicim.css";
import { apiIstegi } from "./yardimcilar/api.js";

const bosKayit = {
  kullanici_adi: "",
  email: "",
  sifre: "",
};

const bosGiris = {
  kimlik: "",
  sifre: "",
};

const adminBosGiris = {
  kimlik: "admin@admin.com",
  sifre: "admin123",
};

const bosBaslik = {
  ad: "",
  aciklama: "",
  fotograf_url: "",
  icerik_metni: "",
  etiket_metni: "",
  baglanti_metni: "",
  materyal_metni: "",
};

const konuIcerigiAdi = "Konu içeriği";

const bosVeri = {
  ad: "",
  tur: "",
  kaynak: "",
  icerik: "",
  etiket_metni: "",
};

function metniParcala(metin) {
  return metin
    .split(",")
    .map((parca) => parca.trim())
    .filter(Boolean);
}

function tarihYaz(deger) {
  if (!deger) {
    return "";
  }
  return new Date(deger).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function girisSayisi(oge) {
  return Number(oge.giren_kullanici_sayisi || 0);
}

function girisMetni(oge) {
  return `${girisSayisi(oge)} kişi girdi`;
}

function materyalleriAl(oge) {
  return Array.isArray(oge?.materyaller) ? oge.materyaller : [];
}

function konuIceriginiBul(materyaller) {
  return materyalleriAl({ materyaller }).find((materyal) => materyal.ad?.toLocaleLowerCase("tr-TR") === konuIcerigiAdi.toLocaleLowerCase("tr-TR"));
}

function konuIcerigiDisindakiler(materyaller) {
  return materyalleriAl({ materyaller }).filter((materyal) => materyal.ad?.toLocaleLowerCase("tr-TR") !== konuIcerigiAdi.toLocaleLowerCase("tr-TR"));
}

function konuIcerigiMateryali(icerik) {
  const temizIcerik = (icerik || "").trim();
  if (!temizIcerik) {
    return null;
  }
  return materyalTemizle({
    ad: konuIcerigiAdi,
    tur: "metin",
    kaynak: "",
    icerik: temizIcerik,
    etiketler: [],
  });
}

function baslikMateryalleriniHazirla(baslik) {
  const konuIcerigi = konuIcerigiMateryali(baslik.icerik_metni);
  const digerleri = konuIcerigiDisindakiler(materyalMetniniParcala(baslik.materyal_metni));
  return konuIcerigi ? [konuIcerigi, ...digerleri] : digerleri;
}

function basliklariSirala(liste) {
  return [...liste].sort((sol, sag) => {
    const sayiFarki = girisSayisi(sag) - girisSayisi(sol);
    if (sayiFarki !== 0) {
      return sayiFarki;
    }
    return new Date(sag.olusturma_zamani).getTime() - new Date(sol.olusturma_zamani).getTime();
  });
}

function baslikListeyeYerlestir(liste, guncelBaslik) {
  if (!guncelBaslik?.id) {
    return basliklariSirala(liste);
  }
  const varMi = liste.some((oge) => oge.id === guncelBaslik.id);
  const yeniListe = varMi
    ? liste.map((oge) => (oge.id === guncelBaslik.id ? { ...oge, ...guncelBaslik } : oge))
    : [guncelBaslik, ...liste];
  return basliklariSirala(yeniListe);
}

function aramaMetnineCevir(oge) {
  const materyalMetni = materyalleriAl(oge)
    .flatMap((materyal) => [
      materyal.ad,
      materyal.tur,
      materyal.kaynak,
      materyal.icerik,
      ...(materyal.etiketler || []),
    ])
    .join(" ");
  return [
    oge.ad,
    oge.aciklama,
    oge.sahip_adi,
    oge.fotograf_url,
    materyalMetni,
    ...(oge.etiketler || []),
    ...(oge.baglanti_basliklari || []),
  ]
    .join(" ")
    .toLocaleLowerCase("tr-TR");
}

function konuOzeti(oge) {
  return {
    id: oge.id,
    ad: oge.ad,
    sahip_adi: oge.sahip_adi || "",
    fotograf_url: oge.fotograf_url || "",
    etiketler: Array.isArray(oge.etiketler) ? oge.etiketler.slice(0, 4) : [],
    materyaller: materyalleriAl(oge).slice(0, 4),
    giren_kullanici_sayisi: girisSayisi(oge),
  };
}

function listeyeYerelEkle(liste, oge) {
  const ozet = konuOzeti(oge);
  return [ozet, ...liste.filter((kayit) => kayit.id !== ozet.id)].slice(0, 8);
}

function listedenYerelCikar(liste, id) {
  return liste.filter((kayit) => kayit.id !== id);
}

function materyalTemizle(materyal) {
  return {
    kimlik: (materyal.kimlik || "").trim(),
    ad: (materyal.ad || "").trim(),
    tur: (materyal.tur || "").trim(),
    kaynak: (materyal.kaynak || "").trim(),
    icerik: (materyal.icerik || "").trim(),
    etiketler: Array.isArray(materyal.etiketler) ? materyal.etiketler.filter(Boolean) : [],
    ekleyen_id: (materyal.ekleyen_id || "").trim(),
    ekleyen_adi: (materyal.ekleyen_adi || "").trim(),
    ekleme_zamani: materyal.ekleme_zamani || null,
  };
}

function materyalAlanlariniAyir(satir) {
  const alanlar = [""];
  let kacis = false;
  for (const karakter of satir) {
    if (kacis) {
      alanlar[alanlar.length - 1] += karakter === "n" ? "\n" : karakter;
      kacis = false;
    } else if (karakter === "\\") {
      kacis = true;
    } else if (karakter === "|") {
      alanlar.push("");
    } else {
      alanlar[alanlar.length - 1] += karakter;
    }
  }
  if (kacis) {
    alanlar[alanlar.length - 1] += "\\";
  }
  return alanlar.map((alan) => alan.trim());
}

function materyalAlaniniYaz(deger) {
  return (deger || "").replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, "\\n");
}

function materyalMetniniParcala(metin) {
  return metin
    .split("\n")
    .map((satir) => satir.trim())
    .filter(Boolean)
    .map((satir) => {
      const [ad = "", tur = "", kaynak = "", etiketMetni = "", ...icerikParcalari] = materyalAlanlariniAyir(satir);
      const icerik = icerikParcalari.join(" | ");
      return materyalTemizle({ ad, tur, kaynak, icerik, etiketler: metniParcala(etiketMetni) });
    })
    .filter((materyal) => materyal.ad);
}

function materyalleriMetneCevir(materyaller) {
  return materyalleriAl({ materyaller })
    .map((materyal) =>
      [materyal.ad, materyal.tur, materyal.kaynak, (materyal.etiketler || []).join(", "), materyal.icerik]
        .map(materyalAlaniniYaz)
        .join(" | ")
        .replace(/(\s+\|\s*)+$/, "")
    )
    .join("\n");
}

function basliktanIstekVerisi(oge, materyaller = materyalleriAl(oge)) {
  return {
    ad: oge.ad || "",
    aciklama: oge.aciklama || "",
    fotograf_url: oge.fotograf_url || "",
    etiketler: Array.isArray(oge.etiketler) ? oge.etiketler : [],
    baglanti_basliklari: Array.isArray(oge.baglanti_basliklari) ? oge.baglanti_basliklari : [],
    materyaller: materyaller.map(materyalTemizle).filter((materyal) => materyal.ad),
  };
}

function kaynakUrlMi(kaynak) {
  return /^https?:\/\//i.test(kaynak || "");
}

function materyalEkleyenMetni(materyal) {
  const ekleyen = materyal.ekleyen_adi || "Bilinmeyen kullanıcı";
  const tarih = tarihYaz(materyal.ekleme_zamani);
  return tarih ? `${ekleyen} ekledi · ${tarih}` : `${ekleyen} ekledi`;
}

function satirlaraOnekEkle(metin, onek, yedek) {
  return (metin || yedek)
    .split("\n")
    .map((satir) => `${onek}${satir || "metin"}`)
    .join("\n");
}

function markdownIslemiHazirla(islem, secili, ekDeger = "") {
  const metin = secili || "metin";
  if (islem === "baslik1") {
    return { metin: satirlaraOnekEkle(secili, "# ", "Büyük başlık") };
  }
  if (islem === "baslik2") {
    return { metin: satirlaraOnekEkle(secili, "## ", "Alt başlık") };
  }
  if (islem === "kalin") {
    return { metin: `**${metin}**`, secimBaslangic: 2, secimBitis: 2 + metin.length };
  }
  if (islem === "italik") {
    return { metin: `*${metin}*`, secimBaslangic: 1, secimBitis: 1 + metin.length };
  }
  if (islem === "url") {
    const yazi = secili || "example.com";
    return { metin: `[${yazi}](https://example.com)`, secimBaslangic: yazi.length + 3, secimBitis: yazi.length + 22 };
  }
  if (islem === "fotograf") {
    const yazi = secili || "fotoğraf";
    const url = ekDeger || "https://example.com/fotograf.jpg";
    return { metin: `![${yazi}](${url})`, secimBaslangic: yazi.length + 4, secimBitis: yazi.length + 4 + url.length };
  }
  if (islem === "kod") {
    return { metin: `\`${metin}\``, secimBaslangic: 1, secimBitis: 1 + metin.length };
  }
  if (islem === "alinti") {
    return { metin: satirlaraOnekEkle(secili, "> ", "Alıntı") };
  }
  if (islem === "liste") {
    return { metin: satirlaraOnekEkle(secili, "- ", "madde") };
  }
  if (islem === "buyuk") {
    return { metin: (secili || "BÜYÜK METİN").toLocaleUpperCase("tr-TR") };
  }
  return { metin };
}

function markdownAlaninaUygula(alanRef, deger, degistir, islem, ekDeger = "") {
  const alan = alanRef.current;
  const mevcutDeger = alan?.value ?? deger;
  const baslangic = alan?.selectionStart ?? mevcutDeger.length;
  const bitis = alan?.selectionEnd ?? mevcutDeger.length;
  const once = mevcutDeger.slice(0, baslangic);
  const sonra = mevcutDeger.slice(bitis);
  const secili = mevcutDeger.slice(baslangic, bitis);
  const satirIslemi = ["baslik1", "baslik2", "fotograf", "alinti", "liste"].includes(islem);
  const ayrac = satirIslemi && once && !once.endsWith("\n") ? "\n" : "";
  const sonuc = markdownIslemiHazirla(islem, secili, ekDeger);
  const yeniMetin = `${once}${ayrac}${sonuc.metin}${sonra}`;
  const secimBaslangic = baslangic + ayrac.length + (sonuc.secimBaslangic ?? sonuc.metin.length);
  const secimBitis = baslangic + ayrac.length + (sonuc.secimBitis ?? sonuc.metin.length);
  degistir(yeniMetin);
  window.requestAnimationFrame(() => {
    alanRef.current?.focus();
    alanRef.current?.setSelectionRange(secimBaslangic, secimBitis);
  });
}

function markdownParcalariniCoz(metin, anahtar) {
  const parcalar = [];
  const desen = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let son = 0;
  let sira = 0;
  let eslesme = desen.exec(metin);
  while (eslesme) {
    if (eslesme.index > son) {
      parcalar.push(metin.slice(son, eslesme.index));
    }
    if (eslesme[1] !== undefined && eslesme[2]) {
      parcalar.push(
        <img src={eslesme[2]} alt={eslesme[1] || "Markdown fotoğrafı"} loading="lazy" key={`${anahtar}-fotograf-${sira}`} />
      );
    } else if (eslesme[3] && eslesme[4]) {
      parcalar.push(
        <a href={eslesme[4]} target="_blank" rel="noreferrer" key={`${anahtar}-baglanti-${sira}`}>
          {eslesme[3]}
        </a>
      );
    } else if (eslesme[5]) {
      parcalar.push(<strong key={`${anahtar}-kalin-${sira}`}>{eslesme[5]}</strong>);
    } else if (eslesme[6]) {
      parcalar.push(<em key={`${anahtar}-italik-${sira}`}>{eslesme[6]}</em>);
    } else if (eslesme[7]) {
      parcalar.push(<code key={`${anahtar}-kod-${sira}`}>{eslesme[7]}</code>);
    }
    son = eslesme.index + eslesme[0].length;
    sira += 1;
    eslesme = desen.exec(metin);
  }
  if (son < metin.length) {
    parcalar.push(metin.slice(son));
  }
  return parcalar;
}

function MarkdownMetni({ metin }) {
  if (!metin?.trim()) {
    return null;
  }

  return (
    <div className="markdown-metin">
      {metin.trim().split(/\n{2,}/).map((blok, blokSirasi) => {
        const satirlar = blok.split("\n").filter((satir) => satir.trim());
        if (satirlar.length === 1) {
          const satir = satirlar[0].trim();
          if (satir.startsWith("## ")) {
            return <h5 key={`${blokSirasi}-${blok.slice(0, 12)}`}>{markdownParcalariniCoz(satir.slice(3), `${blokSirasi}-baslik2`)}</h5>;
          }
          if (satir.startsWith("# ")) {
            return <h4 key={`${blokSirasi}-${blok.slice(0, 12)}`}>{markdownParcalariniCoz(satir.slice(2), `${blokSirasi}-baslik1`)}</h4>;
          }
        }
        if (satirlar.every((satir) => satir.trim().startsWith("> "))) {
          return (
            <blockquote key={`${blokSirasi}-${blok.slice(0, 12)}`}>
              {satirlar.map((satir, satirSirasi) => (
                <React.Fragment key={`${satirSirasi}-${satir.slice(0, 12)}`}>
                  {satirSirasi > 0 ? <br /> : null}
                  {markdownParcalariniCoz(satir.trim().slice(2), `${blokSirasi}-${satirSirasi}`)}
                </React.Fragment>
              ))}
            </blockquote>
          );
        }
        if (satirlar.every((satir) => satir.trim().startsWith("- "))) {
          return (
            <ul key={`${blokSirasi}-${blok.slice(0, 12)}`}>
              {satirlar.map((satir, satirSirasi) => (
                <li key={`${satirSirasi}-${satir.slice(0, 12)}`}>
                  {markdownParcalariniCoz(satir.trim().slice(2), `${blokSirasi}-${satirSirasi}`)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={`${blokSirasi}-${blok.slice(0, 12)}`}>
            {satirlar.map((satir, satirSirasi) => (
              <React.Fragment key={`${satirSirasi}-${satir.slice(0, 12)}`}>
                {satirSirasi > 0 ? <br /> : null}
                {markdownParcalariniCoz(satir, `${blokSirasi}-${satirSirasi}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function MarkdownAracCubugu({ ekle, fotografPaneliniAc, fotografYukleniyor }) {
  return (
    <div className="markdown-araclari">
      <button type="button" onClick={() => ekle("baslik1")} title="Büyük başlık" aria-label="Büyük başlık">
        <Heading1 size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => ekle("baslik2")} title="Alt başlık" aria-label="Alt başlık">
        <Heading2 size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => ekle("kalin")} title="Kalın metin" aria-label="Kalın metin">
        <Bold size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => ekle("italik")} title="İtalik metin" aria-label="İtalik metin">
        <Italic size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => ekle("url")} title="URL ekle" aria-label="URL ekle">
        <Link2 size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={fotografPaneliniAc ? fotografPaneliniAc : () => ekle("fotograf")}
        disabled={fotografYukleniyor}
        title="Fotoğraf ekle"
        aria-label="Fotoğraf ekle"
      >
        <Image size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => ekle("kod")} title="Kod" aria-label="Kod">
        <Code size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => ekle("alinti")} title="Alıntı" aria-label="Alıntı">
        <Quote size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => ekle("liste")} title="Liste" aria-label="Liste">
        <List size={16} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => ekle("buyuk")} title="Büyük harf" aria-label="Büyük harf">
        <Type size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function MarkdownEditoru({ etiket, deger, degistir, alanRef, satir = 5, fotografYukle, fotografYukleniyor }) {
  const alanId = useId();
  const dosyaRef = useRef(null);
  const [fotografPaneliAcik, fotografPaneliAcikAyarla] = useState(false);
  const [fotografBaglantisi, fotografBaglantisiAyarla] = useState("");

  function fotografBaglantisiEkle() {
    const ham = fotografBaglantisi.trim();
    if (!ham) {
      return;
    }
    const url = /^https?:\/\//i.test(ham) ? ham : `https://${ham}`;
    markdownAlaninaUygula(alanRef, deger, degistir, "fotograf", url);
    fotografBaglantisiAyarla("");
    fotografPaneliAcikAyarla(false);
  }

  async function fotografSec(olay) {
    const dosya = olay.target.files?.[0];
    if (!dosya || !fotografYukle) {
      olay.target.value = "";
      return;
    }
    const url = await fotografYukle(dosya);
    if (url) {
      markdownAlaninaUygula(alanRef, deger, degistir, "fotograf", url);
      fotografPaneliAcikAyarla(false);
    }
    olay.target.value = "";
  }

  return (
    <div className="markdown-editoru">
      <label htmlFor={alanId}>{etiket}</label>
      <MarkdownAracCubugu
        ekle={(islem) => markdownAlaninaUygula(alanRef, deger, degistir, islem)}
        fotografPaneliniAc={() => fotografPaneliAcikAyarla((acik) => !acik)}
        fotografYukleniyor={fotografYukleniyor}
      />
      {fotografPaneliAcik ? (
        <div className="markdown-fotograf-paneli">
          <label>
            Fotoğraf bağlantısı
            <input
              value={fotografBaglantisi}
              onChange={(olay) => fotografBaglantisiAyarla(olay.target.value)}
              onKeyDown={(olay) => {
                if (olay.key === "Enter") {
                  olay.preventDefault();
                  fotografBaglantisiEkle();
                }
              }}
            />
          </label>
          <button className="ikincil dugme" type="button" onClick={fotografBaglantisiEkle}>
            <Link2 size={16} aria-hidden="true" />
            Bağlantıyı ekle
          </button>
          {fotografYukle ? (
            <button className="ikincil dugme" type="button" onClick={() => dosyaRef.current?.click()} disabled={fotografYukleniyor}>
              <Image size={16} aria-hidden="true" />
              Dosya yükle
            </button>
          ) : null}
        </div>
      ) : null}
      {fotografYukle ? (
        <input
          ref={dosyaRef}
          className="gizli-dosya"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={fotografSec}
          disabled={fotografYukleniyor}
        />
      ) : null}
      <textarea
        id={alanId}
        ref={alanRef}
        value={deger}
        onChange={(olay) => degistir(olay.target.value)}
        rows={satir}
      />
    </div>
  );
}

function YanListe({ baslik, ikon, ogeler, bosMetin, tiklama }) {
  return (
    <section className="yan-liste" data-acilis>
      <div className="yan-liste-baslik">
        {ikon}
        <span>{baslik}</span>
      </div>
      {ogeler.length ? (
        <div className="yan-ogeler">
          {ogeler.map((oge) => (
            <button type="button" key={oge.id} onClick={() => tiklama?.(oge)}>
              <span>{oge.ad}</span>
              {oge.etiketler?.length ? <small>{oge.etiketler.slice(0, 2).join(", ")}</small> : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="yan-bos">{bosMetin}</p>
      )}
    </section>
  );
}

function KonuGorseli({ konu }) {
  return (
    <div className="konu-gorsel">
      {konu.fotograf_url ? (
        <img src={konu.fotograf_url} alt={konu.ad} loading="lazy" />
      ) : (
        <div className="konu-gorsel-bos">
          <Image size={30} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

function MateryalListesi({ materyaller }) {
  if (!materyaller.length) {
    return <p className="veri-bos">Henüz veri yok</p>;
  }

  return (
    <div className="veri-listesi">
      {materyaller.map((materyal, sira) => (
        <article className="veri-kaydi" key={`${materyal.kimlik || materyal.ad}-${sira}`}>
          <div className="veri-kaydi-baslik">
            <div>
              <strong>{materyal.ad}</strong>
              <small className="veri-ekleyen">
                <UserRound size={14} aria-hidden="true" />
                {materyalEkleyenMetni(materyal)}
              </small>
            </div>
            {materyal.tur ? <span>{materyal.tur}</span> : null}
          </div>
          {materyal.kaynak ? (
            kaynakUrlMi(materyal.kaynak) ? (
              <a href={materyal.kaynak} target="_blank" rel="noreferrer">
                <ExternalLink size={14} aria-hidden="true" />
                Kaynak
              </a>
            ) : (
              <small>{materyal.kaynak}</small>
            )
          ) : null}
          <MarkdownMetni metin={materyal.icerik} />
          {materyal.etiketler?.length ? (
            <div className="veri-etiketleri">
              {materyal.etiketler.map((etiket) => (
                <span key={etiket}>{etiket}</span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function KonuKarti({ oge, aktif, kayitli, goruntule, kaydet }) {
  const materyalSayisi = konuIcerigiDisindakiler(materyalleriAl(oge)).length;

  return (
    <article
      className={`baslik-karti ${aktif ? "secili" : ""}`}
      onClick={() => goruntule(oge)}
      data-acilis
      data-kaydirma-sahnesi
    >
      <KonuGorseli konu={oge} />
      <div className="kart-araclari">
        <button
          type="button"
          className={kayitli ? "ikon-dugme mini aktif" : "ikon-dugme mini"}
          onClick={(olay) => {
            olay.stopPropagation();
            kaydet(oge);
          }}
          title={kayitli ? "Kaydı kaldır" : "Kaydet"}
          aria-label={kayitli ? "Kaydı kaldır" : "Kaydet"}
        >
          <Bookmark size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ikon-dugme mini"
          onClick={(olay) => {
            olay.stopPropagation();
            goruntule(oge);
          }}
          title="Görüntüle"
          aria-label="Görüntüle"
        >
          <Eye size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="baslik-karti-govde">
        <h3>{oge.ad}</h3>
        <div className="konu-meta">
          <span>{oge.sahip_adi || "researchbox"}</span>
          <span className="giris-sayisi">
            <Eye size={14} aria-hidden="true" />
            {girisMetni(oge)}
          </span>
        </div>
        {oge.etiketler?.length ? (
          <div className="etiketler kart-etiketleri">
            {oge.etiketler.slice(0, 4).map((etiket) => (
              <span key={etiket}>{etiket}</span>
            ))}
          </div>
        ) : null}
        <span className="materyal-sayisi">{materyalSayisi} veri</span>
      </div>
    </article>
  );
}

function BaslikFormu({ baslik, baslikAyarla, duzenlenenBaslik, islem, kapat, gonder, fotografYukle, markdownFotografYukle }) {
  const konuIcerikRef = useRef(null);

  return (
    <form className="baslik-formu" onSubmit={gonder}>
      <div className="form-baslik-satiri">
        <div>
          <p className="ust-etiket">{duzenlenenBaslik ? "Düzenleme" : "Yeni konu"}</p>
          <h2>{duzenlenenBaslik ? duzenlenenBaslik.ad : "Konu formu"}</h2>
        </div>
        <button type="button" className="ikon-dugme mini" onClick={kapat} title="Formu kapat" aria-label="Formu kapat">
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      <label>
        Konu başlığı
        <input
          value={baslik.ad}
          onChange={(olay) => baslikAyarla({ ...baslik, ad: olay.target.value })}
          required
        />
      </label>
      <label>
        Fotoğraf yükle
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={fotografYukle}
          disabled={islem === "fotograf"}
          required={!baslik.fotograf_url}
        />
      </label>
      {baslik.fotograf_url ? (
        <div className="form-gorsel-onizleme">
          <img src={baslik.fotograf_url} alt="Yüklenen fotoğraf" />
          <button
            type="button"
            className="ikon-dugme mini"
            onClick={() => baslikAyarla({ ...baslik, fotograf_url: "" })}
            title="Fotoğrafı kaldır"
            aria-label="Fotoğrafı kaldır"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <label>
        Açıklama
        <textarea
          value={baslik.aciklama}
          onChange={(olay) => baslikAyarla({ ...baslik, aciklama: olay.target.value })}
          rows={4}
        />
      </label>
      <MarkdownEditoru
        etiket="Konu içeriği"
        deger={baslik.icerik_metni}
        degistir={(deger) => baslikAyarla({ ...baslik, icerik_metni: deger })}
        alanRef={konuIcerikRef}
        satir={8}
        fotografYukle={markdownFotografYukle}
        fotografYukleniyor={islem === "fotograf"}
      />
      <label>
        Tagler
        <input
          value={baslik.etiket_metni}
          onChange={(olay) => baslikAyarla({ ...baslik, etiket_metni: olay.target.value })}
        />
      </label>
      <label>
        Bağlantılı konular
        <input
          value={baslik.baglanti_metni}
          onChange={(olay) => baslikAyarla({ ...baslik, baglanti_metni: olay.target.value })}
        />
      </label>
      <label>
        Konu verileri
        <textarea
          value={baslik.materyal_metni}
          onChange={(olay) => baslikAyarla({ ...baslik, materyal_metni: olay.target.value })}
          rows={5}
        />
      </label>
      <button className="birincil dugme" type="submit" disabled={islem === "baslik" || islem === "fotograf"}>
        {duzenlenenBaslik ? <Pencil size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
        {islem === "fotograf" ? "Fotoğraf yükleniyor" : duzenlenenBaslik ? "Düzenleme gönder" : "Onaya gönder"}
      </button>
    </form>
  );
}

function onayTuruMetni(tur) {
  return tur === "duzenleme" ? "Düzenleme" : "Yeni başlık";
}

function AdminKonuKarti({ konu, islem, sil }) {
  const siliniyor = islem === `konu-sil-${konu.id}`;
  return (
    <article className="admin-konu-kaydi">
      <div>
        <strong>{konu.ad}</strong>
        <small>
          {konu.sahip_adi || "researchbox"} · {girisMetni(konu)}
        </small>
      </div>
      <button className="ikincil dugme tehlikeli" type="button" onClick={() => sil(konu.id)} disabled={Boolean(islem)}>
        <Trash2 size={17} aria-hidden="true" />
        {siliniyor ? "Siliniyor" : "Sil"}
      </button>
    </article>
  );
}

function OnayKarti({ onay, islem, onayla, reddet }) {
  const veri = onay.baslik_verisi || {};
  const etiketler = Array.isArray(veri.etiketler) ? veri.etiketler : [];
  const baglantilar = Array.isArray(veri.baglanti_basliklari) ? veri.baglanti_basliklari : [];
  const materyaller = materyalleriAl(veri);
  const onayIslemde = islem === `onayla-${onay.id}`;
  const retIslemde = islem === `reddet-${onay.id}`;

  return (
    <article className="onay-karti" data-acilis>
      <div className="onay-karti-ust">
        <div>
          <span className={onay.tur === "duzenleme" ? "onay-turu duzenleme" : "onay-turu"}>
            {onayTuruMetni(onay.tur)}
          </span>
          <h2>{veri.ad || "Başlıksız"}</h2>
          <p>
            {onay.kullanici_adi} · {tarihYaz(onay.olusturma_zamani)}
          </p>
        </div>
        <div className="onay-araclari">
          <button
            type="button"
            className="birincil dugme"
            onClick={() => onayla(onay.id)}
            disabled={Boolean(islem)}
          >
            <Check size={18} aria-hidden="true" />
            {onayIslemde ? "Onaylanıyor" : "Onayla"}
          </button>
          <button
            type="button"
            className="ikincil dugme tehlikeli"
            onClick={() => reddet(onay.id)}
            disabled={Boolean(islem)}
          >
            <X size={18} aria-hidden="true" />
            {retIslemde ? "Reddediliyor" : "Reddet"}
          </button>
        </div>
      </div>
      {veri.fotograf_url ? <img className="onay-gorsel" src={veri.fotograf_url} alt={veri.ad || "Onay görseli"} /> : null}
      {onay.baslik_id ? <small className="onay-hedef">Başlık ID: {onay.baslik_id}</small> : null}
      {veri.aciklama ? <p className="onay-aciklama">{veri.aciklama}</p> : null}
      {etiketler.length ? (
        <div className="etiketler">
          <Tags size={16} aria-hidden="true" />
          {etiketler.map((etiket) => (
            <span key={etiket}>{etiket}</span>
          ))}
        </div>
      ) : null}
      {baglantilar.length ? (
        <div className="baglantilar">
          <Link2 size={16} aria-hidden="true" />
          {baglantilar.map((baglanti) => (
            <span key={baglanti}>{baglanti}</span>
          ))}
        </div>
      ) : null}
      {materyaller.length ? <MateryalListesi materyaller={materyaller} /> : null}
    </article>
  );
}

function DuzenlemeKaydi({ onay }) {
  const veri = onay.baslik_verisi || {};
  return (
    <article className="duzenleme-kaydi">
      <div>
        <span className={onay.durum === "onaylandi" ? "durum onaylandi" : onay.durum === "reddedildi" ? "durum reddedildi" : "durum"}>
          {onay.durum}
        </span>
        <h3>{veri.ad || "Başlıksız düzenleme"}</h3>
      </div>
      <small>{tarihYaz(onay.olusturma_zamani)}</small>
    </article>
  );
}

function AdminSayfasi() {
  const [belirtec, belirtecAyarla] = useState(() => localStorage.getItem("researchbox_admin_belirtec") || "");
  const [admin, adminAyarla] = useState(null);
  const [giris, girisAyarla] = useState(adminBosGiris);
  const [onaylar, onaylarAyarla] = useState([]);
  const [adminBasliklar, adminBasliklarAyarla] = useState([]);
  const [hata, hataAyarla] = useState("");
  const [bilgi, bilgiAyarla] = useState("");
  const [islem, islemAyarla] = useState("");

  useEffect(() => {
    if (!belirtec) {
      adminAyarla(null);
      onaylarAyarla([]);
      adminBasliklarAyarla([]);
      return;
    }

    let iptal = false;

    async function adminiYukle() {
      try {
        const benVerisi = await apiIstegi("/ben", { belirtec });
        const [onayVerisi, baslikVerisi] = await Promise.all([
          apiIstegi("/admin/onaylar", { belirtec }),
          apiIstegi("/admin/basliklar", { belirtec }),
        ]);
        if (!iptal) {
          adminAyarla(benVerisi.kullanici);
          onaylarAyarla(onayVerisi.onaylar || []);
          adminBasliklarAyarla(baslikVerisi.basliklar || []);
          hataAyarla("");
        }
      } catch (adminHatasi) {
        localStorage.removeItem("researchbox_admin_belirtec");
        if (!iptal) {
          belirtecAyarla("");
          adminAyarla(null);
          onaylarAyarla([]);
          adminBasliklarAyarla([]);
          hataAyarla(adminHatasi.message);
        }
      }
    }

    adminiYukle();
    return () => {
      iptal = true;
    };
  }, [belirtec]);

  async function onaylariYukle(aktifBelirtec = belirtec) {
    const [onayVerisi, baslikVerisi] = await Promise.all([
      apiIstegi("/admin/onaylar", { belirtec: aktifBelirtec }),
      apiIstegi("/admin/basliklar", { belirtec: aktifBelirtec }),
    ]);
    onaylarAyarla(onayVerisi.onaylar || []);
    adminBasliklarAyarla(baslikVerisi.basliklar || []);
  }

  async function adminGirisYap(olay) {
    olay.preventDefault();
    islemAyarla("admin-giris");
    hataAyarla("");
    bilgiAyarla("");
    try {
      const veri = await apiIstegi("/giris", { yontem: "POST", govde: giris });
      const [onayVerisi, baslikVerisi] = await Promise.all([
        apiIstegi("/admin/onaylar", { belirtec: veri.belirtec }),
        apiIstegi("/admin/basliklar", { belirtec: veri.belirtec }),
      ]);
      localStorage.setItem("researchbox_admin_belirtec", veri.belirtec);
      belirtecAyarla(veri.belirtec);
      adminAyarla(veri.kullanici);
      onaylarAyarla(onayVerisi.onaylar || []);
      adminBasliklarAyarla(baslikVerisi.basliklar || []);
      girisAyarla(adminBosGiris);
    } catch (girisHatasi) {
      hataAyarla(girisHatasi.message);
    } finally {
      islemAyarla("");
    }
  }

  function adminCikisYap() {
    localStorage.removeItem("researchbox_admin_belirtec");
    belirtecAyarla("");
    adminAyarla(null);
    onaylarAyarla([]);
    adminBasliklarAyarla([]);
    bilgiAyarla("");
  }

  async function onayIsle(onayId, karar) {
    islemAyarla(`${karar}-${onayId}`);
    hataAyarla("");
    bilgiAyarla("");
    try {
      const cevap = await apiIstegi(`/admin/onaylar/${onayId}/${karar}`, { yontem: "POST", belirtec });
      onaylarAyarla((onceki) => onceki.filter((onay) => onay.id !== onayId));
      if (karar === "onayla" && cevap.baslik) {
        adminBasliklarAyarla((onceki) => baslikListeyeYerlestir(onceki, cevap.baslik));
      }
      bilgiAyarla(karar === "onayla" ? "Kayıt onaylandı" : "Kayıt reddedildi");
    } catch (onayHatasi) {
      hataAyarla(onayHatasi.message);
    } finally {
      islemAyarla("");
    }
  }

  async function adminBaslikSil(baslikId) {
    if (!window.confirm("Konu silinsin mi?")) {
      return;
    }
    islemAyarla(`konu-sil-${baslikId}`);
    hataAyarla("");
    bilgiAyarla("");
    try {
      await apiIstegi(`/admin/basliklar/${baslikId}`, { yontem: "DELETE", belirtec });
      adminBasliklarAyarla((onceki) => onceki.filter((baslik) => baslik.id !== baslikId));
      bilgiAyarla("Konu silindi");
    } catch (silmeHatasi) {
      hataAyarla(silmeHatasi.message);
    } finally {
      islemAyarla("");
    }
  }

  return (
    <main className="admin-sayfa">
      <header className="admin-ust animate__animated animate__fadeInDown">
        <div className="marka">
          <ShieldCheck size={24} aria-hidden="true" />
          <span>researchbox admin</span>
        </div>
        <div className="admin-ust-araclari">
          {admin ? (
            <button
              className="ikincil dugme"
              type="button"
              onClick={() => onaylariYukle().catch((onayHatasi) => hataAyarla(onayHatasi.message))}
              disabled={Boolean(islem)}
            >
              <RefreshCw size={18} aria-hidden="true" />
              Yenile
            </button>
          ) : null}
          <a className="ikincil dugme" href="/">
            <BookOpen size={18} aria-hidden="true" />
            Konular
          </a>
        </div>
      </header>

      {hata ? <div className="hata animate__animated animate__fadeIn">{hata}</div> : null}
      {bilgi ? <div className="bilgi animate__animated animate__fadeIn">{bilgi}</div> : null}

      {!admin ? (
        <section className="admin-giris-paneli animate__animated animate__fadeInUp">
          <form className="form" onSubmit={adminGirisYap}>
            <label>
              Admin kullanıcı adı
              <input
                value={giris.kimlik}
                onChange={(olay) => girisAyarla({ ...giris, kimlik: olay.target.value })}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Şifre
              <input
                value={giris.sifre}
                onChange={(olay) => girisAyarla({ ...giris, sifre: olay.target.value })}
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="birincil dugme" type="submit" disabled={islem === "admin-giris"}>
              <LogIn size={18} aria-hidden="true" />
              Giriş yap
            </button>
          </form>
        </section>
      ) : (
        <section className="admin-panel animate__animated animate__fadeInUp">
          <div className="admin-panel-baslik">
            <div>
              <p className="ust-etiket">Bekleyen</p>
              <h1>Onay kuyruğu</h1>
            </div>
            <div className="admin-kullanici">
              <span>{admin.kullanici_adi}</span>
              <button className="ikon-dugme mini" type="button" onClick={adminCikisYap} title="Çıkış" aria-label="Çıkış">
                <LogOut size={17} aria-hidden="true" />
              </button>
            </div>
          </div>

          {onaylar.length ? (
            <div className="admin-liste">
              {onaylar.map((onay) => (
                <OnayKarti
                  key={onay.id}
                  onay={onay}
                  islem={islem}
                  onayla={(onayId) => onayIsle(onayId, "onayla")}
                  reddet={(onayId) => onayIsle(onayId, "reddet")}
                />
              ))}
            </div>
          ) : (
            <div className="bos">
              <ShieldCheck size={28} aria-hidden="true" />
              <span>Bekleyen kayıt yok</span>
            </div>
          )}

          <div className="admin-bolum-baslik">
            <div>
              <p className="ust-etiket">Yayında</p>
              <h2>Konular</h2>
            </div>
            <span>{adminBasliklar.length}</span>
          </div>
          {adminBasliklar.length ? (
            <div className="admin-konu-listesi">
              {adminBasliklar.map((konu) => (
                <AdminKonuKarti key={konu.id} konu={konu} islem={islem} sil={adminBaslikSil} />
              ))}
            </div>
          ) : (
            <div className="bos">
              <BookOpen size={28} aria-hidden="true" />
              <span>Yayında konu yok</span>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function Uygulama() {
  const [yol, yolAyarla] = useState(window.location.pathname);
  const aramaSayfasi = yol === "/arama";
  const profilSayfasi = yol === "/profil";
  const yeniSayfasi = yol === "/yeni";
  const konuDetaySayfasi = yol.startsWith("/konular/");
  const konuDetayId = konuDetaySayfasi ? decodeURIComponent(yol.replace("/konular/", "").split("/")[0] || "") : "";
  const [belirtec, belirtecAyarla] = useState(() => localStorage.getItem("researchbox_belirtec") || "");
  const [kullanici, kullaniciAyarla] = useState(null);
  const [kayit, kayitAyarla] = useState(bosKayit);
  const [giris, girisAyarla] = useState(bosGiris);
  const [baslik, baslikAyarla] = useState(bosBaslik);
  const [basliklar, basliklarAyarla] = useState([]);
  const [sekme, sekmeAyarla] = useState("giris");
  const [hata, hataAyarla] = useState("");
  const [bilgi, bilgiAyarla] = useState("");
  const [islem, islemAyarla] = useState("");
  const [aramaMetni, aramaMetniAyarla] = useState("");
  const [seciliBaslik, seciliBaslikAyarla] = useState(null);
  const [duzenlenenBaslik, duzenlenenBaslikAyarla] = useState(null);
  const [sonGezilenler, sonGezilenlerAyarla] = useState([]);
  const [kaydedilenler, kaydedilenlerAyarla] = useState([]);
  const [formYuksekligi, formYuksekligiAyarla] = useState(214);
  const [veri, veriAyarla] = useState(bosVeri);
  const [profil, profilAyarla] = useState({ actigi_basliklar: [], duzenlemeler: [] });
  const [konuDetayYukleniyor, konuDetayYukleniyorAyarla] = useState(false);
  const girisFormRef = useRef(null);
  const kayitFormRef = useRef(null);
  const veriIcerikRef = useRef(null);

  const oturumAcik = Boolean(belirtec && kullanici);
  const filtrelenenBasliklar = useMemo(() => {
    const arama = aramaMetni.trim().toLocaleLowerCase("tr-TR");
    if (!arama) {
      return basliklar;
    }
    return basliklar.filter((oge) => aramaMetnineCevir(oge).includes(arama));
  }, [aramaMetni, basliklar]);
  const gorunenBasliklar = aramaSayfasi ? filtrelenenBasliklar : basliklar;
  const seciliKonuIcerigi = konuIceriginiBul(materyalleriAl(seciliBaslik));
  const seciliMateryaller = konuIcerigiDisindakiler(materyalleriAl(seciliBaslik));

  useEffect(() => {
    function yoluGuncelle() {
      yolAyarla(window.location.pathname);
    }

    window.addEventListener("popstate", yoluGuncelle);
    return () => window.removeEventListener("popstate", yoluGuncelle);
  }, []);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });
    let kare = 0;

    function ilerlet(zaman) {
      lenis.raf(zaman);
      kare = requestAnimationFrame(ilerlet);
    }

    kare = requestAnimationFrame(ilerlet);

    let kaydirmaDenetleyici;
    let iptal = false;

    async function araclariBaslat() {
      const [{ default: ScrollReveal }, ScrollMagicMod] = await Promise.all([
        import("scrollreveal"),
        import("scrollmagic"),
      ]);

      if (iptal) {
        return;
      }

      const goster = ScrollReveal({
        distance: "20px",
        duration: 680,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        opacity: 0,
        interval: 70,
        cleanup: true,
      });
      goster.reveal("[data-acilis]");

      const ScrollMagic = ScrollMagicMod.default || ScrollMagicMod;
      kaydirmaDenetleyici = new ScrollMagic.Controller();
      document.querySelectorAll("[data-kaydirma-sahnesi]").forEach((oge) => {
        new ScrollMagic.Scene({
          triggerElement: oge,
          triggerHook: 0.86,
          reverse: false,
        })
          .setClassToggle(oge, "goster")
          .addTo(kaydirmaDenetleyici);
      });
    }

    araclariBaslat();

    return () => {
      iptal = true;
      cancelAnimationFrame(kare);
      lenis.destroy();
      kaydirmaDenetleyici?.destroy(true);
    };
  }, []);

  useEffect(() => {
    const zamanlayici = window.setTimeout(() => {
      basliklariYukle(aramaSayfasi ? aramaMetni : "");
    }, 260);
    return () => window.clearTimeout(zamanlayici);
  }, [aramaMetni, aramaSayfasi, yol]);

  useEffect(() => {
    if (!konuDetaySayfasi) {
      seciliBaslikAyarla(null);
      konuDetayYukleniyorAyarla(false);
      return;
    }
    const bulunan = basliklar.find((baslikKaydi) => baslikKaydi.id === konuDetayId);
    if (bulunan) {
      seciliBaslikAyarla(bulunan);
    }
  }, [basliklar, konuDetayId, konuDetaySayfasi]);

  useEffect(() => {
    if (konuDetaySayfasi && konuDetayId) {
      baslikDetayYukle(konuDetayId);
    }
  }, [konuDetayId, konuDetaySayfasi]);

  useEffect(() => {
    function guncelVeriyiAl() {
      if (document.visibilityState === "hidden") {
        return;
      }
      basliklariYukle(aramaSayfasi ? aramaMetni : "");
      if (konuDetaySayfasi && konuDetayId) {
        baslikDetayYukle(konuDetayId, true);
      }
    }

    window.addEventListener("focus", guncelVeriyiAl);
    document.addEventListener("visibilitychange", guncelVeriyiAl);
    return () => {
      window.removeEventListener("focus", guncelVeriyiAl);
      document.removeEventListener("visibilitychange", guncelVeriyiAl);
    };
  }, [aramaMetni, aramaSayfasi, konuDetayId, konuDetaySayfasi]);

  useEffect(() => {
    function formuOlc() {
      const aktifForm = sekme === "giris" ? girisFormRef.current : kayitFormRef.current;
      if (aktifForm) {
        formYuksekligiAyarla(aktifForm.offsetHeight);
      }
    }

    formuOlc();
    window.addEventListener("resize", formuOlc);
    return () => window.removeEventListener("resize", formuOlc);
  }, [sekme]);

  useEffect(() => {
    if (!belirtec) {
      kullaniciAyarla(null);
      return;
    }

    let iptal = false;

    async function kullaniciyiYukle() {
      try {
        const veri = await apiIstegi("/ben", { belirtec });
        if (!iptal) {
          kullaniciAyarla(veri.kullanici);
        }
      } catch (yanlisOturum) {
        localStorage.removeItem("researchbox_belirtec");
        if (!iptal) {
          belirtecAyarla("");
          kullaniciAyarla(null);
          hataAyarla(yanlisOturum.message);
        }
      }
    }

    kullaniciyiYukle();
    return () => {
      iptal = true;
    };
  }, [belirtec]);

  useEffect(() => {
    if (!oturumAcik) {
      sonGezilenlerAyarla([]);
      kaydedilenlerAyarla([]);
      profilAyarla({ actigi_basliklar: [], duzenlemeler: [] });
      return;
    }
    kullaniciKonulariniYukle();
    if (profilSayfasi) {
      profilYukle();
    }
  }, [oturumAcik, kullanici?.id, belirtec, profilSayfasi]);

  function kullaniciKonulariniAyarla(veri) {
    sonGezilenlerAyarla(Array.isArray(veri.son_gezdigin) ? veri.son_gezdigin : []);
    kaydedilenlerAyarla(Array.isArray(veri.kaydedilen) ? veri.kaydedilen : []);
  }

  function sayfayaGit(yeniYol) {
    seciliBaslikAyarla(null);
    if (yeniYol !== "/yeni") {
      baslikAyarla(bosBaslik);
      duzenlenenBaslikAyarla(null);
    }
    if (window.location.pathname !== yeniYol) {
      window.history.pushState({}, "", yeniYol);
      yolAyarla(yeniYol);
    }
    hataAyarla("");
    bilgiAyarla("");
    window.scrollTo(0, 0);
  }

  async function kullaniciKonulariniYukle() {
    try {
      const veri = await apiIstegi("/ben/konular", { belirtec });
      kullaniciKonulariniAyarla(veri);
    } catch (konuHatasi) {
      hataAyarla(konuHatasi.message);
    }
  }

  async function profilYukle() {
    try {
      const veri = await apiIstegi("/ben/profil", { belirtec });
      profilAyarla({
        actigi_basliklar: veri.actigi_basliklar || [],
        duzenlemeler: veri.duzenlemeler || [],
      });
    } catch (profilHatasi) {
      hataAyarla(profilHatasi.message);
    }
  }

  async function basliklariYukle(arama = aramaSayfasi ? aramaMetni : "") {
    try {
      const sorgu = arama.trim() ? `?arama=${encodeURIComponent(arama.trim())}` : "";
      const veri = await apiIstegi(`/basliklar${sorgu}`);
      basliklarAyarla(basliklariSirala(veri.basliklar || []));
    } catch (yuklemeHatasi) {
      hataAyarla(yuklemeHatasi.message);
    }
  }

  async function baslikDetayYukle(baslikId, sessiz = false) {
    if (!baslikId) {
      return;
    }
    if (!sessiz) {
      konuDetayYukleniyorAyarla(true);
    }
    try {
      const veri = await apiIstegi(`/basliklar/${baslikId}`);
      if (veri.baslik) {
        baslikGuncelle(veri.baslik);
      }
    } catch (detayHatasi) {
      hataAyarla(detayHatasi.message);
    } finally {
      if (!sessiz) {
        konuDetayYukleniyorAyarla(false);
      }
    }
  }

  function oturumuKaydet(veri) {
    localStorage.setItem("researchbox_belirtec", veri.belirtec);
    belirtecAyarla(veri.belirtec);
    kullaniciAyarla(veri.kullanici);
    hataAyarla("");
    bilgiAyarla("");
  }

  async function kayitOl(olay) {
    olay.preventDefault();
    islemAyarla("kayit");
    hataAyarla("");
    try {
      const veri = await apiIstegi("/kayit", { yontem: "POST", govde: kayit });
      oturumuKaydet(veri);
      kayitAyarla(bosKayit);
    } catch (kayitHatasi) {
      hataAyarla(kayitHatasi.message);
    } finally {
      islemAyarla("");
    }
  }

  async function girisYap(olay) {
    olay.preventDefault();
    islemAyarla("giris");
    hataAyarla("");
    try {
      const veri = await apiIstegi("/giris", { yontem: "POST", govde: giris });
      oturumuKaydet(veri);
      girisAyarla(bosGiris);
    } catch (girisHatasi) {
      hataAyarla(girisHatasi.message);
    } finally {
      islemAyarla("");
    }
  }

  function cikisYap() {
    localStorage.removeItem("researchbox_belirtec");
    belirtecAyarla("");
    kullaniciAyarla(null);
    seciliBaslikAyarla(null);
    duzenlenenBaslikAyarla(null);
    baslikAyarla(bosBaslik);
    bilgiAyarla("");
    if (window.location.pathname === "/yeni") {
      sayfayaGit("/");
    }
  }

  function sonGezileneYaz(tamBaslik) {
    sonGezilenlerAyarla((onceki) => listeyeYerelEkle(onceki, tamBaslik));
    apiIstegi(`/ben/son-gezdigin/${tamBaslik.id}`, { yontem: "POST", belirtec })
      .then((veri) => {
        kullaniciKonulariniAyarla(veri);
        if (veri.baslik) {
          baslikGuncelle(veri.baslik);
        }
      })
      .catch((kayitHatasi) => hataAyarla(kayitHatasi.message));
  }

  function baslikGuncelle(guncelBaslik) {
    basliklarAyarla((onceki) => baslikListeyeYerlestir(onceki, guncelBaslik));
    seciliBaslikAyarla((onceki) => (onceki?.id === guncelBaslik.id ? { ...onceki, ...guncelBaslik } : onceki));
  }

  function baslikGoruntule(oge) {
    const tamBaslik = basliklar.find((baslikKaydi) => baslikKaydi.id === oge.id) || oge;
    seciliBaslikAyarla(tamBaslik);
    if (window.location.pathname !== `/konular/${tamBaslik.id}`) {
      window.history.pushState({}, "", `/konular/${tamBaslik.id}`);
      yolAyarla(`/konular/${tamBaslik.id}`);
    }
    hataAyarla("");
    bilgiAyarla("");
    window.scrollTo(0, 0);
    if (oturumAcik) {
      sonGezileneYaz(tamBaslik);
    }
  }

  function baslikKaydet(oge) {
    if (!oturumAcik) {
      hataAyarla("Kaydetmek için giriş yapmalısın");
      bilgiAyarla("");
      return;
    }

    if (kaydedilenler.some((kayitli) => kayitli.id === oge.id)) {
      kaydedilenlerAyarla((onceki) => listedenYerelCikar(onceki, oge.id));
      apiIstegi(`/ben/kaydedilen/${oge.id}`, { yontem: "DELETE", belirtec })
        .then(kullaniciKonulariniAyarla)
        .catch((kayitHatasi) => hataAyarla(kayitHatasi.message));
      return;
    }

    kaydedilenlerAyarla((onceki) => listeyeYerelEkle(onceki, oge));
    apiIstegi(`/ben/kaydedilen/${oge.id}`, { yontem: "POST", belirtec })
      .then(kullaniciKonulariniAyarla)
      .catch((kayitHatasi) => hataAyarla(kayitHatasi.message));
  }

  function yeniKonuFormunuAc() {
    if (!oturumAcik) {
      hataAyarla("Konu eklemek için giriş yapmalısın");
      bilgiAyarla("");
      return;
    }
    baslikAyarla(bosBaslik);
    duzenlenenBaslikAyarla(null);
    sayfayaGit("/yeni");
  }

  function baslikFormunuKapat() {
    baslikAyarla(bosBaslik);
    duzenlenenBaslikAyarla(null);
    sayfayaGit("/");
  }

  function baslikDuzenlemeyeBasla(oge) {
    if (!oturumAcik) {
      hataAyarla("Düzenlemek için giriş yapmalısın");
      bilgiAyarla("");
      return;
    }

    const tamBaslik = basliklar.find((baslikKaydi) => baslikKaydi.id === oge.id) || oge;
    duzenlenenBaslikAyarla(tamBaslik);
    baslikAyarla({
      ad: tamBaslik.ad || "",
      aciklama: tamBaslik.aciklama || "",
      fotograf_url: tamBaslik.fotograf_url || "",
      icerik_metni: konuIceriginiBul(tamBaslik.materyaller || [])?.icerik || "",
      etiket_metni: (tamBaslik.etiketler || []).join(", "),
      baglanti_metni: (tamBaslik.baglanti_basliklari || []).join(", "),
      materyal_metni: materyalleriMetneCevir(konuIcerigiDisindakiler(tamBaslik.materyaller || [])),
    });
    hataAyarla("");
    bilgiAyarla("");
    sayfayaGit("/yeni");
  }

  async function fotografDosyasiYukle(dosya) {
    if (!dosya) {
      return "";
    }
    if (!oturumAcik) {
      hataAyarla("Fotoğraf yüklemek için giriş yapmalısın");
      return "";
    }

    const formVerisi = new FormData();
    formVerisi.append("dosya", dosya);
    islemAyarla("fotograf");
    hataAyarla("");
    bilgiAyarla("");
    try {
      const sonuc = await apiIstegi("/fotograflar", {
        yontem: "POST",
        belirtec,
        formVerisi,
      });
      const fotografUrl = sonuc.fotograf_url || "";
      bilgiAyarla("Fotoğraf yüklendi");
      return fotografUrl;
    } catch (yuklemeHatasi) {
      hataAyarla(yuklemeHatasi.message);
      return "";
    } finally {
      islemAyarla("");
    }
  }

  async function fotografYukle(olay) {
    const dosya = olay.target.files?.[0];
    if (!dosya) {
      return;
    }
    try {
      const fotografUrl = await fotografDosyasiYukle(dosya);
      if (fotografUrl) {
        baslikAyarla((onceki) => ({ ...onceki, fotograf_url: fotografUrl }));
      }
    } finally {
      olay.target.value = "";
    }
  }

  async function baslikOlustur(olay) {
    olay.preventDefault();
    islemAyarla("baslik");
    hataAyarla("");
    bilgiAyarla("");
    try {
      const veri = await apiIstegi(duzenlenenBaslik ? `/basliklar/${duzenlenenBaslik.id}` : "/basliklar", {
        yontem: duzenlenenBaslik ? "PUT" : "POST",
        belirtec,
        govde: {
          ad: baslik.ad,
          aciklama: baslik.aciklama,
          fotograf_url: baslik.fotograf_url,
          etiketler: metniParcala(baslik.etiket_metni),
          baglanti_basliklari: metniParcala(baslik.baglanti_metni),
          materyaller: baslikMateryalleriniHazirla(baslik),
        },
      });
      bilgiAyarla(veri.mesaj || "İşlem onaya gönderildi");
      baslikFormunuKapat();
      if (profilSayfasi) {
        profilYukle();
      }
    } catch (baslikHatasi) {
      hataAyarla(baslikHatasi.message);
    } finally {
      islemAyarla("");
    }
  }

  async function veriEkle(olay) {
    olay.preventDefault();
    if (!oturumAcik) {
      hataAyarla("Veri eklemek için giriş yapmalısın");
      return;
    }
    if (!seciliBaslik) {
      hataAyarla("Önce konu seçmelisin");
      return;
    }

    const yeniVeri = materyalTemizle({
      ad: veri.ad,
      tur: veri.tur,
      kaynak: veri.kaynak,
      icerik: veri.icerik,
      etiketler: metniParcala(veri.etiket_metni),
    });
    if (!yeniVeri.ad) {
      hataAyarla("Veri adı boş olamaz");
      return;
    }

    islemAyarla("veri");
    hataAyarla("");
    bilgiAyarla("");
    try {
      await apiIstegi(`/basliklar/${seciliBaslik.id}`, {
        yontem: "PUT",
        belirtec,
        govde: basliktanIstekVerisi(seciliBaslik, [...materyalleriAl(seciliBaslik), yeniVeri]),
      });
      veriAyarla(bosVeri);
      bilgiAyarla("Veri onaya gönderildi");
    } catch (veriHatasi) {
      hataAyarla(veriHatasi.message);
    } finally {
      islemAyarla("");
    }
  }

  function kayitliMi(id) {
    return kaydedilenler.some((oge) => oge.id === id);
  }

  return (
    <main className="sayfa">
      <aside className="kenar animate__animated animate__fadeInLeft">
        <div className="marka" data-acilis>
          <BookOpen size={24} aria-hidden="true" />
          <span>researchbox</span>
        </div>

        <nav className="kenar-nav" data-acilis>
          <button type="button" className={!aramaSayfasi && !profilSayfasi && !yeniSayfasi && !konuDetaySayfasi ? "aktif" : ""} onClick={() => sayfayaGit("/")}>
            <BookOpen size={17} aria-hidden="true" />
            Konular
          </button>
          <button type="button" className={yeniSayfasi ? "aktif" : ""} onClick={yeniKonuFormunuAc}>
            <Plus size={17} aria-hidden="true" />
            Yeni konu
          </button>
          <button type="button" className={aramaSayfasi ? "aktif" : ""} onClick={() => sayfayaGit("/arama")}>
            <Search size={17} aria-hidden="true" />
            Arama
          </button>
          <button type="button" className={profilSayfasi ? "aktif" : ""} onClick={() => sayfayaGit("/profil")}>
            <UserPlus size={17} aria-hidden="true" />
            Profil
          </button>
        </nav>

        {oturumAcik ? (
          <section className="oturum">
            <div className="kullanici-kutusu" data-acilis>
              <span>{kullanici.kullanici_adi}</span>
              <small>{kullanici.email}</small>
            </div>
            <YanListe
              baslik="Son gezdiğin"
              ikon={<Clock3 size={17} aria-hidden="true" />}
              ogeler={sonGezilenler}
              bosMetin="Henüz konu açmadın"
              tiklama={baslikGoruntule}
            />
            <YanListe
              baslik="Kaydettiklerin"
              ikon={<Bookmark size={17} aria-hidden="true" />}
              ogeler={kaydedilenler}
              bosMetin="Kaydedilmiş konu yok"
              tiklama={baslikGoruntule}
            />
            <button className="ikincil dugme" type="button" onClick={cikisYap} data-acilis>
              <LogOut size={18} aria-hidden="true" />
              Çıkış
            </button>
          </section>
        ) : (
          <section className="oturum">
            <div className="sekme" data-acilis>
              <button type="button" className={sekme === "giris" ? "aktif" : ""} onClick={() => sekmeAyarla("giris")}>
                <LogIn size={17} aria-hidden="true" />
                Giriş
              </button>
              <button type="button" className={sekme === "kayit" ? "aktif" : ""} onClick={() => sekmeAyarla("kayit")}>
                <UserPlus size={17} aria-hidden="true" />
                Kayıt
              </button>
            </div>

            <div className="form-kaydirma" style={{ height: formYuksekligi }} data-acilis>
              <div className={sekme === "kayit" ? "form-ray kayit-goster" : "form-ray"}>
                <form ref={girisFormRef} className="form form-panel" onSubmit={girisYap} aria-hidden={sekme !== "giris"}>
                  <label>
                    Kullanıcı adı veya email
                    <input
                      value={giris.kimlik}
                      onChange={(olay) => girisAyarla({ ...giris, kimlik: olay.target.value })}
                      autoComplete="username"
                      disabled={sekme !== "giris"}
                      required
                    />
                  </label>
                  <label>
                    Şifre
                    <input
                      value={giris.sifre}
                      onChange={(olay) => girisAyarla({ ...giris, sifre: olay.target.value })}
                      type="password"
                      autoComplete="current-password"
                      disabled={sekme !== "giris"}
                      required
                    />
                  </label>
                  <button className="birincil dugme" type="submit" disabled={sekme !== "giris" || islem === "giris"}>
                    <LogIn size={18} aria-hidden="true" />
                    Giriş yap
                  </button>
                </form>

                <form ref={kayitFormRef} className="form form-panel" onSubmit={kayitOl} aria-hidden={sekme !== "kayit"}>
                  <label>
                    Kullanıcı adı
                    <input
                      value={kayit.kullanici_adi}
                      onChange={(olay) => kayitAyarla({ ...kayit, kullanici_adi: olay.target.value })}
                      autoComplete="username"
                      disabled={sekme !== "kayit"}
                      required
                    />
                  </label>
                  <label>
                    Email
                    <input
                      value={kayit.email}
                      onChange={(olay) => kayitAyarla({ ...kayit, email: olay.target.value })}
                      type="email"
                      autoComplete="email"
                      disabled={sekme !== "kayit"}
                      required
                    />
                  </label>
                  <label>
                    Şifre
                    <input
                      value={kayit.sifre}
                      onChange={(olay) => kayitAyarla({ ...kayit, sifre: olay.target.value })}
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      disabled={sekme !== "kayit"}
                      required
                    />
                  </label>
                  <button className="birincil dugme" type="submit" disabled={sekme !== "kayit" || islem === "kayit"}>
                    <UserPlus size={18} aria-hidden="true" />
                    Kayıt ol
                  </button>
                </form>
              </div>
            </div>
          </section>
        )}
      </aside>

      <section className="icerik">
        <header className="ust animate__animated animate__fadeInDown" data-acilis>
          <div>
            <p className="ust-etiket">Researchbox</p>
            <h1>{konuDetaySayfasi ? seciliBaslik?.ad || "Konu" : yeniSayfasi ? (duzenlenenBaslik ? "Konu düzenle" : "Yeni konu") : profilSayfasi ? "Profil" : aramaSayfasi ? "Arama" : "Konular"}</h1>
          </div>
          <div className="ust-araclari">
            <button className="ikon-dugme" type="button" onClick={() => basliklariYukle(aramaSayfasi ? aramaMetni : "")} title="Yenile" aria-label="Yenile">
              <RefreshCw size={20} aria-hidden="true" />
            </button>
            {!aramaSayfasi ? (
              <button className="ikon-dugme" type="button" onClick={() => sayfayaGit("/arama")} title="Arama" aria-label="Arama">
                <Search size={20} aria-hidden="true" />
              </button>
            ) : (
              <button className="ikon-dugme" type="button" onClick={() => sayfayaGit("/")} title="Konular" aria-label="Konular">
                <BookOpen size={20} aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        {aramaSayfasi ? (
          <section className="arama-seridi" data-acilis>
            <div className="arama-kutusu">
              <Search size={19} aria-hidden="true" />
              <input
                value={aramaMetni}
                onChange={(olay) => aramaMetniAyarla(olay.target.value)}
                aria-label="Konu ara"
              />
              {aramaMetni ? (
                <button type="button" onClick={() => aramaMetniAyarla("")} title="Aramayı temizle" aria-label="Aramayı temizle">
                  <X size={17} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <span className="arama-sayac">{gorunenBasliklar.length} sonuç</span>
          </section>
        ) : null}

        {hata ? <div className="hata animate__animated animate__fadeIn">{hata}</div> : null}
        {bilgi ? <div className="bilgi animate__animated animate__fadeIn">{bilgi}</div> : null}

        {yeniSayfasi ? (
          <section className="konu-form-sayfasi" data-acilis>
            {oturumAcik ? (
              <div className="konu-form-paneli animate__animated animate__fadeInUp">
                <BaslikFormu
                  baslik={baslik}
                  baslikAyarla={baslikAyarla}
                  duzenlenenBaslik={duzenlenenBaslik}
                  islem={islem}
                  kapat={baslikFormunuKapat}
                  gonder={baslikOlustur}
                  fotografYukle={fotografYukle}
                  markdownFotografYukle={fotografDosyasiYukle}
                />
              </div>
            ) : (
              <div className="kilitli">
                <LockKeyhole size={28} aria-hidden="true" />
                <h2>Konu açmak için oturum gerekli</h2>
              </div>
            )}
          </section>
        ) : profilSayfasi ? (
          <section className="profil-panel" data-acilis>
            {oturumAcik ? (
              <>
                <div className="profil-ozet">
                  <div>
                    <p className="ust-etiket">Hesap</p>
                    <h2>{kullanici.kullanici_adi}</h2>
                    <small>{kullanici.email}</small>
                  </div>
                  <div className="profil-sayaclar">
                    <span>{profil.actigi_basliklar.length} konu</span>
                    <span>{profil.duzenlemeler.length} düzenleme</span>
                  </div>
                </div>
                <div className="liste-baslik">
                  <div>
                    <p className="ust-etiket">Açtığın</p>
                    <h2>Konu başlıkları</h2>
                  </div>
                </div>
                {profil.actigi_basliklar.length ? (
                  <div className="basliklar">
                    {profil.actigi_basliklar.map((oge) => (
                      <KonuKarti
                        key={oge.id}
                        oge={oge}
                        aktif={seciliBaslik?.id === oge.id}
                        kayitli={kayitliMi(oge.id)}
                        goruntule={baslikGoruntule}
                        kaydet={baslikKaydet}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bos">
                    <BookOpen size={26} aria-hidden="true" />
                    <span>Onaylanmış konu yok</span>
                  </div>
                )}
                <div className="liste-baslik profil-alt-baslik">
                  <div>
                    <p className="ust-etiket">Gönderdiğin</p>
                    <h2>Düzenlemeler</h2>
                  </div>
                </div>
                {profil.duzenlemeler.length ? (
                  <div className="duzenleme-listesi">
                    {profil.duzenlemeler.map((onay) => (
                      <DuzenlemeKaydi key={onay.id} onay={onay} />
                    ))}
                  </div>
                ) : (
                  <div className="bos">
                    <Pencil size={26} aria-hidden="true" />
                    <span>Düzenleme kaydı yok</span>
                  </div>
                )}
              </>
            ) : (
              <div className="kilitli">
                <LockKeyhole size={28} aria-hidden="true" />
                <h2>Profil için oturum gerekli</h2>
              </div>
            )}
          </section>
        ) : (
          <div className="ana-duzen">
            <section className="liste">
              {!konuDetaySayfasi ? (
                <div className="liste-baslik" data-acilis>
                  <div>
                    <p className="ust-etiket">{aramaSayfasi ? "Arama" : "Ana sayfa"}</p>
                    <h2>{aramaSayfasi ? "Arama sonuçları" : "Tüm konular"}</h2>
                  </div>
                  <span>{gorunenBasliklar.length}</span>
                </div>
              ) : null}

              {konuDetaySayfasi && seciliBaslik ? (
                <section className="secili-detay" data-acilis data-kaydirma-sahnesi>
                  <div className="secili-detay-gorsel">
                    <KonuGorseli konu={seciliBaslik} />
                  </div>
                  <div className="secili-detay-icerik">
                    <div className="secili-konu">
                      <div>
                        <h2>{seciliBaslik.ad}</h2>
                        <span className="secili-sayac">
                          <Eye size={15} aria-hidden="true" />
                          {girisMetni(seciliBaslik)}
                        </span>
                      </div>
                      <div className="secili-araclari">
                        <button type="button" className="ikincil dugme" onClick={() => sayfayaGit("/")}>
                          <BookOpen size={18} aria-hidden="true" />
                          Konular
                        </button>
                        <button type="button" className="ikincil dugme" onClick={() => baslikDuzenlemeyeBasla(seciliBaslik)}>
                          <Pencil size={18} aria-hidden="true" />
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className={kayitliMi(seciliBaslik.id) ? "ikincil dugme aktif" : "ikincil dugme"}
                          onClick={() => baslikKaydet(seciliBaslik)}
                        >
                          <Bookmark size={18} aria-hidden="true" />
                          {kayitliMi(seciliBaslik.id) ? "Kaydedildi" : "Kaydet"}
                        </button>
                      </div>
                    </div>
                    {seciliBaslik.aciklama ? <p className="secili-aciklama">{seciliBaslik.aciklama}</p> : null}
                    {seciliKonuIcerigi?.icerik ? (
                      <div className="konu-ana-icerik">
                        <MarkdownMetni metin={seciliKonuIcerigi.icerik} />
                      </div>
                    ) : null}
                    {seciliBaslik.etiketler?.length ? (
                      <div className="etiketler">
                        <Tags size={16} aria-hidden="true" />
                        {seciliBaslik.etiketler.map((etiket) => (
                          <span key={etiket}>{etiket}</span>
                        ))}
                      </div>
                    ) : null}
                    {seciliBaslik.baglanti_basliklari?.length ? (
                      <div className="baglantilar">
                        <Link2 size={16} aria-hidden="true" />
                        {seciliBaslik.baglanti_basliklari.map((baglanti) => (
                          <span key={baglanti}>{baglanti}</span>
                        ))}
                      </div>
                    ) : null}
                    <section className="forum-bolumu">
                      <div className="forum-baslik">
                        <div>
                          <p className="ust-etiket">Forum</p>
                          <h2>Konu verileri</h2>
                        </div>
                        <span>{seciliMateryaller.length}</span>
                      </div>
                      <MateryalListesi materyaller={seciliMateryaller} />
                      {oturumAcik ? (
                        <form className="veri-formu" onSubmit={veriEkle}>
                          <div className="form-baslik-satiri">
                            <div>
                              <p className="ust-etiket">Yeni veri</p>
                              <h2>Konuya ekle</h2>
                            </div>
                            <FilePlus size={22} aria-hidden="true" />
                          </div>
                          <label>
                            Veri adı
                            <input value={veri.ad} onChange={(olay) => veriAyarla({ ...veri, ad: olay.target.value })} required />
                          </label>
                          <div className="form-ikili">
                            <label>
                              Tür
                              <input value={veri.tur} onChange={(olay) => veriAyarla({ ...veri, tur: olay.target.value })} />
                            </label>
                            <label>
                              Kaynak
                              <input value={veri.kaynak} onChange={(olay) => veriAyarla({ ...veri, kaynak: olay.target.value })} />
                            </label>
                          </div>
                          <label>
                            Veri tagleri
                            <input value={veri.etiket_metni} onChange={(olay) => veriAyarla({ ...veri, etiket_metni: olay.target.value })} />
                          </label>
                          <MarkdownEditoru
                            etiket="İçerik"
                            deger={veri.icerik}
                            degistir={(deger) => veriAyarla({ ...veri, icerik: deger })}
                            alanRef={veriIcerikRef}
                            satir={5}
                            fotografYukle={fotografDosyasiYukle}
                            fotografYukleniyor={islem === "fotograf"}
                          />
                          <button className="birincil dugme" type="submit" disabled={islem === "veri"}>
                            <FilePlus size={18} aria-hidden="true" />
                            Veriyi onaya gönder
                          </button>
                        </form>
                      ) : null}
                    </section>
                  </div>
                </section>
              ) : null}

              {!konuDetaySayfasi && gorunenBasliklar.length ? (
                <div className="basliklar">
                  {gorunenBasliklar.map((oge) => (
                    <KonuKarti
                      key={oge.id}
                      oge={oge}
                      aktif={seciliBaslik?.id === oge.id}
                      kayitli={kayitliMi(oge.id)}
                      goruntule={baslikGoruntule}
                      kaydet={baslikKaydet}
                    />
                  ))}
                </div>
              ) : !konuDetaySayfasi ? (
                <div className="bos" data-acilis>
                  <BookOpen size={26} aria-hidden="true" />
                  <span>{aramaSayfasi && aramaMetni ? "Sonuç bulunamadı" : "Henüz konu yok"}</span>
                </div>
              ) : konuDetayYukleniyor ? (
                <div className="bos" data-acilis>
                  <BookOpen size={26} aria-hidden="true" />
                  <span>Konu yükleniyor</span>
                </div>
              ) : !seciliBaslik ? (
                <div className="bos" data-acilis>
                  <BookOpen size={26} aria-hidden="true" />
                  <span>Konu bulunamadı</span>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </section>

      {!yeniSayfasi ? (
        <button className="sag-arti-dugme" type="button" onClick={yeniKonuFormunuAc} title="Konu ekle" aria-label="Konu ekle">
          <Plus size={30} aria-hidden="true" />
        </button>
      ) : null}
    </main>
  );
}

const adminSayfasi = window.location.pathname === "/admin";

createRoot(document.getElementById("kok")).render(adminSayfasi ? <AdminSayfasi /> : <Uygulama />);
