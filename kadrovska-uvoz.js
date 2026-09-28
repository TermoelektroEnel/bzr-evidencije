/* ==========================================================================
   kadrovska-uvoz.js — čitanje SAMO ličnih podataka (JMBG, datum rođenja, ime
   oca) iz kadrovskih DBF fajlova (Clipper/dBase III), radi popunjavanja
   "Uputa za periodični lekarski pregled".

   Namerno sužena verzija ideje koju je predložio Adamov Claude (kadrovska.ts
   iz paketa "Uvoz iz kadrovske") -- čita SAMO DLD000.DBF iz foldera DBF,
   PPN_dbf i PPP_dbf, i SAMO četiri polja: matični broj, JMBG, datum rođenja
   i ime oca. NE čita se Common/šifarnici (nisu potrebni), i NE čita se
   adresa, poštanski broj, opština, broj lične karte, tekući račun ni pol --
   BZR aplikaciji ti podaci nisu potrebni ni za jedan obrazac, pa se ni ne
   preuzimaju (manje kopija ličnih podataka = manje mesta gde mogu da isprocure).

   Radi isključivo u browseru (File System Access API) -- nema build koraka,
   nema TypeScript-a, nema zavisnosti. Fajlovi kadrovske se čitaju direktno
   kod korisnika i nikad ne napuštaju browser dok se ne potvrdi upis.
   ========================================================================== */

// ---- 1. Kodna strana (YUSCII / JUS I.B1.002) -------------------------------

const YUSCII = {
  '[': 'Š', '\\': 'Đ', ']': 'Ć', '^': 'Č', '@': 'Ž',
  '{': 'š', '|': 'đ', '}': 'ć', '~': 'č', '`': 'ž',
};

// Prevodi YUSCII u naša slova. Zamka: u šifarnicima/imenima staroga programa
// malo slovo sa kvačicom je ponekad ukucano znakom za VELIKO (npr. "]" i za
// Ć i za ć) -- zato se veliko slovo koje stoji odmah iza malog spušta u malo.
// Imena pisana verzalom (SVA VELIKA SLOVA) ostaju nedirnuta.
function yu(s) {
  let out = '';
  for (const z of s) {
    const p = YUSCII[z];
    if (!p) { out += z; continue; }
    const pre = out.slice(-1);
    const posleMalog = pre && pre === pre.toLocaleLowerCase('sr-Latn-RS') && pre !== pre.toLocaleUpperCase('sr-Latn-RS');
    out += posleMalog ? p.toLocaleLowerCase('sr-Latn-RS') : p;
  }
  return out;
}

// ---- 2. Čitanje dBase III tabele -------------------------------------------

// Vraća { polja, zapisi }. Obrisani zapisi (Clipper ih označi zvezdicom na
// prvom bajtu, ne uklanja ih) imaju zapis._obrisan === true.
function citajDbf(bafer) {
  const b = new Uint8Array(bafer);
  const dv = new DataView(bafer);
  if (b.length < 32) throw new Error('Fajl je prekratak da bi bio dBase tabela.');

  const broj = dv.getUint32(4, true);
  const duzZaglavlja = dv.getUint16(8, true);
  const duzZapisa = dv.getUint16(10, true);

  const polja = [];
  let i = 32;
  while (i < b.length && b[i] !== 0x0d) {
    let ime = '';
    for (let j = 0; j < 11 && b[i + j] !== 0; j++) ime += String.fromCharCode(b[i + j]);
    polja.push({ ime, tip: String.fromCharCode(b[i + 11]), duzina: b[i + 16] });
    i += 32;
  }
  if (!polja.length) throw new Error('Tabela nema nijedno polje -- verovatno nije dBase fajl.');

  const zapisi = [];
  for (let r = 0; r < broj; r++) {
    const p = duzZaglavlja + r * duzZapisa;
    if (p + duzZapisa > b.length) break; // odsečen fajl -- staje se, ne puca
    const zapis = { _obrisan: b[p] === 0x2a };
    let o = p + 1;
    for (const f of polja) {
      let v = '';
      for (let j = 0; j < f.duzina; j++) v += String.fromCharCode(b[o + j]);
      o += f.duzina;
      zapis[f.ime] = f.tip === 'C' ? yu(v).trim() : v.trim();
    }
    zapisi.push(zapis);
  }
  return { polja, zapisi };
}

// ---- 3. Pretvaranje vrednosti ----------------------------------------------

