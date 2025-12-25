-- Create golf_gear table for persistent gear storage
create table if not exists public.golf_gear (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null check (type in ('driver','irons','wedges','putter','ball','bag','other')),
  brand text not null,
  model text not null,
  notes text,
  created_at timestamptz not null default now()
);

-- Optional FK to auth.users (Supabase)
alter table public.golf_gear
  add constraint golf_gear_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

-- Enable RLS
alter table public.golf_gear enable row level security;

-- Policies
-- Owners can manage their own gear
create policy if not exists "gear_owner_read"
  on public.golf_gear for select
  using (auth.uid() = user_id);

create policy if not exists "gear_owner_write"
  on public.golf_gear for insert
  with check (auth.uid() = user_id);

create policy if not exists "gear_owner_update"
  on public.golf_gear for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists "gear_owner_delete"
  on public.golf_gear for delete
  using (auth.uid() = user_id);

-- Allow authenticated users to view any user's gear
-- (simplifies friend viewing without complex friendship policies)
create policy if not exists "gear_any_auth_read"
  on public.golf_gear for select
  to authenticated
  using (true);
