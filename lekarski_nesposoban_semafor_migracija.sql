-- bzr.v_rizik_status — crven semafor kad je poslednji lekarski pregled "nesposoban"
--
-- Projekat: BZR (yalsccrxelnswxdekzsf). Pokreće se jednom, u Supabase SQL editoru.
--
-- Do sada je semafor gledao samo rok važenja ("važi do"), pa je zaposleni koji je na
-- poslednjem pregledu dobio "nesposoban" imao zeleno "Važi do ...". Sada:
--   - poslednji pregled (po datumu pregleda) ima rezultat "nesposoban" -> crveno,
--     "Nesposoban na pregledu DD.MM.GGGG." — za SVE zaposlene, i bez povećanog rizika
--   - inače sve ostaje kao u rizik_status_migracija.sql
-- Dodaje i kolone poslednji_pregled_rezultat i nesposoban na kraj pogleda.
--
-- CREATE OR REPLACE je bezbedan samo ako je pogled i dalje onakav kakav je napravljen
-- 10.10.2026. (rizik_status_migracija.sql) — zato provera ispod prekida skriptu ako
-- su mu se u međuvremenu promenile kolone ili opcije. Sve ide u jednoj transakciji.

begin;

do $$
declare
  kolone text;
  opcije text[];
begin
  select string_agg(column_name, ',' order by ordinal_position) into kolone
  from information_schema.columns
  where table_schema = 'bzr' and table_name = 'v_rizik_status';

  select reloptions into opcije from pg_class where oid = 'bzr.v_rizik_status'::regclass;

  if kolone is distinct from
     'mat_br,sifra_radnog_mesta,povecan_rizik,povecan_rizik_po_aktu,rizik_rucno,rizik_napomena,'
     'poslednji_pregled_datum,poslednji_pregled_vazi_do,dana_do_isteka,semafor,semafor_opis'
  then
    raise exception 'bzr.v_rizik_status se razlikuje od očekivanog (kolone: %). Ništa nije promenjeno.', kolone;
  end if;
  if opcije is not null then
    raise exception 'bzr.v_rizik_status ima opcije % koje bi se izgubile. Ništa nije promenjeno.', opcije;
  end if;
end $$;

create or replace view bzr.v_rizik_status as
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
    when lp.rezultat = 'nesposoban'                       then 'red'
    when not v.povecan_rizik                              then null
    when v.poslednji_pregled_vazi_do is null              then 'red'
    when v.poslednji_pregled_vazi_do <  p.danas           then 'red'
    when v.poslednji_pregled_vazi_do - p.danas <= p.prag_dana then 'orange'
    else 'green'
  end as semafor,
  case
    when lp.rezultat = 'nesposoban'                       then format('Nesposoban na pregledu %s', to_char(lp.datum_pregleda, 'DD.MM.YYYY.'))
    when not v.povecan_rizik                              then null
    when v.poslednji_pregled_vazi_do is null              then 'Nema evidentiran lekarski pregled'
    when v.poslednji_pregled_vazi_do <  p.danas           then format('Lekarski istekao pre %s dan(a)', p.danas - v.poslednji_pregled_vazi_do)
    when v.poslednji_pregled_vazi_do - p.danas <= p.prag_dana then format('Ističe za %s dan(a)', v.poslednji_pregled_vazi_do - p.danas)
    else format('Važi do %s', v.poslednji_pregled_vazi_do)
  end as semafor_opis,
  lp.rezultat                               as poslednji_pregled_rezultat,
  coalesce(lp.rezultat = 'nesposoban', false) as nesposoban
from bzr.v_zaposleni_status_rizika v
cross join p
left join lateral (
  -- poslednji pregled po datumu, isto kao oznaka "NESPOSOBAN" u listi (app.js)
  select lp.rezultat, lp.datum_pregleda
  from bzr.lekarski_pregledi lp
  where lp.mat_br = v.mat_br
  order by lp.datum_pregleda desc
  limit 1
) lp on true;

grant select on bzr.v_rizik_status to authenticated;

commit;

-- Provera posle pokretanja (samo čita): treba da vrati zaposlene sa crvenim
-- "Nesposoban na pregledu ..." — isti oni koji u listi imaju oznaku NESPOSOBAN.
-- select mat_br, semafor, semafor_opis from bzr.v_rizik_status where nesposoban;
