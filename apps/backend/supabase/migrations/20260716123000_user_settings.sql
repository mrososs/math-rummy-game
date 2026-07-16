-- Per-user game settings, persisted so preferences follow the player across
-- devices. Owner-only RLS: a player can read and write only their own row.
create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute procedure private.set_updated_at();

create policy "Owners read their settings"
on public.user_settings for select to authenticated
using (user_id = (select auth.uid()));

create policy "Owners insert their settings"
on public.user_settings for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Owners update their settings"
on public.user_settings for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant select, insert, update on public.user_settings to authenticated;
grant all on public.user_settings to service_role;
