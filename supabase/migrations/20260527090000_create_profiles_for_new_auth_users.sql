create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, gender)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'preferred_name'), ''),
      nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data->>'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Hero'
    ),
    nullif(btrim(new.raw_user_meta_data->>'gender'), '')
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name),
        gender = coalesce(excluded.gender, public.profiles.gender);

  return new;
end;
$$;

drop trigger if exists create_profile_after_auth_user_created on auth.users;
create trigger create_profile_after_auth_user_created
after insert on auth.users
for each row
execute function public.create_profile_for_new_auth_user();

insert into public.profiles (id, email, display_name, gender)
select
  users.id,
  users.email,
  coalesce(
    nullif(btrim(users.raw_user_meta_data->>'preferred_name'), ''),
    nullif(btrim(users.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(users.raw_user_meta_data->>'name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'Hero'
  ),
  nullif(btrim(users.raw_user_meta_data->>'gender'), '')
from auth.users
where not exists (
  select 1
  from public.profiles
  where public.profiles.id = users.id
)
on conflict (id) do nothing;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);
