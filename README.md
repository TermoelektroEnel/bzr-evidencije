# BZR Portal — Termoelektro Enel AD

Web portal za vođenje zakonom propisanih evidencija iz oblasti bezbednosti i zdravlja na radu (BZR), prema Pravilniku o načinu vođenja i rokovima čuvanja evidencija u oblasti bezbednosti i zdravlja na radu ("Sl. glasnik RS", br. 5/2025, 38/2025, 118/2025 i 57/2026) — primenjuje se od 1.1.2027, gradi se unapred.

Portal ima tri modula (gornja navigacija): **Zaposleni** (lista "Kadrovska evidencija", Obrazac 1, Obrazac 6 i Uput za lekarski pregled), **Oprema za rad** (Obrazac 8) i **Povrede na radu** (Obrazac 2).

## Stack

- Statički sajt (HTML/CSS/JS), hostovan na GitHub Pages
- Supabase (Postgres, Auth, RLS) — projekat se deli sa `zahtev-za-nabavku` aplikacijom, BZR podaci žive u posebnoj šemi `bzr`
- Lista zaposlenih ("Kadrovska evidencija") se čita direktno iz pogleda `evidencija.v_radnici_kadrovska` u Supabase projektu kolege Adama (`prisustvo-karnet-razvoj`, aplikacija za radne liste), preko drugog Supabase klijenta (`kadrovskaClient` u `config.js`). Taj pogled ažurno drži spoljni proces koji uvozi kadrovsku — BZR samo čita, nema dupliranja unosa
- Rizik i Semafor po zaposlenom se računaju u bazi, u BZR pogledu `bzr.v_rizik_status`, i povezuju sa kadrovskom po matičnom broju
- Pogled `bzr.v_zaposleni_status_rizika` (preko `postgres_fdw` veze ka istoj bazi zaposlenih) i dalje postoji: na njemu je izgrađen `v_rizik_status`, a aplikacija ga koristi još samo za padajuću listu zaposlenih u modulu Povrede na radu
- Generisanje Obrasca 1, 2, 6 i 8 (.docx) radi se u browseru, klijentski, preko `docxtemplater` + `pizzip` (upakovani u `vendor/docx-bundle.js`) i šablona u `templates/` — nema servera, sve ostaje statičan sajt

## Pre prvog pokretanja

U Supabase dashboardu (`zahtev-za-nabavku` projekat) → **Project Settings → API → Data API Settings** → u polju **Exposed schemas** dodaj `bzr` pored `public` (odvoji zarezom), pa sačuvaj. Bez ovoga frontend ne može da čita `bzr` šemu preko REST API-ja.

Korisnike (login/lozinka) dodaješ ručno u Supabase dashboardu: **Authentication → Users → Add user**.

**Pristup kadrovskoj evidenciji:** pri prijavi, aplikacija se istim email-om i lozinkom prijavljuje i na projekat `prisustvo-karnet-razvoj`. Pogled `v_radnici_kadrovska` vraća redove samo korisnicima koji tamo imaju ulogu `administrator` ili `obracun` (tabela `evidencija.osoblje`). Zato korisnik BZR aplikacije mora da postoji i u tom projektu, sa **istom lozinkom** i jednom od te dve uloge — inače lista zaposlenih ostaje prazna, uz poruku zašto. Prijava na BZR deo radi i bez toga.

Za Rizik i Semafor u listi zaposlenih potreban je pogled `bzr.v_rizik_status` — pravi ga `rizik_status_migracija.sql` (već pokrenuto 10.10.2026; skripta samo dodaje novi pogled i ne menja ništa postojeće). Pravila: ručni izuzetak (`rizik_override`) → katalog radnih mesta po šifri → nije povećan rizik; semafor je crven ako nema pregleda ili je istekao, narandžast ako ističe za 15 dana ili manje, zelen inače ("danas" po beogradskom vremenu).

Da bi dugme "Generiši Obrazac 6" radilo za neko radno mesto, u `bzr.radna_mesta_rizik` moraju biti popunjene kolone `opis_posla`, `lzo_lista`, `opasnosti`, `mere` za to radno mesto (šifru).

Obrazac 1 se generiše iz podataka koje aplikacija već ima (zaposleni iz kadrovske evidencije sa povećanim rizikom prema `v_rizik_status` + njihova istorija lekarskih pregleda) — nema dodatnih preduslova.

Za modul "Oprema za rad" prvo pokreni `oprema_za_rad_migracija.sql` u Supabase SQL editoru (pravi tabele `oprema_za_rad`, `pregledi_opreme` i pogled `v_oprema_status`).

Za modul "Povrede na radu" prvo pokreni `povrede_na_radu_migracija.sql` u Supabase SQL editoru (pravi tabelu `povrede_na_radu`).

Za čuvanje izveštaja o lekarskim pregledima na Supabase Storage-u: prvo ručno napravi **privatan** Storage bucket po imenu `lekarski-izvestaji` (Storage → New bucket, **Public bucket isključeno** — u pitanju su zdravstveni podaci), pa pokreni `lekarski_izvestaji_storage_migracija.sql` u SQL editoru (dodaje kolone i Storage RLS politiku). Detalji su u komentarima na vrhu te skripte.

Za čuvanje stručnih nalaza opreme (PDF) na Supabase Storage-u: isto tako prvo ručno napravi **privatan** bucket po imenu `oprema-strucni-nalazi`, pa pokreni `oprema_strucni_nalaz_storage_migracija.sql`.

