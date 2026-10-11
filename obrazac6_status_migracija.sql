-- bzr.v_obrazac6_status — Semafor za Obrazac 6 (obuka za BZR i LZO) po zaposlenom
--
-- Isti princip kao Semafor za lekarski pregled u bzr.v_rizik_status: crveno = nema
-- Obrasca 6 ili je istekao, narandžasto = ističe za <= 15 dana, zeleno = važi.
-- Obrazac 6 važi 12 meseci od datuma obuke (poslednji sačuvani u bzr.obrazac6_dokumenti).
-- Za razliku od lekarskog, važi za SVE zaposlene, ne samo one sa povećanim rizikom.
-- "Danas" je po beogradskom vremenu (baza radi u UTC-u).

create or replace view bzr.v_obrazac6_status as
with p as (
  select
    15 as prag_dana,                                         -- prag za narandžasto
    (now() at time zone 'Europe/Belgrade')::date as danas    -- lokalni datum, ne UTC
),
poslednji as (
  select mat_br, max(datum_obuke) as poslednja_obuka
  from bzr.obrazac6_dokumenti
  group by mat_br
),
z as (
  select mat_br from bzr.v_zaposleni_status_rizika
  union
  select mat_br from poslednji
),
s as (
  select
    z.mat_br,
    po.poslednja_obuka,
    (po.poslednja_obuka + interval '12 months')::date as vazi_do
  from z
  left join poslednji po on po.mat_br = z.mat_br
)
select
  s.mat_br,
  s.poslednja_obuka,
  s.vazi_do,
  s.vazi_do - p.danas as dana_do_isteka,
  case
    when s.vazi_do is null                      then 'red'
    when s.vazi_do <  p.danas                   then 'red'
    when s.vazi_do - p.danas <= p.prag_dana     then 'orange'
    else 'green'
  end as semafor,
  case
    when s.vazi_do is null                      then 'Nema evidentiran Obrazac 6'
    when s.vazi_do <  p.danas                   then format('Obrazac 6 istekao pre %s dan(a)', p.danas - s.vazi_do)
    when s.vazi_do - p.danas <= p.prag_dana     then format('Ističe za %s dan(a)', s.vazi_do - p.danas)
    else format('Važi do %s', s.vazi_do)
  end as semafor_opis
from s
cross join p;

grant select on bzr.v_obrazac6_status to authenticated;
