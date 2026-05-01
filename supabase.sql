create extension if not exists pgcrypto;

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  access_token uuid not null default gen_random_uuid(),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  teacher_id uuid references public.teachers(id),
  teacher_name text not null,
  action text not null check (action in ('Check In', 'Check Out')),
  signature_data_url text not null,
  client_ip text,
  user_agent text
);

create table if not exists public.report_settings (
  key text primary key,
  value text not null
);

alter table public.teachers add column if not exists access_token uuid;
alter table public.attendance_records add column if not exists teacher_id uuid references public.teachers(id);
alter table public.attendance_records add column if not exists client_ip text;

update public.teachers
set access_token = gen_random_uuid()
where access_token is null;

alter table public.teachers alter column access_token set default gen_random_uuid();
alter table public.teachers alter column access_token set not null;

create unique index if not exists teachers_access_token_key
on public.teachers(access_token);

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
drop policy if exists "Herkes giriş çıkış kaydı ekleyebilir" on public.attendance_records;
drop policy if exists "Anyone can add attendance records" on public.attendance_records;

insert into public.teachers (name)
values
  ('Ayşe Demir'),
  ('Mehmet Yılmaz'),
  ('Elif Kaya'),
  ('Can Aydın')
on conflict (name) do nothing;

insert into public.report_settings (key, value)
values
  ('report_pin', '1234'),
  ('allowed_ips', '')
on conflict (key) do nothing;

create or replace function public.request_headers_()
returns jsonb
language plpgsql
stable
as $$
declare
  raw_headers text;
begin
  raw_headers := nullif(current_setting('request.headers', true), '');
  if raw_headers is null then
    return '{}'::jsonb;
  end if;
  return raw_headers::jsonb;
exception
  when others then
    return '{}'::jsonb;
end;
$$;

create or replace function public.current_client_ip_()
returns text
language sql
stable
as $$
  select nullif(trim(split_part(coalesce(public.request_headers_()->>'x-forwarded-for', ''), ',', 1)), '');
$$;

create or replace function public.allowed_ip_list_()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_remove(
      array(
        select trim(part.value)
        from regexp_split_to_table(
          coalesce((select value from public.report_settings where key = 'allowed_ips'), ''),
          ','
        ) as part(value)
      ),
      ''
    ),
    array[]::text[]
  );
$$;

create or replace function public.is_school_ip_allowed_()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  client_ip text := public.current_client_ip_();
  allowed_ips text[] := public.allowed_ip_list_();
  allowed_ip text;
begin
  if array_length(allowed_ips, 1) is null then
    return true;
  end if;

  if client_ip is null then
    return false;
  end if;

  foreach allowed_ip in array allowed_ips loop
    begin
      if client_ip::inet <<= allowed_ip::cidr then
        return true;
      end if;
    exception
      when others then
        if client_ip = allowed_ip then
          return true;
        end if;
    end;
  end loop;

  return false;
end;
$$;

create or replace function public.verify_admin_pin_(input_pin text)
returns void
language plpgsql
stable
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
    raise exception 'Invalid admin PIN.';
  end if;
end;
$$;

create or replace function public.get_teacher_by_token(staff_token text)
returns table (
  id uuid,
  name text,
  network_allowed boolean,
  client_ip text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    t.id,
    t.name,
    public.is_school_ip_allowed_() as network_allowed,
    public.current_client_ip_() as client_ip
  from public.teachers t
  where t.active = true
    and t.access_token::text = staff_token
  limit 1;
end;
$$;

create or replace function public.save_attendance_record(
  staff_token text,
  input_action text,
  signature_data_url text,
  browser_user_agent text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  teacher_record public.teachers%rowtype;
  new_record_id uuid;
begin
  if not public.is_school_ip_allowed_() then
    raise exception 'This register only works on the school network.';
  end if;

  select *
  into teacher_record
  from public.teachers
  where active = true
    and access_token::text = staff_token
  limit 1;

  if teacher_record.id is null then
    raise exception 'Invalid staff link.';
  end if;

  if input_action not in ('Check In', 'Check Out') then
    raise exception 'Invalid action.';
  end if;

  if signature_data_url is null or signature_data_url not like 'data:image/png;base64,%' then
    raise exception 'Signature is required.';
  end if;

  insert into public.attendance_records (
    teacher_id,
    teacher_name,
    action,
    signature_data_url,
    client_ip,
    user_agent
  )
  values (
    teacher_record.id,
    teacher_record.name,
    input_action,
    signature_data_url,
    public.current_client_ip_(),
    left(coalesce(browser_user_agent, ''), 300)
  )
  returning id into new_record_id;

  return jsonb_build_object(
    'ok', true,
    'id', new_record_id,
    'name', teacher_record.name,
    'action', input_action
  );
end;
$$;

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
begin
  perform public.verify_admin_pin_(input_pin);

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

create or replace function public.get_admin_dashboard(input_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  teacher_rows jsonb;
begin
  perform public.verify_admin_pin_(input_pin);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'active', active,
        'access_token', access_token::text
      )
      order by name
    ),
    '[]'::jsonb
  )
  into teacher_rows
  from public.teachers;

  return jsonb_build_object(
    'teachers', teacher_rows,
    'allowed_ips', public.allowed_ip_list_(),
    'client_ip', public.current_client_ip_()
  );
