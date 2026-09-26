// BZR Evidencije — glavna logika aplikacije
// Sve BZR tabele/view-ovi žive u Postgres šemi "bzr" (ne "public"),
// zato se svuda koristi supabaseClient.schema('bzr').from(...)

let zaposleniCache = [];
let trenutniZaposleni = null;

const els = {
  loginView: document.getElementById('login-view'),
  portalNav: document.getElementById('portal-nav'),
  navTabs: document.querySelectorAll('.nav-tab'),
  modulZaposleni: document.getElementById('modul-zaposleni'),
  modulOprema: document.getElementById('modul-oprema'),
  modulPovrede: document.getElementById('modul-povrede'),
  zaposleniView: document.getElementById('zaposleni-view'),
  detailView: document.getElementById('detail-view'),
  obrazac1Btn: document.getElementById('obrazac1-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  loginBtn: document.getElementById('login-btn'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginError: document.getElementById('login-error'),
  filterMatbr: document.getElementById('filter-matbr'),
  filterIme: document.getElementById('filter-ime'),
  filterRadnoMesto: document.getElementById('filter-radno-mesto'),
  filterRadnaJedinica: document.getElementById('filter-radna-jedinica'),
  filterRizik: document.getElementById('filter-rizik'),
  filterSemafor: document.getElementById('filter-semafor'),
  filterStatus: document.getElementById('filter-status'),
  zaposleniTbody: document.getElementById('zaposleni-tbody'),
  zaposleniInfo: document.getElementById('zaposleni-info'),
  backToList: document.getElementById('back-to-list'),
  detailIme: document.getElementById('detail-ime'),
  detailMeta: document.getElementById('detail-meta'),
  pregrediList: document.getElementById('pregledi-list'),
  noviPregledForm: document.getElementById('novi-pregled-form'),
  pregledError: document.getElementById('pregled-error'),
  folderIzvestaji: document.getElementById('folder-izvestaji'),
  folderObrazac6: document.getElementById('folder-obrazac6'),
  izvestajBrowseBtn: document.getElementById('izvestaj-browse-btn'),
  izvestajFile: document.getElementById('izvestaj-file'),
  izvestajFilename: document.getElementById('izvestaj-filename'),
  izvestajTestLink: document.getElementById('izvestaj-test-link'),
  izvestajCopyBtn: document.getElementById('izvestaj-copy-btn'),
  obrazac6BrowseBtn: document.getElementById('obrazac6-browse-btn'),
  obrazac6File: document.getElementById('obrazac6-file'),
  obrazac6Filename: document.getElementById('obrazac6-filename'),
  obrazac6TestLink: document.getElementById('obrazac6-test-link'),
  obrazac6CopyBtn: document.getElementById('obrazac6-copy-btn'),
  rizikPoAktuInfo: document.getElementById('rizik-po-aktu-info'),
  rizikOverrideSelect: document.getElementById('rizik-override-select'),
  rizikNapomenaInput: document.getElementById('rizik-napomena-input'),
  rizikSaveBtn: document.getElementById('rizik-save-btn'),
  rizikError: document.getElementById('rizik-error'),
  rizikSavedMsg: document.getElementById('rizik-saved-msg'),
  obrazac6Section: document.getElementById('obrazac6-section'),
  obrazac6RazlogInput: document.getElementById('obrazac6-razlog-input'),
  obrazac6GenerisiBtn: document.getElementById('obrazac6-generisi-btn'),
  obrazac6GenError: document.getElementById('obrazac6-gen-error'),

  // Oprema za rad
  opremaListView: document.getElementById('oprema-list-view'),
  opremaDetailView: document.getElementById('oprema-detail-view'),
  opremaNoviBtn: document.getElementById('oprema-novi-btn'),
  obrazac8Btn: document.getElementById('obrazac8-btn'),
  opremaNoviForm: document.getElementById('oprema-novi-form'),
  opremaVrstaInput: document.getElementById('oprema-vrsta-input'),
  opremaFabrickiInput: document.getElementById('oprema-fabricki-input'),
  opremaGodinaInput: document.getElementById('oprema-godina-input'),
  opremaLokacijaInput: document.getElementById('oprema-lokacija-input'),
  opremaNamenaInput: document.getElementById('oprema-namena-input'),
  opremaNoviOtkaziBtn: document.getElementById('oprema-novi-otkazi-btn'),
  opremaNoviError: document.getElementById('oprema-novi-error'),
  opremaTbody: document.getElementById('oprema-tbody'),
  opremaInfo: document.getElementById('oprema-info'),
  opremaFilterVrsta: document.getElementById('oprema-filter-vrsta'),
  opremaFilterFabricki: document.getElementById('oprema-filter-fabricki'),
  opremaFilterLokacija: document.getElementById('oprema-filter-lokacija'),
  opremaFilterSemafor: document.getElementById('oprema-filter-semafor'),
  opremaFilterStatus: document.getElementById('oprema-filter-status'),
  opremaBackToList: document.getElementById('oprema-back-to-list'),
  opremaDetailNaslov: document.getElementById('oprema-detail-naslov'),
  opremaEditVrsta: document.getElementById('oprema-edit-vrsta'),
  opremaEditFabricki: document.getElementById('oprema-edit-fabricki'),
  opremaEditGodina: document.getElementById('oprema-edit-godina'),
  opremaEditLokacija: document.getElementById('oprema-edit-lokacija'),
  opremaEditNamena: document.getElementById('oprema-edit-namena'),
  opremaEditAktivna: document.getElementById('oprema-edit-aktivna'),
  opremaSacuvajBtn: document.getElementById('oprema-sacuvaj-btn'),
  opremaObrisiBtn: document.getElementById('oprema-obrisi-btn'),
  opremaEditError: document.getElementById('oprema-edit-error'),
  opremaPregrediList: document.getElementById('oprema-pregledi-list'),
  opremaNoviPregledForm: document.getElementById('oprema-novi-pregled-form'),
  opremaPregledBroj: document.getElementById('oprema-pregled-broj'),
  opremaPregledDatum: document.getElementById('oprema-pregled-datum'),
  opremaPregledSledeci: document.getElementById('oprema-pregled-sledeci'),
  opremaPregledNapomena: document.getElementById('oprema-pregled-napomena'),
  opremaPregledError: document.getElementById('oprema-pregled-error'),
};

let trenutniIzvestajUrl = null;
let trenutniObrazac6Url = null;

// ---------- LOKALNI FAJLOVI (izveštaj, obrazac 6) ----------

// Windows "Kopiraj kao putanju" (Shift+desni klik) automatski dodaje navodnike
// oko putanje — ako se to nalepi u polje foldera, sve se pokvari. Uklanjamo ih.
function sanitizeFolderPath(raw) {
  return (raw || '').trim().replace(/^["']+|["']+$/g, '').trim();
}

function buildFileUrl(folder, filename) {
  if (!folder || !filename) return '';
  let f = sanitizeFolderPath(folder).replace(/\\/g, '/').replace(/\/+$/, '');
  if (/^file:\/\//i.test(f)) return f + '/' + filename;
  if (f.startsWith('//')) return 'file:' + f + '/' + filename; // UNC putanja
  return 'file:///' + f + '/' + filename;
}

// Vraća file:// URI nazad u putanju kakvu Windows Explorer razume (sa \ i bez file:///)
// Ako putanja sadrži razmak, uokviri je navodnicima — tako se sigurno lepi i u
// Explorer adresnu traku i u prozor "Run" (Win+R), bez obzira na razmake u nazivu.
function fileUrlToWindowsPath(url) {
  if (!url) return '';
  let p = url.replace(/^file:\/\/\//i, '').replace(/^file:\/\//i, '\\\\');
  try { p = decodeURIComponent(p); } catch (e) { /* ostavi kako jeste */ }
  if (!p.startsWith('\\\\')) p = p.replace(/\//g, '\\');
  else p = '\\\\' + p.slice(2).replace(/\//g, '\\');
  if (/\s/.test(p)) p = `"${p}"`;
  return p;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDatumSrpski(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}.`;
}

// Formatira ISO datum (YYYY-MM-DD, kako ga vraća Postgres) u srpski format bez
// oslanjanja na Date parsiranje (izbegava pomeranje datuma zbog vremenske zone).
function formatDatumIso(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = String(isoStr).split('-');
  if (!y || !m || !d) return '';
  return `${d}.${m}.${y}.`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function copyPathToClipboard(path, btn) {
  if (!path) return;
  const original = btn.textContent;
  try {
    await navigator.clipboard.writeText(path);
    btn.textContent = 'Kopirano!';
  } catch (err) {
    window.prompt('Kopiraj putanju (Ctrl+C):', path);
  }
  setTimeout(() => { btn.textContent = original; }, 1500);
}

function setupFilePicker({ folderInput, storageKey, browseBtn, fileInput, filenameSpan, testLink, copyBtn, getUrl, setUrl }) {
  const saved = localStorage.getItem(storageKey);
  if (saved) folderInput.value = saved;

  folderInput.addEventListener('input', () => {
    localStorage.setItem(storageKey, sanitizeFolderPath(folderInput.value));
  });

  // Ako je korisnik nalepio putanju kopiranu preko "Kopiraj kao putanju" (sa navodnicima),
  // očisti ih čim napusti polje da se odmah vidi ispravljena vrednost.
  folderInput.addEventListener('blur', () => {
    const clean = sanitizeFolderPath(folderInput.value);
    if (clean !== folderInput.value) {
      folderInput.value = clean;
      localStorage.setItem(storageKey, clean);
    }
  });

  browseBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const url = buildFileUrl(folderInput.value, file.name);
    setUrl(url);
    filenameSpan.textContent = file.name;
    if (url) {
      testLink.href = url;
      testLink.classList.remove('hidden');
      copyBtn.classList.remove('hidden');
    }
  });

  copyBtn.addEventListener('click', () => {
    copyPathToClipboard(fileUrlToWindowsPath(getUrl()), copyBtn);
  });
}

setupFilePicker({
  folderInput: els.folderIzvestaji,
  storageKey: 'bzr_folder_izvestaji',
  browseBtn: els.izvestajBrowseBtn,
  fileInput: els.izvestajFile,
  filenameSpan: els.izvestajFilename,
  testLink: els.izvestajTestLink,
  copyBtn: els.izvestajCopyBtn,
  getUrl: () => trenutniIzvestajUrl,
  setUrl: (url) => { trenutniIzvestajUrl = url; },
});

setupFilePicker({
  folderInput: els.folderObrazac6,
  storageKey: 'bzr_folder_obrazac6',
  browseBtn: els.obrazac6BrowseBtn,
  fileInput: els.obrazac6File,
  filenameSpan: els.obrazac6Filename,
  testLink: els.obrazac6TestLink,
  copyBtn: els.obrazac6CopyBtn,
  getUrl: () => trenutniObrazac6Url,
  setUrl: (url) => { trenutniObrazac6Url = url; },
});

function resetFilePickers() {
  trenutniIzvestajUrl = null;
  trenutniObrazac6Url = null;
  els.izvestajFilename.textContent = 'Nije izabran fajl';
  els.obrazac6Filename.textContent = 'Nije izabran fajl';
  els.izvestajCopyBtn.classList.add('hidden');
  els.obrazac6CopyBtn.classList.add('hidden');
  els.izvestajTestLink.classList.add('hidden');
  els.obrazac6TestLink.classList.add('hidden');
  els.izvestajFile.value = '';
  els.obrazac6File.value = '';
}

// Prebacuje između "Zaposleni" i "Detalji zaposlenog" unutar modula Zaposleni
function showView(view) {
  els.zaposleniView.classList.add('hidden');
  els.detailView.classList.add('hidden');
  view.classList.remove('hidden');
}

// Prebacuje između liste opreme i detalja opreme unutar modula Oprema za rad
function showOpremaView(view) {
  els.opremaListView.classList.add('hidden');
  els.opremaDetailView.classList.add('hidden');
  view.classList.remove('hidden');
}

// ---------- PORTAL (navigacija između modula) ----------

function showLogin() {
  els.portalNav.classList.add('hidden');
  els.logoutBtn.classList.add('hidden');
  els.loginView.classList.remove('hidden');
  els.modulZaposleni.classList.add('hidden');
  els.modulOprema.classList.add('hidden');
  els.modulPovrede.classList.add('hidden');
}

function switchModul(name) {
  els.modulZaposleni.classList.toggle('hidden', name !== 'zaposleni');
  els.modulOprema.classList.toggle('hidden', name !== 'oprema');
  els.modulPovrede.classList.toggle('hidden', name !== 'povrede');
  els.navTabs.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.modul === name);
  });
  if (name === 'zaposleni') {
    showView(els.zaposleniView);
  }
  if (name === 'oprema') {
    showOpremaView(els.opremaListView);
    loadOprema();
  }
}

function showPortal() {
  els.loginView.classList.add('hidden');
  els.portalNav.classList.remove('hidden');
  els.logoutBtn.classList.remove('hidden');
  switchModul('zaposleni');
}

els.navTabs.forEach((btn) => {
  btn.addEventListener('click', () => switchModul(btn.dataset.modul));
});

// ---------- AUTH ----------

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    showPortal();
    loadZaposleni();
  } else {
    showLogin();
  }
}

els.loginBtn.addEventListener('click', async () => {
  els.loginError.classList.add('hidden');
  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    els.loginError.textContent = 'Pogrešan email ili lozinka.';
    els.loginError.classList.remove('hidden');
    return;
  }
  checkSession();
});

els.logoutBtn.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  checkSession();
});

// ---------- ZAPOSLENI ----------

async function loadZaposleni() {
  els.zaposleniInfo.textContent = 'Učitavanje...';
  const { data, error } = await supabaseClient
    .schema('bzr')
    .from('v_zaposleni_status_rizika')
    .select('*')
    .order('prezime_ime', { ascending: true });

  if (error) {
    els.zaposleniInfo.textContent = 'Greška pri učitavanju: ' + error.message;
    return;
  }

  zaposleniCache = data || [];
  els.zaposleniInfo.textContent = `Ukupno: ${zaposleniCache.length}`;
  applyFilters();
}

function computeRizikStatus(z) {
  if (!z.povecan_rizik) return null;
  if (!z.poslednji_pregled_vazi_do) {
    return { color: 'red', label: 'Nema evidentiran lekarski pregled' };
  }
  const danas = new Date();
  danas.setHours(0, 0, 0, 0);
  const vaziDo = new Date(z.poslednji_pregled_vazi_do);
  const diffDays = Math.round((vaziDo - danas) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { color: 'red', label: `Lekarski istekao pre ${Math.abs(diffDays)} dan(a)` };
  if (diffDays <= 15) return { color: 'orange', label: `Ističe za ${diffDays} dan(a)` };
  return { color: 'green', label: `Važi do ${z.poslednji_pregled_vazi_do}` };
}

function renderZaposleniTable(list) {
  els.zaposleniInfo.textContent = `Prikazano: ${list.length} od ${zaposleniCache.length}`;
  els.zaposleniTbody.innerHTML = '';
  list.forEach((z) => {
    const tr = document.createElement('tr');
    tr.className = 'row-clickable';
    const status = computeRizikStatus(z);
    const dotHtml = status
      ? `<span class="rizik-dot rizik-dot-${status.color}" title="${status.label}"></span>`
      : '';
    const semaforCell = status
      ? `${dotHtml}${status.label}`
      : '<span class="info-msg">—</span>';
    tr.innerHTML = `
      <td>${z.mat_br}</td>
      <td>${dotHtml}${z.prezime_ime}</td>
      <td>${z.radno_mesto || ''}</td>
      <td>${z.radna_jedinica || ''}</td>
      <td>${z.povecan_rizik ? '<span class="badge badge-risk">povećan rizik</span>' : ''}${(z.rizik_override === true || z.rizik_override === false) ? ` <span class="badge" title="${escapeAttr(z.rizik_napomena || 'Ručno promenjen status')}">ručno</span>` : ''}</td>
      <td>${semaforCell}</td>
      <td><span class="badge">${z.aktivan ? 'aktivan' : 'neaktivan'}</span></td>
    `;
    tr.addEventListener('click', () => openDetail(z.mat_br));
    els.zaposleniTbody.appendChild(tr);
  });
}

function applyFilters() {
  const matbr = els.filterMatbr.value.trim().toLowerCase();
  const ime = els.filterIme.value.trim().toLowerCase();
  const radnoMesto = els.filterRadnoMesto.value.trim().toLowerCase();
  const radnaJedinica = els.filterRadnaJedinica.value.trim().toLowerCase();
  const rizik = els.filterRizik.value; // '', 'da', 'ne'
  const semafor = els.filterSemafor.value; // '', 'red', 'orange', 'green', 'none'
  const status = els.filterStatus.value; // '', 'aktivan', 'neaktivan'

  const filtered = zaposleniCache.filter((z) => {
    if (matbr && !(z.mat_br || '').toLowerCase().includes(matbr)) return false;
    if (ime && !(z.prezime_ime || '').toLowerCase().includes(ime)) return false;
    if (radnoMesto && !(z.radno_mesto || '').toLowerCase().includes(radnoMesto)) return false;
    if (radnaJedinica && !(z.radna_jedinica || '').toLowerCase().includes(radnaJedinica)) return false;
    if (rizik === 'da' && !z.povecan_rizik) return false;
    if (rizik === 'ne' && z.povecan_rizik) return false;
    if (semafor) {
      const zStatus = computeRizikStatus(z);
      const zBoja = zStatus ? zStatus.color : 'none';
      if (zBoja !== semafor) return false;
    }
    if (status === 'aktivan' && !z.aktivan) return false;
    if (status === 'neaktivan' && z.aktivan) return false;
    return true;
  });

  renderZaposleniTable(filtered);
}

[els.filterMatbr, els.filterIme, els.filterRadnoMesto, els.filterRadnaJedinica].forEach((el) => {
  el.addEventListener('input', applyFilters);
});
[els.filterRizik, els.filterSemafor, els.filterStatus].forEach((el) => {
  el.addEventListener('change', applyFilters);
});

els.backToList.addEventListener('click', () => {
  showView(els.zaposleniView);
});

// ---------- OBRAZAC 1 (evidencija o radnim mestima sa povećanim rizikom, zaposlenima i
// lekarskim pregledima) — generiše se kao .docx po zvaničnom šablonu, jedan red po
// zaposlenom sa povećanim rizikom, sa istorijom lekarskih pregleda (prethodni + do 4
// najnovija periodična/vanredna pregleda).

async function generisiObrazac1() {
  const rizicni = zaposleniCache.filter((z) => z.povecan_rizik);
  if (rizicni.length === 0) {
    alert('Nema zaposlenih sa povećanim rizikom za Obrazac 1.');
    return;
  }

  els.obrazac1Btn.disabled = true;
  const originalLabel = els.obrazac1Btn.textContent;
  els.obrazac1Btn.textContent = 'Pripremam...';

  try {
    const matBrovi = rizicni.map((z) => z.mat_br);

    const { data: katalog, error: katalogErr } = await supabaseClient
      .schema('bzr')
      .from('radna_mesta_rizik')
      .select('sifra_radnog_mesta, periodicitet_meseci')
      .eq('aktivan', true);
    if (katalogErr) throw katalogErr;
    const periodicitetMap = {};
    (katalog || []).forEach((r) => { periodicitetMap[r.sifra_radnog_mesta] = r.periodicitet_meseci; });

    const { data: pregledi, error: pregErr } = await supabaseClient
      .schema('bzr')
      .from('lekarski_pregledi')
      .select('mat_br, vrsta_pregleda, datum_pregleda, vazi_do, broj_uverenja, rezultat')
      .in('mat_br', matBrovi)
      .order('datum_pregleda', { ascending: true });
    if (pregErr) throw pregErr;

    const pregrediPoZaposlenom = {};
    (pregledi || []).forEach((p) => {
      if (!pregrediPoZaposlenom[p.mat_br]) pregrediPoZaposlenom[p.mat_br] = [];
      pregrediPoZaposlenom[p.mat_br].push(p);
    });

    const redovi = rizicni
      .slice()
      .sort((a, b) => (a.prezime_ime || '').localeCompare(b.prezime_ime || ''))
      .map((z, idx) => {
        const svi = pregrediPoZaposlenom[z.mat_br] || [];
        const prethodni = svi.find((p) => p.vrsta_pregleda === 'prethodni');
        // Periodični i vanredni pregledi zajedno, hronološki (niz je već sortiran rastuće
        // po datumu) — uzimamo poslednja 4, jer šablon ima 4 reda za njih.
        const periodicni = svi.filter((p) => p.vrsta_pregleda !== 'prethodni').slice(-4);

        const red = {
          redni_broj: `${idx + 1}.`,
          radno_mesto: z.radno_mesto || '',
          ime_prezime: z.prezime_ime || '',
          interval: periodicitetMap[z.sifra_radnog_mesta] != null ? String(periodicitetMap[z.sifra_radnog_mesta]) : '',
          datum_prethodni: (prethodni && formatDatumIso(prethodni.datum_pregleda)) || '',
          sledeci_prethodni: (prethodni && formatDatumIso(prethodni.vazi_do)) || '',
          broj_prethodni: (prethodni && prethodni.broj_uverenja) || '',
          ocena_prethodni: (prethodni && prethodni.rezultat) || '',
          mere_prethodni: '',
        };

        for (let i = 0; i < 4; i++) {
          const p = periodicni[i];
          red[`datum_p${i + 1}`] = (p && formatDatumIso(p.datum_pregleda)) || '';
          red[`sledeci_p${i + 1}`] = (p && formatDatumIso(p.vazi_do)) || '';
          red[`broj_p${i + 1}`] = (p && p.broj_uverenja) || '';
          red[`ocena_p${i + 1}`] = (p && p.rezultat) || '';
          red[`mere_p${i + 1}`] = '';
        }
        return red;
      });

    const resp = await fetch('templates/obrazac1-template.docx');
    if (!resp.ok) throw new Error('Ne mogu da učitam šablon Obrasca 1 (templates/obrazac1-template.docx).');
    const templateBuf = await resp.arrayBuffer();

    const zip = new window.PizZip(templateBuf);
    const doc = new window.Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render({ zaposleni: redovi });

    const blob = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const danasOznaka = formatDatumSrpski(new Date()).replace(/\./g, '-').replace(/-+$/, '');
    triggerDownload(blob, `Obrazac1_${danasOznaka}.docx`);
  } catch (err) {
    alert('Greška pri generisanju Obrasca 1: ' + (err.message || err));
  } finally {
    els.obrazac1Btn.disabled = false;
    els.obrazac1Btn.textContent = originalLabel;
  }
}

els.obrazac1Btn.addEventListener('click', generisiObrazac1);

// ---------- DETALJI + LEKARSKI PREGLEDI ----------

async function openDetail(matBr) {
  trenutniZaposleni = zaposleniCache.find((z) => z.mat_br === matBr);
  if (!trenutniZaposleni) return;

  els.detailIme.textContent = trenutniZaposleni.prezime_ime;
  const rizikBadge = trenutniZaposleni.povecan_rizik
    ? ' · <span class="badge badge-risk">povećan rizik</span>'
    : '';
  els.detailMeta.innerHTML =
    `Mat. br. ${trenutniZaposleni.mat_br} · ${trenutniZaposleni.radno_mesto || '—'} · ${trenutniZaposleni.radna_jedinica || '—'}${rizikBadge}`;

  prikaziRizikStatus(trenutniZaposleni);

  showView(els.detailView);
  await loadPregledi(matBr);
}

// ---------- STATUS RIZIKA (ručni izuzetak od kataloga radnih mesta) ----------

function prikaziRizikStatus(z) {
  els.rizikError.classList.add('hidden');
  els.rizikSavedMsg.classList.add('hidden');

  els.rizikPoAktuInfo.innerHTML = z.povecan_rizik_po_aktu
    ? 'Prema Aktu o proceni rizika, ovo radno mesto je <strong>sa povećanim rizikom</strong>.'
    : 'Prema Aktu o proceni rizika, ovo radno mesto <strong>nije</strong> sa povećanim rizikom.';

  if (z.rizik_override === true) {
    els.rizikOverrideSelect.value = 'da';
  } else if (z.rizik_override === false) {
    els.rizikOverrideSelect.value = 'ne';
  } else {
    els.rizikOverrideSelect.value = '';
  }
  els.rizikNapomenaInput.value = z.rizik_napomena || '';

  els.obrazac6Section.classList.toggle('hidden', !z.povecan_rizik);
  els.obrazac6GenError.classList.add('hidden');
}

els.rizikSaveBtn.addEventListener('click', async () => {
  if (!trenutniZaposleni) return;
  els.rizikError.classList.add('hidden');
  els.rizikSavedMsg.classList.add('hidden');

  const izbor = els.rizikOverrideSelect.value; // '', 'da', 'ne'
  const napomena = els.rizikNapomenaInput.value.trim() || null;
  const matBr = trenutniZaposleni.mat_br;

  els.rizikSaveBtn.disabled = true;
  let error;

  if (izbor === '') {
    // Automatski (prema Aktu) — briše ručni izuzetak ako postoji
    ({ error } = await supabaseClient.schema('bzr').from('rizik_override').delete().eq('mat_br', matBr));
  } else {
    ({ error } = await supabaseClient.schema('bzr').from('rizik_override').upsert({
      mat_br: matBr,
      povecan_rizik: izbor === 'da',
      napomena,
    }));
  }

  els.rizikSaveBtn.disabled = false;

  if (error) {
    els.rizikError.textContent = 'Greška pri čuvanju: ' + error.message;
    els.rizikError.classList.remove('hidden');
    return;
  }

  els.rizikSavedMsg.classList.remove('hidden');
  await loadZaposleni();
  trenutniZaposleni = zaposleniCache.find((z) => z.mat_br === matBr);
  if (trenutniZaposleni) {
    els.detailIme.textContent = trenutniZaposleni.prezime_ime;
    const rizikBadge = trenutniZaposleni.povecan_rizik
      ? ' · <span class="badge badge-risk">povećan rizik</span>'
      : '';
    els.detailMeta.innerHTML =
      `Mat. br. ${trenutniZaposleni.mat_br} · ${trenutniZaposleni.radno_mesto || '—'} · ${trenutniZaposleni.radna_jedinica || '—'}${rizikBadge}`;
    prikaziRizikStatus(trenutniZaposleni);
  }
});

// ---------- OBRAZAC 6 (generisanje .docx iz stvarnih podataka) ----------

els.obrazac6GenerisiBtn.addEventListener('click', async () => {
  if (!trenutniZaposleni) return;
  els.obrazac6GenError.classList.add('hidden');

  const razlogObuke = els.obrazac6RazlogInput.value.trim();
  if (!razlogObuke) {
    els.obrazac6GenError.textContent = 'Unesi slučaj/razlog obuke.';
    els.obrazac6GenError.classList.remove('hidden');
    return;
  }

  els.obrazac6GenerisiBtn.disabled = true;
  const originalLabel = els.obrazac6GenerisiBtn.textContent;
  els.obrazac6GenerisiBtn.textContent = 'Generišem...';

  try {
    const { data: rmRow, error: rmError } = await supabaseClient
      .schema('bzr')
      .from('radna_mesta_rizik')
      .select('opis_posla, lzo_lista, opasnosti, mere')
      .eq('sifra_radnog_mesta', trenutniZaposleni.sifra_radnog_mesta)
      .eq('aktivan', true)
      .maybeSingle();

    if (rmError) throw new Error('Greška pri čitanju kataloga radnih mesta: ' + rmError.message);

    if (!rmRow || !rmRow.opis_posla) {
      throw new Error(
        `Za radno mesto "${trenutniZaposleni.radno_mesto || ''}" još nisu popunjeni opis posla / LZO / ` +
        'opasnosti / mere u katalogu (tabela radna_mesta_rizik). Dopuni ih pa pokušaj ponovo.'
      );
    }

    const resp = await fetch('templates/obrazac6-template.docx');
    if (!resp.ok) throw new Error('Ne mogu da učitam šablon Obrasca 6 (templates/obrazac6-template.docx).');
    const templateBuf = await resp.arrayBuffer();

    const zip = new window.PizZip(templateBuf);
    const doc = new window.Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    const danas = formatDatumSrpski(new Date());

    doc.render({
      ime_prezime: trenutniZaposleni.prezime_ime || '',
      radno_mesto: trenutniZaposleni.radno_mesto || '',
      opis_posla: rmRow.opis_posla || '',
      razlog_obuke: razlogObuke,
      datum_obuke_teor: danas,
      datum_obuke_prakt: danas,
      datum_provere_teor: danas,
      datum_provere_prakt: danas,
      lzo_lista: rmRow.lzo_lista || '',
      datum_lzo: danas,
      opasnosti: rmRow.opasnosti || '',
      mere: rmRow.mere || '',
      obavestenja:
        `Upoznat sa Aktom o proceni rizika za radno mesto ${trenutniZaposleni.radno_mesto || ''} ` +
        'i internim uputstvima poslodavca o bezbednosti i zdravlju na radu.',
    });

    const blob = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const bezbedno = (trenutniZaposleni.prezime_ime || 'zaposleni').replace(/[^\p{L}\p{N}]+/gu, '_');
    const nazivFajla = `Obrazac6_${bezbedno}_${new Date().toISOString().slice(0, 10)}.docx`;
    triggerDownload(blob, nazivFajla);
  } catch (err) {
    let msg = err && err.message ? err.message : String(err);
    if (err && err.properties && Array.isArray(err.properties.errors) && err.properties.errors.length) {
      msg = err.properties.errors
        .map((e) => (e.properties && e.properties.explanation) || e.message)
        .join('; ');
    }
    els.obrazac6GenError.textContent = 'Greška: ' + msg;
    els.obrazac6GenError.classList.remove('hidden');
  } finally {
    els.obrazac6GenerisiBtn.disabled = false;
    els.obrazac6GenerisiBtn.textContent = originalLabel;
  }
});

async function loadPregledi(matBr) {
  els.pregrediList.innerHTML = '<p class="info-msg">Učitavanje...</p>';

  const { data, error } = await supabaseClient
    .schema('bzr')
    .from('lekarski_pregledi')
    .select('*')
    .eq('mat_br', matBr)
    .order('datum_pregleda', { ascending: false });

  if (error) {
    els.pregrediList.innerHTML = `<p class="error-msg">Greška: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    els.pregrediList.innerHTML = '<p class="info-msg">Nema unetih pregleda.</p>';
    return;
  }

  const rezultatClass = (r) => {
    if (r === 'sposoban') return 'rezultat-sposoban';
    if (r === 'nesposoban') return 'rezultat-nesposoban';
    return 'rezultat-uslovno';
  };

  els.pregrediList.innerHTML = data.map((p) => `
    <div class="pregled-item">
      <div><strong>${p.datum_pregleda}</strong> — ${p.vrsta_pregleda}</div>
      <div class="${rezultatClass(p.rezultat)}">${p.rezultat}</div>
      ${p.ustanova ? `<div>Ustanova: ${p.ustanova}</div>` : ''}
      ${p.broj_uverenja ? `<div>Broj uverenja: ${p.broj_uverenja}</div>` : ''}
      ${p.vazi_do ? `<div>Važi do: ${p.vazi_do}</div>` : ''}
      ${p.napomena ? `<div>Napomena: ${p.napomena}</div>` : ''}
      <div class="pregled-links">
        ${p.izvestaj_url ? `
          <a href="${p.izvestaj_url}" target="_blank" rel="noopener">Izveštaj o pregledu</a>
          <button type="button" class="link-btn btn-copy-path" data-path="${escapeAttr(fileUrlToWindowsPath(p.izvestaj_url))}">Kopiraj putanju</button>
        ` : ''}
        ${p.obrazac6_url ? `
          <a href="${p.obrazac6_url}" target="_blank" rel="noopener">Obrazac br. 6</a>
          <button type="button" class="link-btn btn-copy-path" data-path="${escapeAttr(fileUrlToWindowsPath(p.obrazac6_url))}">Kopiraj putanju</button>
        ` : ''}
      </div>
      <div class="pregled-actions">
        <button type="button" class="danger-link btn-obrisi-pregled" data-id="${p.id}">Obriši pregled</button>
      </div>
    </div>
  `).join('');
}

// Kopiranje putanje do lokalnog fajla (browser iz bezbednosnih razloga često ne
// dozvoljava da se file:// link sam otvori sa https stranice — ovo je pouzdana zamena)
els.pregrediList.addEventListener('click', async (e) => {
  const copyBtn = e.target.closest('.btn-copy-path');
  if (copyBtn) {
    copyPathToClipboard(copyBtn.dataset.path, copyBtn);
    return;
  }

  const btn = e.target.closest('.btn-obrisi-pregled');
  if (!btn) return;

  const id = btn.dataset.id;
  if (!confirm('Da li sigurno želiš da obrišeš ovaj lekarski pregled? Ovo se ne može poništiti.')) {
    return;
  }

  btn.disabled = true;
  const { error } = await supabaseClient.schema('bzr').from('lekarski_pregledi').delete().eq('id', id);

  if (error) {
    alert('Greška pri brisanju: ' + error.message);
    btn.disabled = false;
    return;
  }

  if (trenutniZaposleni) {
    await loadPregledi(trenutniZaposleni.mat_br);
  }
});

// Automatski postavi "Važi do" na datum pregleda + 1 godina (periodicitet od 12 meseci)
document.getElementById('datum-pregleda').addEventListener('change', (e) => {
  const val = e.target.value;
  if (!val) return;
  const d = new Date(val);
  d.setFullYear(d.getFullYear() + 1);
  const vaziDoInput = document.getElementById('vazi-do');
  // Ne prepisuj ako je korisnik već ručno uneo datum
  if (!vaziDoInput.value) {
    vaziDoInput.value = d.toISOString().slice(0, 10);
  }
});

els.noviPregledForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.pregledError.classList.add('hidden');

  if (!trenutniZaposleni) return;

  const payload = {
    mat_br: trenutniZaposleni.mat_br,
    vrsta_pregleda: document.getElementById('vrsta-pregleda').value,
    datum_pregleda: document.getElementById('datum-pregleda').value,
    rezultat: document.getElementById('rezultat').value,
    ustanova: document.getElementById('ustanova').value || null,
    broj_uverenja: document.getElementById('broj-uverenja').value || null,
    vazi_do: document.getElementById('vazi-do').value || null,
    napomena: document.getElementById('napomena').value || null,
    izvestaj_url: trenutniIzvestajUrl || null,
    obrazac6_url: trenutniObrazac6Url || null,
  };

  const { error } = await supabaseClient.schema('bzr').from('lekarski_pregledi').insert(payload);

  if (error) {
    els.pregledError.textContent = 'Greška pri čuvanju: ' + error.message;
    els.pregledError.classList.remove('hidden');
    return;
  }

  els.noviPregledForm.reset();
  // form.reset() briše i folder polja (deo su iste forme) — vraćamo ih iz memorisane vrednosti
  els.folderIzvestaji.value = localStorage.getItem('bzr_folder_izvestaji') || '';
  els.folderObrazac6.value = localStorage.getItem('bzr_folder_obrazac6') || '';
  resetFilePickers();

  // Novi pregled može da promeni status rizika (npr. datum isteka) — osveži listu
  // i vrati se na nju, umesto da ostaneš na detaljima zaposlenog.
  await loadZaposleni();
  showView(els.zaposleniView);
});

// ---------- OPREMA ZA RAD (Obrazac 8) ----------

let opremaCache = [];
let trenutnaOprema = null;

function formatOpisOpreme(o) {
  const parts = [];
  if (o.vrsta) parts.push(o.vrsta);
  if (o.fabricki_broj) parts.push(`fabr. br. ${o.fabricki_broj}`);
  if (o.godina_proizvodnje) parts.push(`god. proizv. ${o.godina_proizvodnje}`);
  if (o.lokacija) parts.push(`lokacija: ${o.lokacija}`);
  if (o.namena) parts.push(`namena: ${o.namena}`);
  return parts.join(', ');
}

function computeOpremaStatus(o) {
  if (!o.poslednji_pregled_sledeci) {
    return { color: 'red', label: 'Nema evidentiran pregled/proveru' };
  }
  const danas = new Date();
  danas.setHours(0, 0, 0, 0);
  const sledeci = new Date(o.poslednji_pregled_sledeci);
  const diffDays = Math.round((sledeci - danas) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { color: 'red', label: `Istekao pre ${Math.abs(diffDays)} dan(a)` };
  if (diffDays <= 15) return { color: 'orange', label: `Ističe za ${diffDays} dan(a)` };
  return { color: 'green', label: `Važi do ${o.poslednji_pregled_sledeci}` };
}

async function loadOprema() {
  els.opremaInfo.textContent = 'Učitavanje...';
  const { data, error } = await supabaseClient
    .schema('bzr')
    .from('v_oprema_status')
    .select('*')
    .order('vrsta', { ascending: true });

  if (error) {
    els.opremaInfo.textContent = 'Greška pri učitavanju: ' + error.message;
    return;
  }

  opremaCache = data || [];
  els.opremaInfo.textContent = `Ukupno: ${opremaCache.length}`;
  applyOpremaFilters();
}

function renderOpremaTable(list) {
  els.opremaInfo.textContent = `Prikazano: ${list.length} od ${opremaCache.length}`;
  els.opremaTbody.innerHTML = '';
  list.forEach((o) => {
    const tr = document.createElement('tr');
    tr.className = 'row-clickable';
    const status = computeOpremaStatus(o);
    const dotHtml = `<span class="rizik-dot rizik-dot-${status.color}" title="${escapeAttr(status.label)}"></span>`;
    tr.innerHTML = `
      <td>${dotHtml}${escapeHtml(o.vrsta || '')}</td>
      <td>${escapeHtml(o.fabricki_broj || '')}</td>
      <td>${o.godina_proizvodnje || ''}</td>
      <td>${escapeHtml(o.lokacija || '')}</td>
      <td>${escapeHtml(o.namena || '')}</td>
      <td>${status.label}</td>
      <td><span class="badge">${o.aktivna ? 'aktivna' : 'neaktivna'}</span></td>
    `;
    tr.addEventListener('click', () => openOpremaDetail(o.id));
    els.opremaTbody.appendChild(tr);
  });
}

function applyOpremaFilters() {
  const vrsta = els.opremaFilterVrsta.value.trim().toLowerCase();
  const fabricki = els.opremaFilterFabricki.value.trim().toLowerCase();
  const lokacija = els.opremaFilterLokacija.value.trim().toLowerCase();
  const semafor = els.opremaFilterSemafor.value;
  const status = els.opremaFilterStatus.value;

  const filtered = opremaCache.filter((o) => {
    if (vrsta && !(o.vrsta || '').toLowerCase().includes(vrsta)) return false;
    if (fabricki && !(o.fabricki_broj || '').toLowerCase().includes(fabricki)) return false;
    if (lokacija && !(o.lokacija || '').toLowerCase().includes(lokacija)) return false;
    if (semafor) {
      const s = computeOpremaStatus(o);
      if (s.color !== semafor) return false;
    }
    if (status === 'aktivna' && !o.aktivna) return false;
    if (status === 'neaktivna' && o.aktivna) return false;
    return true;
  });

  renderOpremaTable(filtered);
}

[els.opremaFilterVrsta, els.opremaFilterFabricki, els.opremaFilterLokacija].forEach((el) => {
  el.addEventListener('input', applyOpremaFilters);
});
[els.opremaFilterSemafor, els.opremaFilterStatus].forEach((el) => {
  el.addEventListener('change', applyOpremaFilters);
});

els.opremaBackToList.addEventListener('click', () => {
  showOpremaView(els.opremaListView);
});

// ---- Nova oprema ----

els.opremaNoviBtn.addEventListener('click', () => {
  els.opremaNoviForm.classList.remove('hidden');
  els.opremaNoviError.classList.add('hidden');
});

els.opremaNoviOtkaziBtn.addEventListener('click', () => {
  els.opremaNoviForm.classList.add('hidden');
  els.opremaNoviForm.reset();
});

els.opremaNoviForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.opremaNoviError.classList.add('hidden');

  const payload = {
    vrsta: els.opremaVrstaInput.value.trim(),
    fabricki_broj: els.opremaFabrickiInput.value.trim() || null,
    godina_proizvodnje: els.opremaGodinaInput.value ? Number(els.opremaGodinaInput.value) : null,
    lokacija: els.opremaLokacijaInput.value.trim() || null,
    namena: els.opremaNamenaInput.value.trim() || null,
  };

  const { error } = await supabaseClient.schema('bzr').from('oprema_za_rad').insert(payload);

  if (error) {
    els.opremaNoviError.textContent = 'Greška pri čuvanju: ' + error.message;
    els.opremaNoviError.classList.remove('hidden');
    return;
  }

  els.opremaNoviForm.reset();
  els.opremaNoviForm.classList.add('hidden');
  await loadOprema();
});

// ---- Detalji opreme ----

async function openOpremaDetail(id) {
  trenutnaOprema = opremaCache.find((o) => o.id === id);
  if (!trenutnaOprema) return;

  els.opremaDetailNaslov.textContent = trenutnaOprema.vrsta || '(bez naziva)';
  els.opremaEditVrsta.value = trenutnaOprema.vrsta || '';
  els.opremaEditFabricki.value = trenutnaOprema.fabricki_broj || '';
  els.opremaEditGodina.value = trenutnaOprema.godina_proizvodnje || '';
  els.opremaEditLokacija.value = trenutnaOprema.lokacija || '';
  els.opremaEditNamena.value = trenutnaOprema.namena || '';
  els.opremaEditAktivna.checked = !!trenutnaOprema.aktivna;
  els.opremaEditError.classList.add('hidden');

  showOpremaView(els.opremaDetailView);
  await loadOpremaPregledi(id);
}

els.opremaSacuvajBtn.addEventListener('click', async () => {
  els.opremaEditError.classList.add('hidden');
  if (!trenutnaOprema) return;

  const payload = {
    vrsta: els.opremaEditVrsta.value.trim(),
    fabricki_broj: els.opremaEditFabricki.value.trim() || null,
    godina_proizvodnje: els.opremaEditGodina.value ? Number(els.opremaEditGodina.value) : null,
    lokacija: els.opremaEditLokacija.value.trim() || null,
    namena: els.opremaEditNamena.value.trim() || null,
    aktivna: els.opremaEditAktivna.checked,
  };

  const { error } = await supabaseClient.schema('bzr').from('oprema_za_rad').update(payload).eq('id', trenutnaOprema.id);

  if (error) {
    els.opremaEditError.textContent = 'Greška pri čuvanju: ' + error.message;
    els.opremaEditError.classList.remove('hidden');
    return;
  }

  await loadOprema();
  showOpremaView(els.opremaListView);
});

els.opremaObrisiBtn.addEventListener('click', async () => {
  if (!trenutnaOprema) return;
  if (!confirm(`Da li sigurno želiš da obrišeš opremu "${trenutnaOprema.vrsta}" i celu istoriju njenih pregleda? Ovo se ne može poništiti.`)) {
    return;
  }

  els.opremaObrisiBtn.disabled = true;
  const { error } = await supabaseClient.schema('bzr').from('oprema_za_rad').delete().eq('id', trenutnaOprema.id);
  els.opremaObrisiBtn.disabled = false;

  if (error) {
    els.opremaEditError.textContent = 'Greška pri brisanju: ' + error.message;
    els.opremaEditError.classList.remove('hidden');
    return;
  }

  await loadOprema();
  showOpremaView(els.opremaListView);
});

// ---- Istorija pregleda opreme ----

async function loadOpremaPregledi(opremaId) {
  els.opremaPregrediList.innerHTML = 'Učitavanje...';
  const { data, error } = await supabaseClient
    .schema('bzr')
    .from('pregledi_opreme')
    .select('*')
    .eq('oprema_id', opremaId)
    .order('datum_pregleda', { ascending: false });

  if (error) {
    els.opremaPregrediList.innerHTML = `<p class="error-msg">Greška: ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    els.opremaPregrediList.innerHTML = '<p class="info-msg">Još nema evidentiranih pregleda.</p>';
    return;
  }

  els.opremaPregrediList.innerHTML = data.map((p) => `
    <div class="pregled-item">
      <div><strong>${escapeHtml(p.datum_pregleda)}</strong>${p.broj_nalaza ? ` — br. nalaza: ${escapeHtml(p.broj_nalaza)}` : ''}</div>
      ${p.datum_sledeceg ? `<div>Sledeći pregled: ${escapeHtml(p.datum_sledeceg)}</div>` : ''}
      ${p.napomena ? `<div>Napomena: ${escapeHtml(p.napomena)}</div>` : ''}
      <div class="pregled-actions">
        <button type="button" class="danger-link btn-obrisi-opremu-pregled" data-id="${p.id}">Obriši pregled</button>
      </div>
    </div>
  `).join('');
}

els.opremaPregrediList.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-obrisi-opremu-pregled');
  if (!btn) return;

  if (!confirm('Da li sigurno želiš da obrišeš ovaj pregled/proveru? Ovo se ne može poništiti.')) {
    return;
  }

  btn.disabled = true;
  const { error } = await supabaseClient.schema('bzr').from('pregledi_opreme').delete().eq('id', btn.dataset.id);

  if (error) {
    alert('Greška pri brisanju: ' + error.message);
    btn.disabled = false;
    return;
  }

  if (trenutnaOprema) {
    await loadOpremaPregledi(trenutnaOprema.id);
  }
});

els.opremaNoviPregledForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.opremaPregledError.classList.add('hidden');
  if (!trenutnaOprema) return;

  const payload = {
    oprema_id: trenutnaOprema.id,
    broj_nalaza: els.opremaPregledBroj.value.trim() || null,
    datum_pregleda: els.opremaPregledDatum.value,
    datum_sledeceg: els.opremaPregledSledeci.value || null,
    napomena: els.opremaPregledNapomena.value.trim() || null,
  };

  const { error } = await supabaseClient.schema('bzr').from('pregledi_opreme').insert(payload);

  if (error) {
    els.opremaPregledError.textContent = 'Greška pri čuvanju: ' + error.message;
    els.opremaPregledError.classList.remove('hidden');
    return;
  }

  els.opremaNoviPregledForm.reset();

  // Novi pregled menja semafor status — osveži listu i vrati se na nju.
  await loadOprema();
  showOpremaView(els.opremaListView);
});

// ---- Obrazac 8 (.docx) ----

async function generisiObrazac8() {
  const aktivna = opremaCache.filter((o) => o.aktivna);
  if (aktivna.length === 0) {
    alert('Nema aktivne opreme za Obrazac 8.');
    return;
  }

  els.obrazac8Btn.disabled = true;
  const originalLabel = els.obrazac8Btn.textContent;
  els.obrazac8Btn.textContent = 'Pripremam...';

  try {
    const ids = aktivna.map((o) => o.id);

    const { data: pregledi, error: pregErr } = await supabaseClient
      .schema('bzr')
      .from('pregledi_opreme')
      .select('oprema_id, broj_nalaza, datum_pregleda, datum_sledeceg, napomena')
      .in('oprema_id', ids)
      .order('datum_pregleda', { ascending: true });
    if (pregErr) throw pregErr;

    const pregrediPoOpremi = {};
    (pregledi || []).forEach((p) => {
      if (!pregrediPoOpremi[p.oprema_id]) pregrediPoOpremi[p.oprema_id] = [];
      pregrediPoOpremi[p.oprema_id].push(p);
    });

    const redovi = aktivna
      .slice()
      .sort((a, b) => (a.vrsta || '').localeCompare(b.vrsta || ''))
      .map((o, idx) => {
        const svi = (pregrediPoOpremi[o.id] || []).slice(-4);
        const red = {
          redni_broj: `${idx + 1}.`,
          opis_opreme: formatOpisOpreme(o),
        };
        for (let i = 0; i < 4; i++) {
          const p = svi[i];
          red[`broj_${i + 1}`] = (p && p.broj_nalaza) || '';
          red[`datum_${i + 1}`] = (p && formatDatumIso(p.datum_pregleda)) || '';
          red[`sledeci_${i + 1}`] = (p && formatDatumIso(p.datum_sledeceg)) || '';
          red[`napomena_${i + 1}`] = (p && p.napomena) || '';
        }
        return red;
      });

    const resp = await fetch('templates/obrazac8-template.docx');
    if (!resp.ok) throw new Error('Ne mogu da učitam šablon Obrasca 8 (templates/obrazac8-template.docx).');
    const templateBuf = await resp.arrayBuffer();

    const zip = new window.PizZip(templateBuf);
    const doc = new window.Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render({ oprema: redovi });

    const blob = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const danasOznaka = formatDatumSrpski(new Date()).replace(/\./g, '-').replace(/-+$/, '');
    triggerDownload(blob, `Obrazac8_${danasOznaka}.docx`);
  } catch (err) {
    alert('Greška pri generisanju Obrasca 8: ' + (err.message || err));
  } finally {
    els.obrazac8Btn.disabled = false;
    els.obrazac8Btn.textContent = originalLabel;
  }
}

els.obrazac8Btn.addEventListener('click', generisiObrazac8);

// ---------- START ----------

checkSession();
