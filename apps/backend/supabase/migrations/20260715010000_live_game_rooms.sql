create type public.game_room_status as enum ('lobby', 'playing', 'completed', 'closed');

create table public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{4}$'),
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  status public.game_room_status not null default 'lobby',
  transport text not null check (transport in ('auto', 'wifi', 'hotspot', 'bluetooth')),
  max_players smallint not null check (max_players between 2 and 8),
  state_version integer not null default 0 check (state_version >= 0),
  game_state jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_room_players (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  seat smallint not null check (seat between 1 and 8),
  avatar_color text not null check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  is_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

create index game_rooms_code_open_idx
  on public.game_rooms(code)
  where status in ('lobby', 'playing');
create index game_rooms_host_idx on public.game_rooms(host_user_id, created_at desc);
create index game_room_players_user_idx on public.game_room_players(user_id, joined_at desc);

create trigger game_rooms_set_updated_at
  before update on public.game_rooms
  for each row execute procedure private.set_updated_at();

create or replace function private.is_game_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.game_room_players
    where room_id = target_room_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.generate_game_room_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_bytes bytea;
  generated_code text := '';
  character_index integer;
begin
  random_bytes := extensions.gen_random_bytes(4);
  for character_index in 0..3 loop
    generated_code := generated_code || substr(
      alphabet,
      1 + (get_byte(random_bytes, character_index) % char_length(alphabet)),
      1
    );
  end loop;
  return generated_code;
end;
$$;

create or replace function private.game_room_snapshot(target_room_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'room', jsonb_build_object(
      'code', room.code,
      'maxPlayers', room.max_players,
      'hostId', room.host_user_id,
      'status', case room.status
        when 'completed' then 'finished'
        when 'closed' then 'finished'
        else room.status::text
      end,
      'transport', room.transport,
      'players', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', player.user_id,
            'name', player.display_name,
            'seat', player.seat,
            'color', player.avatar_color,
            'isHost', player.user_id = room.host_user_id,
            'isReady', player.is_ready,
            'cardsRemaining', coalesce((
              select jsonb_array_length(game_player -> 'hand')
              from jsonb_array_elements(coalesce(room.game_state -> 'players', '[]'::jsonb)) game_player
              where game_player ->> 'id' = player.user_id::text
              limit 1
            ), 10),
            'connection', 'strong',
            'transport', case
              when room.transport = 'auto' then 'wifi'
              else room.transport
            end
          )
          order by player.seat
        )
        from public.game_room_players player
        where player.room_id = room.id
      ), '[]'::jsonb)
    ),
    'roomId', room.id,
    'stateVersion', room.state_version,
    'gameState', room.game_state
  )
  from public.game_rooms room
  where room.id = target_room_id;
$$;

