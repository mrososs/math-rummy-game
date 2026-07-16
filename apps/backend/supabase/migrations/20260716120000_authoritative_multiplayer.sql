-- Server-authoritative multiplayer boundary (remediation F-01, F-02).
--
-- Before: the host client shuffled/dealt locally and uploaded the whole match
-- via start_game_room(initial_state); the active client uploaded the complete
-- next state via update_game_room_state(next_state); private.game_room_snapshot
-- returned that full state (every hand + deck order) to all room members.
--
-- After: the authoritative match (deck order, every hand, the shuffle seed)
-- lives in private.game_states, which is never exposed through the Data API.
-- public.game_rooms.game_state now holds only a sanitized PUBLIC projection
-- (turn, phase, public melds, scores, discard top, deck count, per-player card
-- counts). Edge Functions (service_role) load the private state, replay the
-- command through the shared engine, and commit atomically with a version check
-- via the commit_* functions below. Signed-in users can no longer read private
-- state or write a complete game state.

-- 1) Private authoritative game state ---------------------------------------

create table private.game_states (
  room_id uuid primary key references public.game_rooms(id) on delete cascade,
  state jsonb not null,
  state_version integer not null default 1 check (state_version > 0),
  seed text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Belt-and-braces: the private schema is not exposed via PostgREST, and RLS with
-- no policies means no role could select these rows even if it ever were.
alter table private.game_states enable row level security;

create trigger game_states_set_updated_at
  before update on private.game_states
  for each row execute procedure private.set_updated_at();

-- 2) Idempotency + rejected-command audit log -------------------------------

create table private.game_action_log (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  action_id text not null check (char_length(action_id) between 1 and 100),
  user_id uuid not null,
  command_type text not null,
  result_version integer,
  accepted boolean not null default true,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (room_id, action_id)
);

alter table private.game_action_log enable row level security;

create index game_action_log_room_idx
  on private.game_action_log(room_id, created_at desc);

grant usage on schema private to service_role;
grant all on private.game_states to service_role;
grant all on private.game_action_log to service_role;

-- 3) Sanitized room snapshot -------------------------------------------------
-- Reads per-player card counts from the PUBLIC projection now stored in
-- game_rooms.game_state instead of from private hands.

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
              select (public_player ->> 'cardCount')::integer
              from jsonb_array_elements(
                coalesce(room.game_state -> 'players', '[]'::jsonb)
              ) public_player
              where public_player ->> 'id' = player.user_id::text
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

-- 4) Service-role-only authoritative read/commit -----------------------------
-- These live in public (so the Edge Function's service_role client can call
-- them over PostgREST) but EXECUTE is granted only to service_role. They are
-- never callable by anon/authenticated, so they do not widen the client API
-- and do not trip the "authenticated can execute SECURITY DEFINER" advisor.

create or replace function public.read_authoritative_game_state(target_room_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'roomId', room.id,
    'roomStatus', room.status::text,
    'hostId', room.host_user_id,
    'maxPlayers', room.max_players,
    'stateVersion', coalesce(state.state_version, room.state_version),
    'seed', state.seed,
    'state', state.state,
    'players', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', player.user_id,
          'name', player.display_name,
          'seat', player.seat,
          'isReady', player.is_ready,
          'isHost', player.user_id = room.host_user_id
        )
        order by player.seat
      )
      from public.game_room_players player
      where player.room_id = room.id
    ), '[]'::jsonb)
  )
  from public.game_rooms room
  left join private.game_states state on state.room_id = room.id
  where room.id = target_room_id;
$$;

