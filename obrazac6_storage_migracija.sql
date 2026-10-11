-- Obrazac br. 6 (evidencija o obučenosti za BZR i LZO): čuvanje na Supabase Storage-u.
--
-- Obrazac 6 je vezan za ZAPOSLENOG (obuku), ne za lekarski pregled — zato ima svoju
-- tabelu bzr.obrazac6_dokumenti i svoj PRIVATAN bucket "obuka-obrazac6" (nije javni —
-- lični podaci zaposlenih), sa Storage RLS politikom za prijavljene korisnike.
--
-- Stara kolona bzr.lekarski_pregledi.obrazac6_url (lokalni file:// link) ostaje radi
-- starih redova, ali se više ne popunjava.

insert into storage.buckets (id, name, public)
values ('obuka-obrazac6', 'obuka-obrazac6', false)
on conflict (id) do nothing;

drop policy if exists authenticated_all_obuka_obrazac6 on storage.objects;
create policy authenticated_all_obuka_obrazac6
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'obuka-obrazac6')
  with check (bucket_id = 'obuka-obrazac6');

create table if not exists bzr.obrazac6_dokumenti (
  id uuid primary key default gen_random_uuid(),
  mat_br text not null,
  datum_obuke date not null,
  razlog_obuke text,
  storage_path text not null,
  naziv_fajla text,
  created_at timestamptz not null default now()
);

create index if not exists obrazac6_dokumenti_mat_br_idx on bzr.obrazac6_dokumenti (mat_br);

alter table bzr.obrazac6_dokumenti enable row level security;

drop policy if exists authenticated_all_obrazac6_dokumenti on bzr.obrazac6_dokumenti;
create policy authenticated_all_obrazac6_dokumenti
  on bzr.obrazac6_dokumenti
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on bzr.obrazac6_dokumenti to authenticated;
