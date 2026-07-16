-- Fix: in commit_game_command the unqualified `action_id` in the idempotency
-- lookup is ambiguous between the game_action_log column and the function
-- parameter (plpgsql raises "column reference \"action_id\" is ambiguous").
-- Qualify the column references. CREATE OR REPLACE preserves grants.
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
  select * into existing
  from private.game_action_log log
  where log.room_id = target_room_id
    and log.action_id = commit_game_command.action_id;
  if found then
    return jsonb_build_object(
      'stateVersion', existing.result_version,
      'duplicate', true
    );
  end if;

  select gs.state_version into current_version
  from private.game_states gs
  where gs.room_id = target_room_id
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

  update private.game_states gs
  set state = next_private_state,
      state_version = new_version,
      seed = coalesce(next_seed, gs.seed),
      updated_at = now()
  where gs.room_id = target_room_id;

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
    commit_game_command.command_type, new_version, true
  );

  return jsonb_build_object('stateVersion', new_version, 'duplicate', false);
end;
$$;