create or replace function public.commit_game_start(
  target_room_id uuid,
  host_id uuid,
  private_state jsonb,
  public_state jsonb,
  game_seed text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_rows integer;
begin
  update public.game_rooms
  set status = 'playing',
      game_state = public_state,
      state_version = 1,
      started_at = now()
  where id = target_room_id
    and host_user_id = host_id
    and status = 'lobby';

  get diagnostics updated_rows = row_count;
  if updated_rows = 0 then
    raise exception using errcode = '42501',
      message = 'Only the host can start a room that is still in the lobby.';
  end if;

  insert into private.game_states (room_id, state, state_version, seed)
  values (target_room_id, private_state, 1, game_seed)
  on conflict (room_id) do update
    set state = excluded.state,
        state_version = 1,
        seed = excluded.seed,
        updated_at = now();

  delete from private.game_action_log where room_id = target_room_id;

  return jsonb_build_object('stateVersion', 1);
end;
$$;

create or replace function public.commit_game_command(
  target_room_id uuid,
  expected_version integer,
  action_id text,
  actor_id uuid,
  command_type text,
  next_private_state jsonb,
  next_public_state jsonb,
  next_seed text,
  next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing private.game_action_log%rowtype;
  current_version integer;
  new_version integer;
  mapped_status public.game_room_status;
begin
  -- Idempotency: a replayed actionId returns the version it already produced.
  select * into existing
  from private.game_action_log
  where room_id = target_room_id
    and action_id = commit_game_command.action_id;
  if found then
    return jsonb_build_object(
      'stateVersion', existing.result_version,
      'duplicate', true
    );
  end if;

  -- Lock the authoritative row for the version check.
  select state_version into current_version
  from private.game_states
  where room_id = target_room_id
  for update;

  if current_version is null then
    raise exception using errcode = 'P0002',
      message = 'This game has not been started yet.';
  end if;
  if current_version <> expected_version then
    raise exception using errcode = '40001',
      message = 'The game changed on another device. Sync and try again.';
  end if;

  new_version := current_version + 1;

  update private.game_states
  set state = next_private_state,
      state_version = new_version,
      seed = coalesce(next_seed, seed),
      updated_at = now()
  where room_id = target_room_id;

  mapped_status := case next_status
    when 'match-ended' then 'completed'::public.game_room_status
    else 'playing'::public.game_room_status
  end;

  update public.game_rooms
  set game_state = next_public_state,
      state_version = new_version,
      status = mapped_status,
      completed_at = case
        when next_status = 'match-ended' then now()
        else completed_at
      end
  where id = target_room_id;

  insert into private.game_action_log (
    room_id, action_id, user_id, command_type, result_version, accepted
  ) values (
    target_room_id, commit_game_command.action_id, actor_id,
    command_type, new_version, true
  );

  return jsonb_build_object('stateVersion', new_version, 'duplicate', false);
end;
$$;

-- Records a rejected command for observability without mutating state.
create or replace function public.log_rejected_command(
  target_room_id uuid,
  action_id text,
  actor_id uuid,
  command_type text,
  reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.game_action_log (
    room_id, action_id, user_id, command_type, accepted, detail
  ) values (
    target_room_id,
    coalesce(nullif(action_id, ''), gen_random_uuid()::text),
    actor_id,
    command_type,
    false,
    jsonb_build_object('reason', left(coalesce(reason, ''), 500))
  )
  on conflict (room_id, action_id) do nothing;
end;
$$;

-- 5) Lock down execution -----------------------------------------------------

revoke all on function public.read_authoritative_game_state(uuid) from public, anon, authenticated;
revoke all on function public.commit_game_start(uuid, uuid, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.commit_game_command(uuid, integer, text, uuid, text, jsonb, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.log_rejected_command(uuid, text, uuid, text, text) from public, anon, authenticated;

grant execute on function public.read_authoritative_game_state(uuid) to service_role;
grant execute on function public.commit_game_start(uuid, uuid, jsonb, jsonb, text) to service_role;
grant execute on function public.commit_game_command(uuid, integer, text, uuid, text, jsonb, jsonb, text, text) to service_role;
grant execute on function public.log_rejected_command(uuid, text, uuid, text, text) to service_role;

-- 6) Remove the client-authoritative RPCs (F-02) -----------------------------
-- The client no longer uploads a complete initial or next game state; it sends
-- validated commands to the start-game / game-command Edge Functions instead.

drop function if exists public.start_game_room(uuid, jsonb);
drop function if exists public.update_game_room_state(uuid, integer, jsonb);
