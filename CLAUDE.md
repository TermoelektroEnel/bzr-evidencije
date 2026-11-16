# CLAUDE.md — BZR Portal (Termoelektro Enel AD)

Uputstvo za Claude-a koji nastavlja rad na ovom projektu. Detaljan opis funkcija, migracija i statusa je u `README.md` — pročitaj ga pre bilo kakve izmene. Ovde su pravila rada i kontekst koji nije zapisan u kodu.

## Šta je projekat

Statički web portal (HTML/CSS/JS, bez build koraka) za BZR evidencije, hostovan na GitHub Pages iz repozitorijuma `TermoelektroEnel/bzr-evidencije` (grana `main`). Podaci su u Supabase-u. Generisanje obrazaca (.docx, Obrazac 6 i kao PDF) radi se u browseru.

Glavni fajlovi: `index.html`, `app.js` (sva logika, ~3000 linija), `config.js` (Supabase klijenti), `style.css`, `templates/*.docx`, `vendor/docx-bundle.js`, `*_migracija.sql` (SQL skripte koje korisnik pokreće ili ih je već pokrenuo).

## Dva Supabase projekta

| Projekat | Ref | Uloga |
|---|---|---|
| `zahtev-za-nabavku` | `yalsccrxelnswxdekzsf` | Glavna baza. BZR podaci su u šemi `bzr`, a projekat se deli sa aplikacijom za nabavku. |
| `prisustvo-karnet-razvoj` (Adamov) | `ledlwnzvmcetfufzwnki` | Kadrovska evidencija. Aplikacija samo čita pogled `evidencija.v_radnici_kadrovska` preko `kadrovskaClient`. |

Korisnik mora da postoji u oba projekta sa istom lozinkom, a u prisustvu mora imati ulogu `administrator` ili `obracun` (`evidencija.osoblje`). Nalozi koji se trenutno koriste: `radosav.djuric@te-enel.rs` i `adam.zivkovic@te-enel.rs`.

## Pravila rada (od korisnika)

- **Nikad ne briši, ne drop-uj i ne menjaj postojeće objekte u bazama** (tabele, poglede, podatke, politike), posebno u Adamovom projektu. Dozvoljeno je samo dodavanje novih objekata. Pre pokretanja SQL-a prvo pokaži upit korisniku.
- Dok se nešto dijagnostikuje, **ne popravljaj ništa** dok korisnik izričito ne kaže šta da se popravi.
- Logiku (rizik, semafor, statusi) računaj u bazi kroz poglede, a ne u browseru.
- Zdravstveni podaci i dokumenti idu samo u **privatne** Storage bucket-e, sa signed URL-ovima.
- Tok rada: nova grana → commit → push → PR. Korisnik spaja PR porukom tipa „spoji PR N“. Ne radi direktno na `main`.
- Pre push-a korisnik proverava izmene lokalno: „pokreni aplikaciju lokalno“ znači pokreni preview `bzr-portal` iz `.claude/launch.json` (Python server na http://localhost:8000, bez keša).
- Pri svakoj izmeni `app.js` ili `style.css` povećaj oznaku `?v=...` u `index.html`. Pri izmeni šablona Obrasca 6 povećaj `?v=` u adresi šablona u `app.js`. GitHub Pages kešira fajlove 10 minuta, pa bi inače browser učitao stari kod.
- Posle izmene ažuriraj sekciju „Status“ u `README.md`.
- Korisnik piše na srpskom (latinica). Odgovaraj na srpskom.

## Istorija (ukratko)

1. Lista „Kadrovska evidencija“ zamenila je staru tabelu Zaposleni i DBF uvoz (PR #1). Rizik i semafor računa `bzr.v_rizik_status`.
2. Obrazac 6 se čuva na Supabase Storage-u (`obuka-obrazac6`), uveden je semafor za Obrazac 6 (važi 12 meseci) i `.eml` nacrti emailova sa prilozima (PR #2).
3. Izgled „BZR signalna“ sa logom firme (PR #3).
4. Obrazac 6 kao PDF, vizuelno usklađen sa Word verzijom, uključujući prelom tabele preko više strana (PR #4). Korisnik će javiti ako se kod nekog zaposlenog prelom opet pokvari.

## Otvoreno

- Katalog radnih mesta (`bzr.radna_mesta_rizik`): opis posla, LZO, opasnosti i mere popunjeni su samo za grupu „Poslovi izvođenja radova na gradilištu“. Ostala radna mesta treba dopuniti.
- Predlog koji nije urađen: ako je korisnik prijavljen na BZR, a nije na prisustvo, prikazati poziv „Prijavi se na kadrovsku“ umesto prazne liste.

## Stari transkripti

Rezervna kopija ranijih Claude sesija (svi projekti) nalazi se u `~/Documents/claude-backup/claude-projects-2026-11-16.tar.gz`. Za ovaj projekat najvažnije su:
- `186b78af-…jsonl`: Obrazac 6 na Supabase-u, email, izgled, PDF
- `4fd5064f-…jsonl`: prelazak na kadrovsku evidenciju, korisnici u Supabase-u
