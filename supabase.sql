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
  action text not null check (action in ('Check In', 'Check Out')),
  signature_data_url text not null,
  client_time text,
  user_agent text
);

create table if not exists public.report_settings (
  key text primary key,
  value text not null
);

alter table public.teachers enable row level security;
alter table public.attendance_records enable row level security;
alter table public.report_settings enable row level security;

alter table public.attendance_records
drop constraint if exists attendance_records_action_check;

update public.attendance_records
set action = case
  when action = 'Giriş' then 'Check In'
  when action = 'Çıkış' then 'Check Out'
  else action
end
where action in ('Giriş', 'Çıkış');

alter table public.attendance_records
add constraint attendance_records_action_check
check (action in ('Check In', 'Check Out'));

drop policy if exists "Herkes aktif öğretmenleri okuyabilir" on public.teachers;
drop policy if exists "Anyone can read active teachers" on public.teachers;
create policy "Anyone can read active teachers"
on public.teachers
for select
to anon
using (active = true);

drop policy if exists "Herkes giriş çıkış kaydı ekleyebilir" on public.attendance_records;
drop policy if exists "Anyone can add attendance records" on public.attendance_records;
create policy "Anyone can add attendance records"
on public.attendance_records
for insert
to anon
with check (
  length(trim(teacher_name)) between 2 and 80
  and action in ('Check In', 'Check Out')
  and signature_data_url like 'data:image/png;base64,%'
);

insert into public.teachers (name)
values
  ('Ayşe Demir'),
  ('Mehmet Yılmaz'),
  ('Elif Kaya'),
  ('Can Aydın')
on conflict (name) do nothing;

insert into public.report_settings (key, value)
values ('report_pin', '1234')
on conflict (key) do nothing;

create or replace function public.get_attendance_report(input_pin text)
returns table (
  "Date" text,
  "Time" text,
  "Staff Member" text,
  "Action" text,
  "Signature" text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_pin text;
begin
  select value
  into stored_pin
  from public.report_settings
  where key = 'report_pin';

  if stored_pin is null or input_pin is distinct from stored_pin then
    raise exception 'Invalid report PIN.';
  end if;

  return query
  select
    to_char(created_at at time zone 'Africa/Johannesburg', 'DD.MM.YYYY') as "Date",
    to_char(created_at at time zone 'Africa/Johannesburg', 'HH24:MI:SS') as "Time",
    teacher_name as "Staff Member",
    action as "Action",
    signature_data_url as "Signature"
  from public.attendance_records
  order by created_at desc;
end;
$$;

revoke all on function public.get_attendance_report(text) from public;
grant execute on function public.get_attendance_report(text) to anon;
