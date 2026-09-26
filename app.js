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
  obrazac1Print: document.getElementById('obrazac1-print'),
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

// ---------- OBRAZAC 1 (registar radnih mesta sa povećanim rizikom, za štampu) ----------

async function generisiObrazac1() {
  const rizicni = zaposleniCache.filter((z) => z.povecan_rizik);
  if (rizicni.length === 0) {
    alert('Nema zaposlenih sa povećanim rizikom za štampu Obrasca 1.');
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
      .select('mat_br, datum_pregleda, vazi_do, broj_uverenja, rezultat')
      .in('mat_br', matBrovi)
      .order('datum_pregleda', { ascending: false });
    if (pregErr) throw pregErr;

    // Za svakog zaposlenog uzimamo samo NAJNOVIJI pregled (lista je već sortirana po datumu opadajuće)
    const poslednjiMap = {};
    (pregledi || []).forEach((p) => {
      if (!poslednjiMap[p.mat_br]) poslednjiMap[p.mat_br] = p;
    });

    const redovi = rizicni
      .slice()
      .sort((a, b) => (a.prezime_ime || '').localeCompare(b.prezime_ime || ''))
      .map((z) => {
        const p = poslednjiMap[z.mat_br];
        return {
          radnoMesto: z.radno_mesto || '',
          ime: z.prezime_ime || '',
          interval: periodicitetMap[z.sifra_radnog_mesta] ?? '',
          datumPregleda: (p && p.datum_pregleda) || '',
          datumSledeceg: (p && p.vazi_do) || '',
          brojUverenja: (p && p.broj_uverenja) || '',
          ocena: (p && p.rezultat) || '',
        };
      });

    const danas = formatDatumSrpski(new Date());
    els.obrazac1Print.innerHTML = `
      <h2>OBRAZAC 1 — Evidencija o radnim mestima sa povećanim rizikom</h2>
      <p class="obrazac1-meta">Termoelektro Enel AD &middot; Bačvanska 21b/III, Beograd &middot; PIB 100252434 &middot; Datum izvoda: ${danas}</p>
      <table>
        <thead>
          <tr>
            <th>Naziv radnog mesta</th>
            <th>Ime i prezime zaposlenog</th>
            <th>Interval pregleda (mes.)</th>
            <th>Datum poslednjeg pregleda</th>
            <th>Datum sledećeg pregleda</th>
            <th>Broj lek. izveštaja</th>
            <th>Ocena sposobnosti</th>
            <th>Preduzete mere</th>
          </tr>
        </thead>
        <tbody>
          ${redovi.map((r) => `
            <tr>
              <td>${escapeHtml(r.radnoMesto)}</td>
              <td>${escapeHtml(r.ime)}</td>
              <td>${escapeHtml(r.interval)}</td>
              <td>${escapeHtml(r.datumPregleda)}</td>
              <td>${escapeHtml(r.datumSledeceg)}</td>
              <td>${escapeHtml(r.brojUverenja)}</td>
              <td>${escapeHtml(r.ocena)}</td>
              <td></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.body.classList.add('printing-obrazac1');
    window.print();
  } catch (err) {
    alert('Greška pri pripremi Obrasca 1: ' + (err.message || err));
  } finally {
    els.obrazac1Btn.disabled = false;
    els.obrazac1Btn.textContent = originalLabel;
  }
}

els.obrazac1Btn.addEventListener('click', generisiObrazac1);

window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing-obrazac1');
});

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

// ---------- START ----------

checkSession();
