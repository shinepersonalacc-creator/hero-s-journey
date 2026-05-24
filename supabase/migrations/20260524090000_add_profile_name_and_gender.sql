alter table public.profiles
  add column if not exists email text,
  add column if not exists display_name text,
  add column if not exists gender text;

create index if not exists profiles_display_name_idx
  on public.profiles (display_name);

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email))
  where email is not null;
