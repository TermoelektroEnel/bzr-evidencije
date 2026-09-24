// BZR Evidencije — glavna logika aplikacije
// Sve BZR tabele/view-ovi žive u Postgres šemi "bzr" (ne "public"),
// zato se svuda koristi supabaseClient.schema('bzr').from(...)

let zaposleniCache = [];
let trenutniZaposleni = null;

const els = {
  loginView: document.getElementById('login-view'),
  zaposleniView: document.getElementById('zaposleni-view'),
  detailView: document.getElementById('detail-view'),
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
  obrazac6BrowseBtn: document.getElementById('obrazac6-browse-btn'),
  obrazac6File: document.getElementById('obrazac6-file'),
  obrazac6Filename: document.getElementById('obrazac6-filename'),
  obrazac6TestLink: document.getElementById('obrazac6-test-link'),
};

let trenutniIzvestajUrl = null;
let trenutniObrazac6Url = null;

// ---------- LOKALNI FAJLOVI (izveštaj, obrazac 6) ----------

function buildFileUrl(folder, filename) {
  if (!folder || !filename) return '';
  let f = folder.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  if (/^file:\/\//i.test(f)) return f + '/' + filename;
  if (f.startsWith('//')) return 'file:' + f + '/' + filename; // UNC putanja
  return 'file:///' + f + '/' + filename;
}

function setupFilePicker({ folderInput, storageKey, browseBtn, fileInput, filenameSpan, testLink, getUrl, setUrl }) {
  const saved = localStorage.getItem(storageKey);
  if (saved) folderInput.value = saved;

  folderInput.addEventListener('input', () => {
    localStorage.setItem(storageKey, folderInput.value.trim());
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
    }
  });
}

setupFilePicker({
  folderInput: els.folderIzvestaji,
  storageKey: 'bzr_folder_izvestaji',
  browseBtn: els.izvestajBrowseBtn,
  fileInput: els.izvestajFile,
  filenameSpan: els.izvestajFilename,
  testLink: els.izvestajTestLink,
  setUrl: (url) => { trenutniIzvestajUrl = url; },
});

setupFilePicker({
  folderInput: els.folderObrazac6,
  storageKey: 'bzr_folder_obrazac6',
  browseBtn: els.obrazac6BrowseBtn,
  fileInput: els.obrazac6File,
  filenameSpan: els.obrazac6Filename,
  testLink: els.obrazac6TestLink,
  setUrl: (url) => { trenutniObrazac6Url = url; },
});

function resetFilePickers() {
  trenutniIzvestajUrl = null;
  trenutniObrazac6Url = null;
  els.izvestajFilename.textContent = 'Nije izabran fajl';
  els.obrazac6Filename.textContent = 'Nije izabran fajl';
  els.izvestajTestLink.classList.add('hidden');
  els.obrazac6TestLink.classList.add('hidden');
  els.izvestajFile.value = '';
  els.obrazac6File.value = '';
}

function showView(view) {
  els.loginView.classList.add('hidden');
  els.zaposleniView.classList.add('hidden');
  els.detailView.classList.add('hidden');
  view.classList.remove('hidden');
}

// ---------- AUTH ----------

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    els.logoutBtn.classList.remove('hidden');
    showView(els.zaposleniView);
    loadZaposleni();
  } else {
    els.logoutBtn.classList.add('hidden');
    showView(els.loginView);
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
    tr.innerHTML = `
      <td>${z.mat_br}</td>
      <td>${dotHtml}${z.prezime_ime}</td>
      <td>${z.radno_mesto || ''}</td>
      <td>${z.radna_jedinica || ''}</td>
      <td>${z.povecan_rizik ? '<span class="badge badge-risk">povećan rizik</span>' : ''}</td>
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
  const status = els.filterStatus.value; // '', 'aktivan', 'neaktivan'

  const filtered = zaposleniCache.filter((z) => {
    if (matbr && !(z.mat_br || '').toLowerCase().includes(matbr)) return false;
    if (ime && !(z.prezime_ime || '').toLowerCase().includes(ime)) return false;
    if (radnoMesto && !(z.radno_mesto || '').toLowerCase().includes(radnoMesto)) return false;
    if (radnaJedinica && !(z.radna_jedinica || '').toLowerCase().includes(radnaJedinica)) return false;
    if (rizik === 'da' && !z.povecan_rizik) return false;
    if (rizik === 'ne' && z.povecan_rizik) return false;
    if (status === 'aktivan' && !z.aktivan) return false;
    if (status === 'neaktivan' && z.aktivan) return false;
    return true;
  });

  renderZaposleniTable(filtered);
}

[els.filterMatbr, els.filterIme, els.filterRadnoMesto, els.filterRadnaJedinica].forEach((el) => {
  el.addEventListener('input', applyFilters);
});
[els.filterRizik, els.filterStatus].forEach((el) => {
  el.addEventListener('change', applyFilters);
});

els.backToList.addEventListener('click', () => {
  showView(els.zaposleniView);
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

  showView(els.detailView);
  await loadPregledi(matBr);
}

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
        ${p.izvestaj_url ? `<a href="${p.izvestaj_url}" target="_blank" rel="noopener">Izveštaj o pregledu</a>` : ''}
        ${p.obrazac6_url ? `<a href="${p.obrazac6_url}" target="_blank" rel="noopener">Obrazac br. 6</a>` : ''}
      </div>
      <div class="pregled-actions">
        <button type="button" class="danger-link btn-obrisi-pregled" data-id="${p.id}">Obriši pregled</button>
      </div>
    </div>
  `).join('');
}

// Brisanje pojedinačnog lekarskog pregleda (delegacija klika — lista se stalno iznova iscrtava)
els.pregrediList.addEventListener('click', async (e) => {
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
  await loadPregledi(trenutniZaposleni.mat_br);
});

// ---------- START ----------

checkSession();
