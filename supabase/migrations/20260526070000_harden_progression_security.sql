create extension if not exists pgcrypto;

create table if not exists public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount > 0 and amount <= 100),
  source_type text not null check (source_type in ('session_task')),
  source_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

create table if not exists public.user_action_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 1 check (count > 0),
  primary key (user_id, action, window_start)
);

alter table public.session_tasks
  add column if not exists rewardable boolean not null default false,
  drop constraint if exists session_tasks_points_check,
  add constraint session_tasks_points_check check (points between 1 and 10),
  drop constraint if exists session_tasks_title_length_check,
  add constraint session_tasks_title_length_check check (
    char_length(btrim(title)) between 1 and 160
  );

alter table public.sessions
  drop constraint if exists sessions_name_length_check,
  add constraint sessions_name_length_check check (
    char_length(btrim(name)) between 1 and 120
  );

alter table public.xp_ledger enable row level security;
alter table public.user_action_limits enable row level security;

drop policy if exists "Users can read their own xp ledger" on public.xp_ledger;
create policy "Users can read their own xp ledger"
  on public.xp_ledger
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "No client inserts to xp ledger" on public.xp_ledger;
create policy "No client inserts to xp ledger"
  on public.xp_ledger
  as restrictive
  for insert
  to authenticated
  with check (false);

drop policy if exists "No client updates to xp ledger" on public.xp_ledger;
create policy "No client updates to xp ledger"
  on public.xp_ledger
  as restrictive
  for update
  to authenticated
  using (false)
  with check (false);

drop policy if exists "No client deletes from xp ledger" on public.xp_ledger;
create policy "No client deletes from xp ledger"
  on public.xp_ledger
  as restrictive
  for delete
  to authenticated
  using (false);

drop policy if exists "No client access to rate limits" on public.user_action_limits;
create policy "No client access to rate limits"
  on public.user_action_limits
  as restrictive
  for all
  to authenticated
  using (false)
  with check (false);

create or replace function public.secure_level_for_xp(total_xp integer)
returns integer
language plpgsql
immutable
as $$
declare
  remaining integer := greatest(coalesce(total_xp, 0), 0);
  requirements integer[] := array[50, 70, 90, 140, 160, 200, 220, 240, 280, 300];
  needed integer;
  computed_level integer := 1;
begin
  foreach needed in array requirements loop
    if remaining < needed then
      return computed_level;
    end if;

    remaining := remaining - needed;
    computed_level := computed_level + 1;
  end loop;

  return computed_level;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

create or replace function public.prevent_client_profile_xp_changes()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated')
    and (new.xp is distinct from old.xp or new.level is distinct from old.level) then
    raise exception 'XP and level can only be changed by trusted server-side code';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_client_xp_changes on public.profiles;
create trigger profiles_prevent_client_xp_changes
before update on public.profiles
for each row
execute function public.prevent_client_profile_xp_changes();

