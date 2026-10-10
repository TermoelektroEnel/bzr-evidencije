// BZR Evidencije — Supabase konfiguracija
// Anon (publishable) ključ je bezbedan za javni kod — pristup podacima
// kontroliše RLS na strani baze, ne ovaj ključ.

const SUPABASE_URL = 'https://yalsccrxelnswxdekzsf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PiwJNk84lByWzFnK2VE67A_05B8JKE-';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Kadrovska evidencija (v_radnici_kadrovska) živi u DRUGOM Supabase projektu
// (prisustvo-karnet-razvoj, šema `evidencija`). Pogled vraća redove samo korisnicima
// sa ulogom administrator ili obracun u tom projektu.
const KADROVSKA_SUPABASE_URL = 'https://ledlwnzvmcetfufzwnki.supabase.co';
const KADROVSKA_SUPABASE_ANON_KEY = 'sb_publishable_vq8mS2OtsBArDSGG824enA_ah157FA_';

const kadrovskaClient = supabase.createClient(KADROVSKA_SUPABASE_URL, KADROVSKA_SUPABASE_ANON_KEY);
