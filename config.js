// BZR Evidencije — Supabase konfiguracija
// Anon (publishable) ključ je bezbedan za javni kod — pristup podacima
// kontroliše RLS na strani baze, ne ovaj ključ.

const SUPABASE_URL = 'https://yalsccrxelnswxdekzsf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_PiwJNk84lByWzFnK2VE67A_05B8JKE-';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