create or replace function public.create_game_room(
  display_name text,
  maximum_players integer default 6,
  requested_transport text default 'auto'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  clean_name text := btrim(display_name);
  room_id uuid;
  room_code text;
  attempt integer;
  colors constant text[] := array[
    '#2563EB', '#0F766E', '#D97706', '#7C3AED',
    '#E11D48', '#0891B2', '#65A30D', '#475569'
  ];
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if char_length(clean_name) not between 1 and 30 then
    raise exception using errcode = '22023', message = 'Player name must be between 1 and 30 characters.';
  end if;
  if maximum_players not between 2 and 8 then
    raise exception using errcode = '22023', message = 'Maximum players must be between 2 and 8.';
  end if;
  if requested_transport not in ('auto', 'wifi', 'hotspot', 'bluetooth') then
    raise exception using errcode = '22023', message = 'Unsupported room transport.';
  end if;

  update public.game_rooms
  set status = 'closed', completed_at = coalesce(completed_at, now())
  where host_user_id = current_user_id and status = 'lobby';

  for attempt in 1..20 loop
    room_code := private.generate_game_room_code();
    begin
      insert into public.game_rooms (code, host_user_id, transport, max_players)
      values (room_code, current_user_id, requested_transport, maximum_players)
      returning id into room_id;
      exit;
    exception when unique_violation then
      room_id := null;
    end;
  end loop;

  if room_id is null then
    raise exception using errcode = '40001', message = 'Could not allocate a room code. Please try again.';
  end if;

  update public.profiles
  set display_name = clean_name
  where id = current_user_id;

  insert into public.game_room_players (
    room_id, user_id, display_name, seat, avatar_color, is_ready
  ) values (
    room_id, current_user_id, clean_name, 1, colors[1], true
  );

  return private.game_room_snapshot(room_id);
end;
$$;

create or replace function public.join_game_room(room_code text, display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  clean_code text := upper(regexp_replace(room_code, '[^A-Za-z0-9]', '', 'g'));
  clean_name text := btrim(display_name);
  target_room public.game_rooms%rowtype;
  next_seat integer;
  colors constant text[] := array[
    '#2563EB', '#0F766E', '#D97706', '#7C3AED',
    '#E11D48', '#0891B2', '#65A30D', '#475569'
  ];
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if clean_code !~ '^[A-Z0-9]{4}$' then
    raise exception using errcode = '22023', message = 'Enter a valid four-character room code.';
  end if;
  if char_length(clean_name) not between 1 and 30 then
    raise exception using errcode = '22023', message = 'Player name must be between 1 and 30 characters.';
  end if;

  select * into target_room
  from public.game_rooms
  where code = clean_code and expires_at > now()
  for update;

  if not found or target_room.status <> 'lobby' then
    raise exception using errcode = 'P0002', message = 'That room is not available.';
  end if;

  if exists (
    select 1 from public.game_room_players
    where room_id = target_room.id and user_id = current_user_id
  ) then
    update public.game_room_players
    set display_name = clean_name, last_seen_at = now()
    where room_id = target_room.id and user_id = current_user_id;
    return private.game_room_snapshot(target_room.id);
  end if;

  if (select count(*) from public.game_room_players where room_id = target_room.id) >= target_room.max_players then
    raise exception using errcode = 'P0003', message = 'That room is full.';
  end if;

  select available_seat into next_seat
  from generate_series(1, target_room.max_players) available_seat
  where not exists (
    select 1 from public.game_room_players
    where room_id = target_room.id and seat = available_seat
  )
  order by available_seat
  limit 1;

  update public.profiles
  set display_name = clean_name
  where id = current_user_id;

  insert into public.game_room_players (
    room_id, user_id, display_name, seat, avatar_color
  ) values (
    target_room.id, current_user_id, clean_name, next_seat, colors[next_seat]
  );

  return private.game_room_snapshot(target_room.id);
end;
$$;

create or replace function public.get_game_room(target_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_game_room_member(target_room_id) then
    raise exception using errcode = '42501', message = 'You are not a member of this room.';
  end if;
  update public.game_room_players
  set last_seen_at = now()
  where room_id = target_room_id and user_id = (select auth.uid());
  return private.game_room_snapshot(target_room_id);
end;
$$;

create or replace function public.set_game_room_ready(target_room_id uuid, ready boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.game_room_players player
  set is_ready = case
    when player.user_id = room.host_user_id then true
    else ready
  end,
  last_seen_at = now()
  from public.game_rooms room
  where player.room_id = target_room_id
    and room.id = player.room_id
    and room.status = 'lobby'
    and player.user_id = (select auth.uid());

  if not found then
    raise exception using errcode = '42501', message = 'The room or player is not available.';
  end if;
  return private.game_room_snapshot(target_room_id);
end;
$$;

create or replace function public.start_game_room(target_room_id uuid, initial_state jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_count integer;
begin
  select count(*) into member_count
  from public.game_room_players
  where room_id = target_room_id;

  if member_count < 2 then
    raise exception using errcode = '22023', message = 'At least two players are required.';
  end if;
  if exists (
    select 1 from public.game_room_players
    where room_id = target_room_id and not is_ready
  ) then
    raise exception using errcode = '22023', message = 'Every player must be ready.';
  end if;
  if jsonb_typeof(initial_state) <> 'object' then
    raise exception using errcode = '22023', message = 'A valid initial game state is required.';
  end if;

  update public.game_rooms
  set status = 'playing', game_state = initial_state,
      state_version = state_version + 1, started_at = now()
  where id = target_room_id
    and host_user_id = (select auth.uid())
    and status = 'lobby';

  if not found then
    raise exception using errcode = '42501', message = 'Only the host can start this room.';
  end if;
  return private.game_room_snapshot(target_room_id);
end;
$$;

create or replace function public.update_game_room_state(
  target_room_id uuid,
  expected_version integer,
  next_state jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_player_user_id text;
begin
  if not private.is_game_room_member(target_room_id) then
    raise exception using errcode = '42501', message = 'You are not a member of this room.';
  end if;
  if jsonb_typeof(next_state) <> 'object' then
    raise exception using errcode = '22023', message = 'A valid game state is required.';
  end if;

  select room.game_state -> 'players' ->
    ((room.game_state ->> 'activePlayerIndex')::integer) ->> 'id'
  into active_player_user_id
  from public.game_rooms room
  where room.id = target_room_id;

  if active_player_user_id is distinct from (select auth.uid())::text then
    raise exception using errcode = '42501', message = 'Only the active player can update the game.';
  end if;

  update public.game_rooms
  set game_state = next_state,
      state_version = state_version + 1,
      status = case
        when next_state ->> 'status' = 'match-ended' then 'completed'::public.game_room_status
        else status
      end,
      completed_at = case
        when next_state ->> 'status' = 'match-ended' then now()
        else completed_at
      end
  where id = target_room_id
    and status = 'playing'
    and state_version = expected_version;

  if not found then
    raise exception using errcode = '40001', message = 'The game changed on another device. Sync and try again.';
  end if;
  return private.game_room_snapshot(target_room_id);
end;
$$;

create or replace function public.leave_game_room(target_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  room_host_id uuid;
begin
  select host_user_id into room_host_id
  from public.game_rooms
  where id = target_room_id;

  if room_host_id = current_user_id then
    update public.game_rooms
    set status = 'closed', completed_at = coalesce(completed_at, now())
    where id = target_room_id and status <> 'completed';
  else
    delete from public.game_room_players
    where room_id = target_room_id and user_id = current_user_id;
  end if;
end;
$$;

alter table public.game_rooms enable row level security;
alter table public.game_room_players enable row level security;

create policy "Members can view game rooms"
on public.game_rooms for select to authenticated
using (private.is_game_room_member(id));

create policy "Members can view room players"
on public.game_room_players for select to authenticated
using (private.is_game_room_member(room_id));

grant usage on type public.game_room_status to authenticated;
grant select on public.game_rooms to authenticated;
grant select on public.game_room_players to authenticated;
grant execute on function public.create_game_room(text, integer, text) to authenticated;
grant execute on function public.join_game_room(text, text) to authenticated;
grant execute on function public.get_game_room(uuid) to authenticated;
grant execute on function public.set_game_room_ready(uuid, boolean) to authenticated;
grant execute on function public.start_game_room(uuid, jsonb) to authenticated;
grant execute on function public.update_game_room_state(uuid, integer, jsonb) to authenticated;
grant execute on function public.leave_game_room(uuid) to authenticated;
grant all on public.game_rooms to service_role;
grant all on public.game_room_players to service_role;

revoke all on function public.create_game_room(text, integer, text) from public, anon;
revoke all on function public.join_game_room(text, text) from public, anon;
revoke all on function public.get_game_room(uuid) from public, anon;
revoke all on function public.set_game_room_ready(uuid, boolean) from public, anon;
revoke all on function public.start_game_room(uuid, jsonb) from public, anon;
revoke all on function public.update_game_room_state(uuid, integer, jsonb) from public, anon;
revoke all on function public.leave_game_room(uuid) from public, anon;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_rooms'
  ) then
    alter publication supabase_realtime add table public.game_rooms;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_room_players'
  ) then
    alter publication supabase_realtime add table public.game_room_players;
  end if;
end;
$$;