// Datum u tabeli stoji kao GGGGMMDD.
function datumIso(v) {
  const s = (v || '').trim();
  if (!/^\d{8}$/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function prazno(v) {
  const s = (v || '').trim();
  return s || null;
}

// JMBG je u tabeli brojčano polje, pa vodeća nula otpada -- dopunjuje se nazad.
function jmbgIspravljen(v) {
  const s = (v || '').trim().replace(/\D/g, '');
  if (!s) return null;
  return s.length < 13 ? s.padStart(13, '0') : s;
}

// ---- 4. Čitanje foldera u browseru (File System Access API) ---------------

async function nadjiFolder(koren, ime) {
  const trazeno = ime.toLowerCase();
  for await (const [naziv, unos] of koren.entries()) {
    if (unos.kind === 'directory' && naziv.toLowerCase() === trazeno) return unos;
  }
  return null;
}

async function nadjiFajl(folder, ime) {
  const trazeno = ime.toLowerCase();
  for await (const [naziv, unos] of folder.entries()) {
    if (unos.kind === 'file' && naziv.toLowerCase() === trazeno) return unos;
  }
  return null;
}

function citacIzFoldera(koren) {
  const kes = new Map();
  return {
    async tabela(folder, fajl) {
      if (!kes.has(folder)) kes.set(folder, await nadjiFolder(koren, folder));
      const f = kes.get(folder);
      if (!f) return null;
      const fh = await nadjiFajl(f, fajl);
      if (!fh) return null;
      const file = await fh.getFile();
      return await file.arrayBuffer();
    },
  };
}

// Otvara birač foldera (Chrome/Edge). Baca razumljivu grešku ako pregledač
// ne podržava File System Access API.
async function izaberiFolderKadrovske() {
  if (!window.showDirectoryPicker) {
    throw new Error('Ovaj pregledač ne ume da otvori folder direktno. Koristi Chrome ili Edge.');
  }
  const koren = await window.showDirectoryPicker({ mode: 'read' });
  return citacIzFoldera(koren);
}

// ---- 5. Čitanje ličnih podataka (SAMO mat_br, JMBG, datum rođenja, ime oca) -

const KADROVSKA_IZVORI = [
  { folder: 'DBF', opis: 'zaposleni' },
  { folder: 'PPN_dbf', opis: 'privremeni i povremeni' },
  { folder: 'PPP_dbf', opis: 'penzioneri' },
];

// Vraća { podaci: Map(mat_br -> {prezime_ime, jmbg, datum_rodjenja, ime_oca}),
//         poIzvoru: [...], upozorenja: [...] }
// Uzima SVE zapise (ne samo aktivne) -- ako je neko u međuvremenu otišao,
// njegovi lični podaci se svejedno mogu iskoristiti za uput izdat dok je
// još radio; BZR aplikacija sama odlučuje kome prikazuje dugme za uput
// (samo zaposlenima sa povećanim rizikom iz svoje žive evidencije).
async function procitajLicnePodatkeIzKadrovske(citac) {
  const podaci = new Map();
  const poIzvoru = [];
  const upozorenja = [];

  for (const izvor of KADROVSKA_IZVORI) {
    const bafer = await citac.tabela(izvor.folder, 'DLD000.DBF');
    if (!bafer) {
      upozorenja.push(`Nema ${izvor.folder}/DLD000.DBF (${izvor.opis}) -- preskačem.`);
      continue;
    }
    const { zapisi } = citajDbf(bafer);
    let ucitano = 0;
    for (const z of zapisi) {
      if (z._obrisan) continue;
      const mat = (z.R00009 || '').trim();
      if (!mat) continue;
      podaci.set(mat, {
        prezime_ime: (z.R00100 || '').trim().replace(/\s{2,}/g, ' '),
        jmbg: jmbgIspravljen(z.R00109 || ''),
        datum_rodjenja: datumIso(z.R00201 || ''),
        ime_oca: prazno(z.R00101 || ''),
      });
      ucitano++;
    }
    poIzvoru.push({ opis: izvor.opis, ucitano });
  }

  if (!podaci.size && !upozorenja.length) {
    upozorenja.push('Nije pronađen nijedan zapis. Proveri da je izabran nadređeni folder (onaj u kome stoje DBF, PPN_dbf, PPP_dbf i Common).');
  }

  return { podaci, poIzvoru, upozorenja };
}

window.KadrovskaUvoz = { izaberiFolderKadrovske, procitajLicnePodatkeIzKadrovske };
