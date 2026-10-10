-- bzr.v_rizik_status — Rizik i Semafor po zaposlenom, izračunati u bazi
--
-- Projekat: BZR (yalsccrxelnswxdekzsf). Već pokrenuto 2026-10-10 kao migracija
-- "create_v_rizik_status" — ovaj fajl je zapis toga šta je pokrenuto.
--
-- Samo DODAJE novi pogled; ne menja nijedan postojeći objekat. Namerno CREATE VIEW
-- (ne CREATE OR REPLACE), da pukne umesto da pregazi ako pogled već postoji.
--
-- Pravila za Rizik se NE ponavljaju ovde: pogled čita bzr.v_zaposleni_status_rizika
-- (ručni izuzetak -> katalog radnih mesta -> false), pa ostaju definisana na jednom mestu.
-- Ovde se dodaje samo Semafor, koji je ranije računao samo browser (computeRizikStatus
-- u app.js): crveno = nema pregleda ili je istekao, narandžasto = ističe za <= 15 dana,
-- zeleno = važi. "Danas" je po beogradskom vremenu (baza radi u UTC-u).
--
-- Provereno odmah posle kreiranja: za svih 82 zaposlenih povecan_rizik, ručni izuzetak,
-- važi do i boja + tekst semafora su identični onome što prikazuje tabela Zaposleni.

create view bzr.v_rizik_status as
with p as (
  select
    15 as prag_dana,                                         -- prag za narandžasto
    (now() at time zone 'Europe/Belgrade')::date as danas    -- lokalni datum, ne UTC
)
select
  v.mat_br,
  v.sifra_radnog_mesta,
  v.povecan_rizik,
  v.povecan_rizik_po_aktu,
  v.rizik_override is not null              as rizik_rucno,
  v.rizik_napomena,
  v.poslednji_pregled_datum,
  v.poslednji_pregled_vazi_do,
  v.poslednji_pregled_vazi_do - p.danas     as dana_do_isteka,
  case
    when not v.povecan_rizik                              then null
    when v.poslednji_pregled_vazi_do is null              then 'red'
    when v.poslednji_pregled_vazi_do <  p.danas           then 'red'
    when v.poslednji_pregled_vazi_do - p.danas <= p.prag_dana then 'orange'
    else 'green'
  end as semafor,
  case
    when not v.povecan_rizik                              then null
    when v.poslednji_pregled_vazi_do is null              then 'Nema evidentiran lekarski pregled'
    when v.poslednji_pregled_vazi_do <  p.danas           then format('Lekarski istekao pre %s dan(a)', p.danas - v.poslednji_pregled_vazi_do)
    when v.poslednji_pregled_vazi_do - p.danas <= p.prag_dana then format('Ističe za %s dan(a)', v.poslednji_pregled_vazi_do - p.danas)
    else format('Važi do %s', v.poslednji_pregled_vazi_do)
  end as semafor_opis
from bzr.v_zaposleni_status_rizika v
cross join p;

grant select on bzr.v_rizik_status to authenticated;
