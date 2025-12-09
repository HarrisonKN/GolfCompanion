-- Create user_spotify_tokens table to store encrypted refresh tokens
create table if not exists public.user_spotify_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  refresh_token text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id)
);

-- Enable RLS
alter table public.user_spotify_tokens enable row level security;

-- RLS Policy: Users can only read/modify their own tokens
create policy "Users can manage their own Spotify tokens"
on public.user_spotify_tokens
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Create index for faster lookups
create index if not exists idx_user_spotify_tokens_user_id
on public.user_spotify_tokens(user_id);
