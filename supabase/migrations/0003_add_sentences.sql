-- Sentence Practice tool — 100 English/German sentence pairs per CEFR level (A2/B1/B2),
-- with click-to-reveal translation in either direction on the public site.

create table if not exists public.sentences (
  id          uuid primary key default gen_random_uuid(),
  level       text not null check (level in ('A2','B1','B2')),
  english     text not null,
  german      text not null,
  notes       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists sentences_level_idx on public.sentences(level);

alter table public.sentences enable row level security;

-- Public (anonymous) read access — this is a practice tool, no drafts/gating needed.
create policy "public can read sentences"
  on public.sentences for select
  to anon
  using (true);

-- Admin (any authenticated user) can manage sentences, consistent with the
-- single-admin model used elsewhere in this app.
create policy "authenticated can manage sentences"
  on public.sentences for all
  to authenticated
  using (true)
  with check (true);