Za "Uput za periodični lekarski pregled" (u detaljima zaposlenog): pokreni `uput_lekarski_migracija.sql` u Supabase SQL editoru (dodaje kolonu `posebni_zdravstveni_uslovi` u katalog radnih mesta, pravi tabelu za lične podatke zaposlenog i sekvencu za redni broj uputa, počev od 274), pa i `uvoz_kadrovska_dopuna.sql` (dodaje kolonu `ime_oca` u tu istu tabelu). Da bi dugme radilo za neko radno mesto, u `bzr.radna_mesta_rizik` mora biti popunjena i kolona `posebni_zdravstveni_uslovi` (pored `opis_posla` i `opasnosti`) — popunjava se u tabu "Katalog radnih mesta".

Lični podaci za Uput:
- **JMBG, datum rođenja i ime oca** se automatski popunjavaju iz kadrovske evidencije (`v_radnici_kadrovska`). Vrednost ručno sačuvana u `bzr.zaposleni_licni_podaci` koristi se samo ako kadrovska za tog zaposlenog nema podatak.
- **Ime, očevo ime i prezime** se predlaže iz imena i imena oca iz kadrovske; ručno potvrđena verzija se pamti u `bzr.zaposleni_licni_podaci`.
- **Mesto rođenja i opština** i **zanimanje** ne postoje u kadrovskoj, pa ostaju ručni unos koji se pamti u `bzr.zaposleni_licni_podaci`.

## Status

- [x] `bzr` šema, tabele `radna_mesta_rizik` i `lekarski_pregledi`, RLS
- [x] FDW veza ka bazi zaposlenih (Adamov projekat)
- [x] Prijava, lista zaposlenih, pregled i unos lekarskih pregleda po zaposlenom
- [x] Lista zaposlenih "Kadrovska evidencija" čita direktno `v_radnici_kadrovska` (zamenila je staru tabelu Zaposleni); isti filteri, klik na zaposlenog otvara detalje, Obrazac 1 iz istih podataka
- [x] Rizik i Semafor se računaju u bazi (`bzr.v_rizik_status`), ne u browseru — provereno da daju isti rezultat kao ranija tabela Zaposleni za svih 82 zaposlenih
- [x] JMBG, datum rođenja i ime oca za Uput dolaze iz `v_radnici_kadrovska` (bez posebnog uvoza)
- [x] Ručni izuzetak od statusa "povećan rizik" po zaposlenom (tabela `rizik_override`) — za slučajeve kad neko po Aktu radi na mestu sa povećanim rizikom, ali trenutno (npr. zdravstveni razlozi) ne obavlja te poslove
- [x] Portal navigacija (Zaposleni / Oprema za rad / Povrede na radu)
- [x] Obrazac 6 — generisanje .docx iz stvarnih podataka o zaposlenom i katalogu radnih mesta
- [x] Obrazac 1 — generisanje .docx po zvaničnom obrascu (jedan red po zaposlenom sa povećanim rizikom, sa istorijom lekarskih pregleda: prethodni + do 4 najnovija periodična/vanredna) — potvrđeno od strane korisnika
- [x] Modul "Oprema za rad" — baza (`oprema_za_rad`, `pregledi_opreme`), lista sa filterima i semaforom, unos/izmena/brisanje opreme i pregleda, generisanje Obrasca 8 (.docx, jedan red po aktivnoj opremi sa istorijom poslednja 4 pregleda/provere) po zvaničnom obrascu
- [x] Modul "Povrede na radu" — baza (`povrede_na_radu`), lista sa filterima, unos/izmena/brisanje povreda (sa opcionim biranjem zaposlenog radi automatskog popunjavanja imena/radnog mesta), generisanje Obrasca 2 (.docx) po zvaničnom obrascu
- [x] Izveštaji o lekarskim pregledima (PDF) se čuvaju na privatnom Supabase Storage bucket-u (`lekarski-izvestaji`), sa signed URL-ovima za pregled/preuzimanje; kad rok ("važi do") istekne, na listi pregleda se pojavljuje vizuelni podsetnik sa dugmetom "Preuzmi i ukloni sa Supabase-a" (preuzme fajl na disk, pa tek posle potvrde trajno uklanja sa Supabase-a i markira pregled kao arhiviran). Obrazac br. 6 ostaje na starom lokalnom (file://) mehanizmu.
- [x] Stručni nalazi (PDF) za preglede/provere opreme se čuvaju na privatnom Supabase Storage bucket-u (`oprema-strucni-nalazi`), po istom principu kao lekarski izveštaji (signed URL, podsetnik za arhiviranje kad prođe datum sledećeg pregleda).
- [x] "Uput za periodični lekarski pregled" — generisanje .docx po zvaničnom obrascu, sa rednim brojem koji se sam dodeljuje (počev od 274), automatskim popunjavanjem opisa posla/procenjenih rizika/posebnih zdravstvenih uslova iz kataloga radnih mesta i podataka o prethodnom pregledu iz poslednjeg unetog lekarskog pregleda; JMBG, datum rođenja i ime oca se popunjavaju iz kadrovske evidencije, a mesto rođenja i zanimanje se unose ručno po zaposlenom i pamte za sledeći put.
- [ ] Sadržaj (opis posla/LZO/opasnosti/mere) u katalogu popunjen samo za grupu radnih mesta iz formulara "Poslovi izvođenja radova na gradilištu" (8 od 9 pozicija) — treba doraditi za ostale, ako se dodaju nova radna mesta
- [x] Administracija kataloga radnih mesta sa povećanim rizikom kroz UI — novi tab "Katalog radnih mesta" (dodavanje/izmena/brisanje radnog mesta, sa pokazateljem koliko je polja popunjeno za svako)
