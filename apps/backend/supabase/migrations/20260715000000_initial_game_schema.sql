create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.match_status as enum ('in_progress', 'completed', 'abandoned');
create type public.local_transport as enum ('wifi', 'hotspot', 'bluetooth');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  avatar_color text not null default '#2563EB' check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  games_played integer not null default 0 check (games_played >= 0),
  games_won integer not null default 0 check (games_won >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references public.profiles(id) on delete restrict,
  room_code text not null check (room_code ~ '^[A-Z0-9]{4}$'),
  status public.match_status not null default 'in_progress',
  transport public.local_transport not null,
  player_count smallint not null check (player_count between 2 and 8),
  winner_user_id uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 30),
  seat smallint not null check (seat between 1 and 8),
  is_host boolean not null default false,
  final_phase smallint not null default 1 check (final_phase between 1 and 10),
  score integer not null default 0 check (score >= 0),
  placement smallint check (placement between 1 and 8),
  created_at timestamptz not null default now(),
  unique (match_id, seat),
  unique (match_id, user_id)
);

create table public.match_rounds (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  round_number smallint not null check (round_number > 0),
  winner_player_id uuid references public.match_players(id) on delete set null,
  summary jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  unique (match_id, round_number)
);

create table public.match_saves (
  match_id uuid primary key references public.matches(id) on delete cascade,
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  state_version integer not null default 1 check (state_version > 0),
  encrypted_state text not null,
  updated_at timestamptz not null default now()
);

create index matches_host_user_id_idx on public.matches(host_user_id, created_at desc);
create index match_players_user_id_idx on public.match_players(user_id, created_at desc);
create index match_players_match_id_idx on public.match_players(match_id);
create index match_rounds_match_id_idx on public.match_rounds(match_id, round_number);

create or replace function private.is_match_host(target_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches
    where id = target_match_id and host_user_id = (select auth.uid())
  );
$$;

create or replace function private.is_match_member(target_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.match_players
    where match_id = target_match_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Player'));
  return new;
end;
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure private.set_updated_at();

create trigger match_saves_set_updated_at
  before update on public.match_saves
  for each row execute procedure private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_rounds enable row level security;
alter table public.match_saves enable row level security;

create policy "Profiles are visible to signed-in players"
on public.profiles for select to authenticated
using (true);

create policy "Players update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Members can view matches"
on public.matches for select to authenticated
using (host_user_id = (select auth.uid()) or private.is_match_member(id));

create policy "Players create hosted matches"
on public.matches for insert to authenticated
with check (host_user_id = (select auth.uid()));

create policy "Hosts update matches"
on public.matches for update to authenticated
using (host_user_id = (select auth.uid()))
with check (host_user_id = (select auth.uid()));

create policy "Hosts delete matches"
on public.matches for delete to authenticated
using (host_user_id = (select auth.uid()));

create policy "Members can view match players"
on public.match_players for select to authenticated
using (user_id = (select auth.uid()) or private.is_match_host(match_id) or private.is_match_member(match_id));

create policy "Hosts add match players"
on public.match_players for insert to authenticated
with check (private.is_match_host(match_id));

create policy "Hosts update match players"
on public.match_players for update to authenticated
using (private.is_match_host(match_id))
with check (private.is_match_host(match_id));

create policy "Members can view rounds"
on public.match_rounds for select to authenticated
using (private.is_match_host(match_id) or private.is_match_member(match_id));

create policy "Hosts write rounds"
on public.match_rounds for insert to authenticated
with check (private.is_match_host(match_id));

create policy "Hosts update rounds"
on public.match_rounds for update to authenticated
using (private.is_match_host(match_id))
with check (private.is_match_host(match_id));

create policy "Hosts manage save data"
on public.match_saves for all to authenticated
using (host_user_id = (select auth.uid()) and private.is_match_host(match_id))
with check (host_user_id = (select auth.uid()) and private.is_match_host(match_id));

grant usage on schema public to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_match_host(uuid) to authenticated;
grant execute on function private.is_match_member(uuid) to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.matches to authenticated;
grant select, insert, update on public.match_players to authenticated;
grant select, insert, update on public.match_rounds to authenticated;
grant select, insert, update, delete on public.match_saves to authenticated;
grant all on all tables in schema public to service_role;