create or replace function public.check_action_rate_limit(
  action_name text,
  max_actions integer,
  window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
  window_start_value timestamptz;
  current_count integer;
begin
  if requester is null then
    raise exception 'Authentication required';
  end if;

  if max_actions < 1 or window_seconds < 1 then
    raise exception 'Invalid rate limit configuration';
  end if;

  window_start_value := to_timestamp(
    floor(extract(epoch from now()) / window_seconds) * window_seconds
  );

  insert into public.user_action_limits (user_id, action, window_start, count)
  values (requester, action_name, window_start_value, 1)
  on conflict (user_id, action, window_start)
  do update set count = public.user_action_limits.count + 1
  returning count into current_count;

  if current_count > max_actions then
    raise exception 'Too many requests. Try again later.';
  end if;
end;
$$;

create or replace function public.ensure_profile_for_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
begin
  if requester is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (id, xp, level)
  values (requester, 0, 1)
  on conflict (id) do nothing;
end;
$$;

create or replace function public.complete_session_task_secure(task_id uuid)
returns table (
  id uuid,
  session_id text,
  user_id uuid,
  title text,
  points integer,
  completed boolean,
  created_at timestamptz,
  awarded_xp integer,
  profile_xp integer,
  profile_level integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
  task_row public.session_tasks%rowtype;
  ledger_row_count integer := 0;
  award_amount integer := 0;
  next_xp integer;
  next_level integer;
begin
  if requester is null then
    raise exception 'Authentication required';
  end if;

  perform public.check_action_rate_limit('complete_session_task', 30, 60);
  perform public.ensure_profile_for_current_user();

  select *
    into task_row
    from public.session_tasks
    where public.session_tasks.id = task_id
      and public.session_tasks.user_id = requester
    for update;

  if not found then
    raise exception 'Task not found';
  end if;

  if task_row.points < 1 or task_row.points > 10 then
    raise exception 'Invalid task reward';
  end if;

  award_amount := case when task_row.rewardable then task_row.points else 0 end;

  if award_amount > 0 then
    insert into public.xp_ledger (user_id, amount, source_type, source_id, metadata)
    values (
      requester,
      award_amount,
      'session_task',
      task_row.id::text,
      jsonb_build_object('session_id', task_row.session_id, 'title', task_row.title)
    )
    on conflict (user_id, source_type, source_id) do nothing;

    get diagnostics ledger_row_count = row_count;
  end if;

  update public.session_tasks
    set completed = true
    where public.session_tasks.id = task_row.id;

  if ledger_row_count > 0 then
    update public.profiles
      set xp = public.profiles.xp + award_amount,
          level = public.secure_level_for_xp(public.profiles.xp + award_amount)
      where public.profiles.id = requester
      returning public.profiles.xp, public.profiles.level into next_xp, next_level;
  else
    select public.profiles.xp, public.profiles.level
      into next_xp, next_level
      from public.profiles
      where public.profiles.id = requester;
  end if;

  return query
  select
    task_row.id,
    task_row.session_id,
    task_row.user_id,
    task_row.title,
    task_row.points,
    true,
    task_row.created_at,
    case when ledger_row_count > 0 then award_amount else 0 end,
    coalesce(next_xp, 0),
    coalesce(next_level, 1);
end;
$$;

create or replace function public.create_shared_session_secure(session_name text)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
  trimmed_name text := btrim(coalesce(session_name, ''));
  created_session public.sessions%rowtype;
begin
  if requester is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trimmed_name) < 1 or char_length(trimmed_name) > 120 then
    raise exception 'Session name must be between 1 and 120 characters';
  end if;

  perform public.check_action_rate_limit('create_shared_session', 10, 3600);

  insert into public.sessions (id, name, created_by)
  values (gen_random_uuid()::text, trimmed_name, requester)
  returning * into created_session;

  return created_session;
end;
$$;

revoke all on table public.profiles from anon, authenticated;
grant select (id, xp, level, email, display_name, gender, created_at, updated_at)
  on public.profiles to authenticated;
grant insert (id, email, display_name, gender)
  on public.profiles to authenticated;
grant update (email, display_name, gender)
  on public.profiles to authenticated;

revoke all on table public.session_tasks from anon, authenticated;
grant select (id, session_id, user_id, title, points, completed, created_at, rewardable)
  on public.session_tasks to authenticated;
grant insert (session_id, user_id, title, points, completed)
  on public.session_tasks to authenticated;
grant delete on public.session_tasks to authenticated;

revoke all on table public.xp_ledger from anon, authenticated;
grant select (id, user_id, amount, source_type, source_id, metadata, created_at)
  on public.xp_ledger to authenticated;

revoke all on table public.user_action_limits from anon, authenticated;

revoke all on table public.sessions from anon, authenticated;
grant select (id, name, created_by, created_at) on public.sessions to authenticated;
grant delete on public.sessions to authenticated;

grant execute on function public.complete_session_task_secure(uuid) to authenticated;
grant execute on function public.create_shared_session_secure(text) to authenticated;
grant execute on function public.secure_level_for_xp(integer) to authenticated;

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update non-progression profile fields"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can update their own session tasks" on public.session_tasks;

drop policy if exists "Anyone can read sessions" on public.sessions;
create policy "Authenticated users can read sessions"
  on public.sessions
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can create sessions" on public.sessions;
