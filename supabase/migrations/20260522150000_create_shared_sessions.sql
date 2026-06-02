create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id text primary key,
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.session_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  points integer not null default 5 check (points > 0),
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.session_tasks enable row level security;

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Authenticated users can create sessions"
  on public.sessions
  for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Anyone can read sessions"
  on public.sessions
  for select
  to anon, authenticated
  using (true);

create policy "Users can read their own session tasks"
  on public.session_tasks
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own session tasks"
  on public.session_tasks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own session tasks"
  on public.session_tasks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own session tasks"
  on public.session_tasks
  for delete
  to authenticated
  using (auth.uid() = user_id);
