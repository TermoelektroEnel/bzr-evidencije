# BZR Portal — Termoelektro Enel AD

Web portal za vođenje zakonom propisanih evidencija iz oblasti bezbednosti i zdravlja na radu (BZR), prema Pravilniku o načinu vođenja i rokovima čuvanja evidencija u oblasti bezbednosti i zdravlja na radu ("Sl. glasnik RS", br. 5/2025, 38/2025, 118/2025 i 57/2026) — primenjuje se od 1.1.2027, gradi se unapred.

Portal ima tri modula (gornja navigacija): **Zaposleni** (Obrazac 1 i Obrazac 6), **Oprema za rad** (Obrazac 8 — u pripremi) i **Povrede na radu** (Obrazac 2 — u pripremi).

## Stack

- Statički sajt (HTML/CSS/JS), hostovan na GitHub Pages
- Supabase (Postgres, Auth, RLS) — projekat se deli sa `zahtev-za-nabavku` aplikacijom, BZR podaci žive u posebnoj šemi `bzr`
- Podaci o zaposlenima se čitaju uživo iz baze kolege Adama (aplikacija za radne liste), preko `postgres_fdw` — nema dupliranja unosa
- Generisanje Obrasca 6 (.docx) radi se u browseru, klijentski, preko `docxtemplater` + `pizzip` (upakovani u `vendor/docx-bundle.js`) i šablona `templates/obrazac6-template.docx` — nema servera, sve ostaje statičan sajt
- Obrazac 1 se generiše kao print-prikaz (dugme "Štampaj Obrazac 1" → Ctrl+P / Sačuvaj kao PDF)

## Pre prvog pokretanja

U Supabase dashboardu (`zahtev-za-nabavku` projekat) → **Project Settings → API → Data API Settings** → u polju **Exposed schemas** dodaj `bzr` pored `public` (odvoji zarezom), pa sačuvaj. Bez ovoga frontend ne može da čita `bzr` šemu preko REST API-ja.

Korisnike (login/lozinka) dodaješ ručno u Supabase dashboardu: **Authentication → Users → Add user**.

Da bi dugme "Generiši Obrazac 6" radilo za neko radno mesto, u `bzr.radna_mesta_rizik` moraju biti popunjene kolone `opis_posla`, `lzo_lista`, `opasnosti`, `mere` za to radno mesto (šifru).

## Status

- [x] `bzr` šema, tabele `radna_mesta_rizik` i `lekarski_pregledi`, RLS
- [x] FDW veza ka bazi zaposlenih (Adamov projekat)
- [x] Prijava, lista zaposlenih, pregled i unos lekarskih pregleda po zaposlenom
- [x] Ručni izuzetak od statusa "povećan rizik" po zaposlenom (tabela `rizik_override`) — za slučajeve kad neko po Aktu radi na mestu sa povećanim rizikom, ali trenutno (npr. zdravstveni razlozi) ne obavlja te poslove
- [x] Portal navigacija (Zaposleni / Oprema za rad / Povrede na radu)
- [x] Obrazac 6 — generisanje .docx iz stvarnih podataka o zaposlenom i katalogu radnih mesta
- [x] Obrazac 1 — štampa registra zaposlenih na radnim mestima sa povećanim rizikom
- [ ] Sadržaj (opis posla/LZO/opasnosti/mere) u katalogu popunjen samo za grupu radnih mesta iz formulara "Poslovi izvođenja radova na gradilištu" (8 od 9 pozicija) — treba doraditi za ostale, ako se dodaju nova radna mesta
- [ ] Modul "Oprema za rad" (Obrazac 8) — baza i ekran
- [ ] Modul "Povrede na radu" (Obrazac 2) — baza i ekran
- [ ] Administracija kataloga radnih mesta sa povećanim rizikom kroz UI (trenutno samo SQL)
