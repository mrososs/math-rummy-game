-- Lets the game-command Edge Function recognize an already-applied actionId
-- before it replays the command through the engine, so a client retry after a
-- timeout is a no-op idempotent success rather than a rejected "not your turn".
create or replace function public.peek_command_version(
  target_room_id uuid,
  action_id text
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select result_version
  from private.game_action_log
  where room_id = target_room_id
    and action_id = peek_command_version.action_id
    and accepted
  limit 1;
$$;

revoke all on function public.peek_command_version(uuid, text) from public, anon, authenticated;
grant execute on function public.peek_command_version(uuid, text) to service_role;
