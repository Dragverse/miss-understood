-- Vibe Lounge: audio chat rooms
-- Run this in Supabase SQL Editor

create table if not exists public.rooms (
  id              uuid primary key default gen_random_uuid(),
  huddle_room_id  text not null unique,         -- Huddle01 room ID
  title           text not null,
  description     text,
  tags            text[] default '{}',
  privacy         text not null default 'public' check (privacy in ('public', 'private')),
  creator_did     text not null references public.creators(did) on delete restrict,
  is_live         boolean not null default true,
  listener_count  integer not null default 0,
  created_at      timestamptz not null default now(),
  ended_at        timestamptz
);

-- Index for fast live-room queries
create index if not exists rooms_is_live_created_at_idx
  on public.rooms (is_live, created_at desc)
  where is_live = true;

-- RLS
alter table public.rooms enable row level security;

-- Anyone can read public live rooms
create policy "Public rooms are readable by all"
  on public.rooms for select
  using (privacy = 'public' or auth.uid() is not null);

-- API routes use service role key which bypasses RLS,
-- so insert/update policies are permissive fallbacks only
create policy "Service role can insert rooms"
  on public.rooms for insert
  with check (true);

create policy "Service role can update rooms"
  on public.rooms for update
  using (true);
