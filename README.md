# BZR Evidencije — Termoelektro Enel AD

Web aplikacija za vođenje zakonom propisanih evidencija iz oblasti bezbednosti i zdravlja na radu (BZR).

## Stack

- Statički sajt (HTML/CSS/JS), hostovan na GitHub Pages
- Supabase (Postgres, Auth, RLS) — projekat se deli sa `zahtev-za-nabavku` aplikacijom, BZR podaci žive u posebnoj šemi `bzr`
- Podaci o zaposlenima se čitaju uživo iz baze kolege Adama (aplikacija za radne liste), preko `postgres_fdw` — nema dupliranja unosa

## Pre prvog pokretanja

U Supabase dashboardu (`zahtev-za-nabavku` projekat) → **Project Settings → API → Data API Settings** → u polju **Exposed schemas** dodaj `bzr` pored `public` (odvoji zarezom), pa sačuvaj. Bez ovoga frontend ne može da čita `bzr` šemu preko REST API-ja.

Korisnike (login/lozinka) dodaješ ručno u Supabase dashboardu: **Authentication → Users → Add user**.

## Status

- [x] `bzr` šema, tabele `radna_mesta_rizik` i `lekarski_pregledi`, RLS
- [x] FDW veza ka bazi zaposlenih (Adamov projekat)
- [x] Prijava, lista zaposlenih, pregled i unos lekarskih pregleda po zaposlenom
- [ ] Administracija kataloga radnih mesta sa povećanim rizikom (`radna_mesta_rizik`)
- [ ] Štampa/izvoz na propisanom obrascu
- [ ] Ostale evidencije (povrede na radu, obuke, LZO, ...)
