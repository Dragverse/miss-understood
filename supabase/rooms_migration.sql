-- Vibe Lounge: audio chat rooms
-- Run this in Supabase SQL Editor

create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  room_id       text not null unique,          -- Huddle01 room ID
  title         text not null,
  description   text,
  tags          text[] default '{}',
  privacy       text not null default 'public' check (privacy in ('public', 'private')),
  creator_did   text not null,                 -- references profiles.creator_did
  is_live       boolean not null default true,
  created_at    timestamptz not null default now(),
  ended_at      timestamptz
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

-- Only authenticated users can create rooms
create policy "Authenticated users can create rooms"
  on public.rooms for insert
  to authenticated
  with check (true);

-- Only the creator can update/end their room
create policy "Creators can update their own rooms"
  on public.rooms for update
  to authenticated
  using (creator_did = (
    select creator_did from public.profiles
    where id = auth.uid()
  ));
