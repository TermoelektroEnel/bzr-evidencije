# BZR Portal — Termoelektro Enel AD

Web portal za vođenje zakonom propisanih evidencija iz oblasti bezbednosti i zdravlja na radu (BZR), prema Pravilniku o načinu vođenja i rokovima čuvanja evidencija u oblasti bezbednosti i zdravlja na radu ("Sl. glasnik RS", br. 5/2025, 38/2025, 118/2025 i 57/2026) — primenjuje se od 1.1.2027, gradi se unapred.

Portal ima tri modula (gornja navigacija): **Zaposleni** (Obrazac 1 i Obrazac 6), **Oprema za rad** (Obrazac 8) i **Povrede na radu** (Obrazac 2).

## Stack

- Statički sajt (HTML/CSS/JS), hostovan na GitHub Pages
- Supabase (Postgres, Auth, RLS) — projekat se deli sa `zahtev-za-nabavku` aplikacijom, BZR podaci žive u posebnoj šemi `bzr`
- Podaci o zaposlenima se čitaju uživo iz baze kolege Adama (aplikacija za radne liste), preko `postgres_fdw` — nema dupliranja unosa
- Generisanje Obrasca 1, 2, 6 i 8 (.docx) radi se u browseru, klijentski, preko `docxtemplater` + `pizzip` (upakovani u `vendor/docx-bundle.js`) i šablona u `templates/` — nema servera, sve ostaje statičan sajt

## Pre prvog pokretanja

U Supabase dashboardu (`zahtev-za-nabavku` projekat) → **Project Settings → API → Data API Settings** → u polju **Exposed schemas** dodaj `bzr` pored `public` (odvoji zarezom), pa sačuvaj. Bez ovoga frontend ne može da čita `bzr` šemu preko REST API-ja.

Korisnike (login/lozinka) dodaješ ručno u Supabase dashboardu: **Authentication → Users → Add user**.

Da bi dugme "Generiši Obrazac 6" radilo za neko radno mesto, u `bzr.radna_mesta_rizik` moraju biti popunjene kolone `opis_posla`, `lzo_lista`, `opasnosti`, `mere` za to radno mesto (šifru).

Obrazac 1 se generiše iz podataka koje aplikacija već ima (zaposleni sa povećanim rizikom + njihova istorija lekarskih pregleda) — nema dodatnih preduslova.

Za modul "Oprema za rad" prvo pokreni `oprema_za_rad_migracija.sql` u Supabase SQL editoru (pravi tabele `oprema_za_rad`, `pregledi_opreme` i pogled `v_oprema_status`).

Za modul "Povrede na radu" prvo pokreni `povrede_na_radu_migracija.sql` u Supabase SQL editoru (pravi tabelu `povrede_na_radu`).

Za čuvanje izveštaja o lekarskim pregledima na Supabase Storage-u: prvo ručno napravi **privatan** Storage bucket po imenu `lekarski-izvestaji` (Storage → New bucket, **Public bucket isključeno** — u pitanju su zdravstveni podaci), pa pokreni `lekarski_izvestaji_storage_migracija.sql` u SQL editoru (dodaje kolone i Storage RLS politiku). Detalji su u komentarima na vrhu te skripte.

Za čuvanje stručnih nalaza opreme (PDF) na Supabase Storage-u: isto tako prvo ručno napravi **privatan** bucket po imenu `oprema-strucni-nalazi`, pa pokreni `oprema_strucni_nalaz_storage_migracija.sql`.

Za "Uput za periodični lekarski pregled" (dugme u modulu Zaposleni): pokreni `uput_lekarski_migracija.sql` u Supabase SQL editoru (dodaje kolonu `posebni_zdravstveni_uslovi` u katalog radnih mesta, pravi tabelu za lične podatke zaposlenog i sekvencu za redni broj uputa, počev od 274). Da bi dugme radilo za neko radno mesto, u `bzr.radna_mesta_rizik` mora biti popunjena i kolona `posebni_zdravstveni_uslovi` (pored `opis_posla` i `opasnosti`). Lični podaci zaposlenog (JMBG, ime/očevo ime/prezime, datum i mesto rođenja, zanimanje) se unose ručno, jednom po zaposlenom, direktno u aplikaciji — ne postoji potvrđen način da se automatski povuku iz Adamove baze, pa se čuvaju lokalno (tabela `bzr.zaposleni_licni_podaci`) i aplikacija ih sama predlaže sledeći put.

