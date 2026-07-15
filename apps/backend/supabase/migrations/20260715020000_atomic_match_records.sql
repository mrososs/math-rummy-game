create or replace function public.record_completed_match(
  completed_room_code text,
  requested_transport text,
  winning_user_id uuid,
  match_started_at timestamptz,
  match_metadata jsonb,
  player_summaries jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_match_id uuid;
  player_count integer;
  stored_transport public.local_transport;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;
  if upper(completed_room_code) !~ '^[A-Z0-9]{4}$' then
    raise exception using errcode = '22023', message = 'A valid room code is required.';
  end if;
  if jsonb_typeof(player_summaries) <> 'array' then
    raise exception using errcode = '22023', message = 'Player summaries must be an array.';
  end if;

  player_count := jsonb_array_length(player_summaries);
  if player_count not between 2 and 8 then
    raise exception using errcode = '22023', message = 'A match must contain between 2 and 8 players.';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(player_summaries) player
    where nullif(player ->> 'userId', '')::uuid = current_user_id
      and coalesce((player ->> 'isHost')::boolean, false)
  ) then
    raise exception using errcode = '42501', message = 'The signed-in player must be the match host.';
  end if;
  if winning_user_id is not null and not exists (
    select 1
    from jsonb_array_elements(player_summaries) player
    where nullif(player ->> 'userId', '')::uuid = winning_user_id
  ) then
    raise exception using errcode = '22023', message = 'The winner must be a match player.';
  end if;

  stored_transport := case requested_transport
    when 'bluetooth' then 'bluetooth'::public.local_transport
    when 'hotspot' then 'hotspot'::public.local_transport
    else 'wifi'::public.local_transport
  end;

  insert into public.matches (
    host_user_id,
    room_code,
    status,
    transport,
    player_count,
    winner_user_id,
    started_at,
    ended_at,
    metadata
  ) values (
    current_user_id,
    upper(completed_room_code),
    'completed',
    stored_transport,
    player_count,
    winning_user_id,
    coalesce(match_started_at, now()),
    now(),
    coalesce(match_metadata, '{}'::jsonb)
  ) returning id into created_match_id;

  insert into public.match_players (
    match_id,
    user_id,
    display_name,
    seat,
    is_host,
    final_phase,
    score,
    placement
  )
  select
    created_match_id,
    nullif(player ->> 'userId', '')::uuid,
    btrim(player ->> 'displayName'),
    (player ->> 'seat')::smallint,
    coalesce((player ->> 'isHost')::boolean, false),
    (player ->> 'finalPhase')::smallint,
    (player ->> 'score')::integer,
    nullif(player ->> 'placement', '')::smallint
  from jsonb_array_elements(player_summaries) player;

  update public.profiles profile
  set games_played = games_played + 1,
      games_won = games_won + case when profile.id = winning_user_id then 1 else 0 end
  where profile.id in (
    select nullif(player ->> 'userId', '')::uuid
    from jsonb_array_elements(player_summaries) player
    where nullif(player ->> 'userId', '') is not null
  );

  return created_match_id;
end;
$$;

grant execute on function public.record_completed_match(
  text, text, uuid, timestamptz, jsonb, jsonb
) to authenticated;
revoke all on function public.record_completed_match(
  text, text, uuid, timestamptz, jsonb, jsonb
) from public, anon;
