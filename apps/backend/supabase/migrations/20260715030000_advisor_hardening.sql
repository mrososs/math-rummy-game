revoke all on function public.handle_new_user() from public, anon, authenticated;

create index match_rounds_winner_player_id_idx
  on public.match_rounds(winner_player_id)
  where winner_player_id is not null;

create index match_saves_host_user_id_idx
  on public.match_saves(host_user_id);

create index matches_winner_user_id_idx
  on public.matches(winner_user_id)
  where winner_user_id is not null;