## Status

- [x] `bzr` šema, tabele `radna_mesta_rizik` i `lekarski_pregledi`, RLS
- [x] FDW veza ka bazi zaposlenih (Adamov projekat)
- [x] Prijava, lista zaposlenih, pregled i unos lekarskih pregleda po zaposlenom
- [x] Ručni izuzetak od statusa "povećan rizik" po zaposlenom (tabela `rizik_override`) — za slučajeve kad neko po Aktu radi na mestu sa povećanim rizikom, ali trenutno (npr. zdravstveni razlozi) ne obavlja te poslove
- [x] Portal navigacija (Zaposleni / Oprema za rad / Povrede na radu)
- [x] Obrazac 6 — generisanje .docx iz stvarnih podataka o zaposlenom i katalogu radnih mesta
- [x] Obrazac 1 — generisanje .docx po zvaničnom obrascu (jedan red po zaposlenom sa povećanim rizikom, sa istorijom lekarskih pregleda: prethodni + do 4 najnovija periodična/vanredna) — potvrđeno od strane korisnika
- [x] Modul "Oprema za rad" — baza (`oprema_za_rad`, `pregledi_opreme`), lista sa filterima i semaforom, unos/izmena/brisanje opreme i pregleda, generisanje Obrasca 8 (.docx, jedan red po aktivnoj opremi sa istorijom poslednja 4 pregleda/provere) po zvaničnom obrascu
- [x] Modul "Povrede na radu" — baza (`povrede_na_radu`), lista sa filterima, unos/izmena/brisanje povreda (sa opcionim biranjem zaposlenog radi automatskog popunjavanja imena/radnog mesta), generisanje Obrasca 2 (.docx) po zvaničnom obrascu
- [x] Izveštaji o lekarskim pregledima (PDF) se čuvaju na privatnom Supabase Storage bucket-u (`lekarski-izvestaji`), sa signed URL-ovima za pregled/preuzimanje; kad rok ("važi do") istekne, na listi pregleda se pojavljuje vizuelni podsetnik sa dugmetom "Preuzmi i ukloni sa Supabase-a" (preuzme fajl na disk, pa tek posle potvrde trajno uklanja sa Supabase-a i markira pregled kao arhiviran). Obrazac br. 6 ostaje na starom lokalnom (file://) mehanizmu.
- [x] Stručni nalazi (PDF) za preglede/provere opreme se čuvaju na privatnom Supabase Storage bucket-u (`oprema-strucni-nalazi`), po istom principu kao lekarski izveštaji (signed URL, podsetnik za arhiviranje kad prođe datum sledećeg pregleda).
- [x] "Uput za periodični lekarski pregled" — generisanje .docx po zvaničnom obrascu, sa rednim brojem koji se sam dodeljuje (počev od 274), automatskim popunjavanjem opisa posla/procenjenih rizika/posebnih zdravstvenih uslova iz kataloga radnih mesta i podataka o prethodnom pregledu iz poslednjeg unetog lekarskog pregleda; lični podaci zaposlenog (JMBG i sl.) se unose ručno po zaposlenom i pamte za sledeći put.
- [ ] Sadržaj (opis posla/LZO/opasnosti/mere) u katalogu popunjen samo za grupu radnih mesta iz formulara "Poslovi izvođenja radova na gradilištu" (8 od 9 pozicija) — treba doraditi za ostale, ako se dodaju nova radna mesta
- [ ] Administracija kataloga radnih mesta sa povećanim rizikom kroz UI (trenutno samo SQL)
