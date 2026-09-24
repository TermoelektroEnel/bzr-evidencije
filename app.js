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
};

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

function renderZaposleniTable(list) {
  els.zaposleniInfo.textContent = `Prikazano: ${list.length} od ${zaposleniCache.length}`;
  els.zaposleniTbody.innerHTML = '';
  list.forEach((z) => {
    const tr = document.createElement('tr');
    tr.className = 'row-clickable';
    tr.innerHTML = `
      <td>${z.mat_br}</td>
      <td>${z.prezime_ime}</td>
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
    </div>
  `).join('');
}

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
  };

  const { error } = await supabaseClient.schema('bzr').from('lekarski_pregledi').insert(payload);

  if (error) {
    els.pregledError.textContent = 'Greška pri čuvanju: ' + error.message;
    els.pregledError.classList.remove('hidden');
    return;
  }

  els.noviPregledForm.reset();
  await loadPregledi(trenutniZaposleni.mat_br);
});

// ---------- START ----------

checkSession();
