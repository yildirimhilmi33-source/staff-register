create extension if not exists pgcrypto;

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  teacher_name text not null,
  action text not null check (action in ('Giriş', 'Çıkış')),
  signature_data_url text not null,
  client_time text,
  user_agent text
);

alter table public.teachers enable row level security;
alter table public.attendance_records enable row level security;

drop policy if exists "Herkes aktif öğretmenleri okuyabilir" on public.teachers;
create policy "Herkes aktif öğretmenleri okuyabilir"
on public.teachers
for select
to anon
using (active = true);

drop policy if exists "Herkes giriş çıkış kaydı ekleyebilir" on public.attendance_records;
create policy "Herkes giriş çıkış kaydı ekleyebilir"
on public.attendance_records
for insert
to anon
with check (
  length(trim(teacher_name)) between 2 and 80
  and action in ('Giriş', 'Çıkış')
  and signature_data_url like 'data:image/png;base64,%'
);

insert into public.teachers (name)
values
  ('Ayşe Demir'),
  ('Mehmet Yılmaz'),
  ('Elif Kaya'),
  ('Can Aydın')
on conflict (name) do nothing;