end;
$$;

create or replace function public.admin_upsert_teacher(
  input_pin text,
  teacher_id uuid,
  staff_name text,
  is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_teacher public.teachers%rowtype;
  clean_name text := trim(regexp_replace(coalesce(staff_name, ''), '\s+', ' ', 'g'));
begin
  perform public.verify_admin_pin_(input_pin);

  if length(clean_name) < 2 then
    raise exception 'Staff name is required.';
  end if;

  if teacher_id is null then
    insert into public.teachers (name, active)
    values (clean_name, coalesce(is_active, true))
    returning * into saved_teacher;
  else
    update public.teachers
    set name = clean_name,
        active = coalesce(is_active, active)
    where id = teacher_id
    returning * into saved_teacher;
  end if;

  return jsonb_build_object(
    'id', saved_teacher.id,
    'name', saved_teacher.name,
    'active', saved_teacher.active,
    'access_token', saved_teacher.access_token::text
  );
end;
$$;

create or replace function public.admin_set_teacher_active(
  input_pin text,
  teacher_id uuid,
  is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_teacher public.teachers%rowtype;
begin
  perform public.verify_admin_pin_(input_pin);

  update public.teachers
  set active = coalesce(is_active, false)
  where id = teacher_id
  returning * into saved_teacher;

  return jsonb_build_object(
    'id', saved_teacher.id,
    'name', saved_teacher.name,
    'active', saved_teacher.active,
    'access_token', saved_teacher.access_token::text
  );
end;
$$;

create or replace function public.admin_rotate_teacher_token(
  input_pin text,
  teacher_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_teacher public.teachers%rowtype;
begin
  perform public.verify_admin_pin_(input_pin);

  update public.teachers
  set access_token = gen_random_uuid()
  where id = teacher_id
  returning * into saved_teacher;

  return jsonb_build_object(
    'id', saved_teacher.id,
    'name', saved_teacher.name,
    'active', saved_teacher.active,
    'access_token', saved_teacher.access_token::text
  );
end;
$$;

create or replace function public.admin_save_allowed_ips(
  input_pin text,
  input_ips text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_ips text[];
begin
  perform public.verify_admin_pin_(input_pin);

  select coalesce(array_agg(ip), array[]::text[])
  into clean_ips
  from (
    select distinct trim(part.value) as ip
    from unnest(coalesce(input_ips, array[]::text[])) as part(value)
    where trim(part.value) <> ''
  ) cleaned;

  insert into public.report_settings (key, value)
  values ('allowed_ips', array_to_string(clean_ips, ','))
  on conflict (key)
  do update set value = excluded.value;

  return jsonb_build_object(
    'allowed_ips', clean_ips,
    'client_ip', public.current_client_ip_()
  );
end;
$$;

revoke all on function public.get_teacher_by_token(text) from public;
revoke all on function public.save_attendance_record(text, text, text, text) from public;
revoke all on function public.get_attendance_report(text) from public;
revoke all on function public.get_admin_dashboard(text) from public;
revoke all on function public.admin_upsert_teacher(text, uuid, text, boolean) from public;
revoke all on function public.admin_set_teacher_active(text, uuid, boolean) from public;
revoke all on function public.admin_rotate_teacher_token(text, uuid) from public;
revoke all on function public.admin_save_allowed_ips(text, text[]) from public;
revoke all on function public.request_headers_() from public;
revoke all on function public.current_client_ip_() from public;
revoke all on function public.allowed_ip_list_() from public;
revoke all on function public.is_school_ip_allowed_() from public;
revoke all on function public.verify_admin_pin_(text) from public;

grant execute on function public.get_teacher_by_token(text) to anon;
grant execute on function public.save_attendance_record(text, text, text, text) to anon;
grant execute on function public.get_attendance_report(text) to anon;
grant execute on function public.get_admin_dashboard(text) to anon;
grant execute on function public.admin_upsert_teacher(text, uuid, text, boolean) to anon;
grant execute on function public.admin_set_teacher_active(text, uuid, boolean) to anon;
grant execute on function public.admin_rotate_teacher_token(text, uuid) to anon;
grant execute on function public.admin_save_allowed_ips(text, text[]) to anon;
