-- German News Learning App — initial schema (Version 1 / MVP)
-- Run this in the Supabase SQL editor, or via `supabase db push` if you use the CLI.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- articles
-- ---------------------------------------------------------------------------
create table if not exists public.articles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,

  source_url          text not null,
  source_title        text,
  source_publication  text,
  source_author       text,
  source_date         date,
  source_text         text,
  source_image_url    text,
  source_description  text,

  german_title        text,
  slug                text unique,
  language_level      text not null default 'B1' check (language_level in ('A2','B1','B2')),
  article_length      text not null default 'standard' check (article_length in ('short','standard','detailed')),
  custom_instructions text,
  vocabulary_focus    text,

  status              text not null default 'new'
                        check (status in ('new','extracting','generating','draft','published','error','archived')),
  is_public           boolean not null default false,
  allow_indexing      boolean not null default false,
  error_message       text,

  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists articles_user_id_idx on public.articles(user_id);
create index if not exists articles_status_idx on public.articles(status);
create unique index if not exists articles_slug_idx on public.articles(slug) where slug is not null;

-- ---------------------------------------------------------------------------
-- article_content  (the structured lesson body; JSONB for flexible sections)
-- ---------------------------------------------------------------------------
create table if not exists public.article_content (
  id                          uuid primary key default gen_random_uuid(),
  article_id                  uuid not null references public.articles(id) on delete cascade,

  introduction                text not null default '',
  german_article               text not null default '',
  english_summary              text not null default '',
  grammar_notes                jsonb not null default '[]'::jsonb,
  useful_phrases                jsonb not null default '[]'::jsonb,
  comprehension_questions       jsonb not null default '[]'::jsonb,
  conversation_questions        jsonb not null default '{"opinion":[],"personal":[]}'::jsonb,
  difficult_concepts            jsonb not null default '[]'::jsonb,
  chatgpt_instructions          text not null default '',

  generation_model             text,
  generation_prompt_version    text,

  created_at                   timestamptz not null default now()
);

create unique index if not exists article_content_article_id_idx on public.article_content(article_id);

-- ---------------------------------------------------------------------------
-- vocabulary
-- ---------------------------------------------------------------------------
create table if not exists public.vocabulary (
  id                 uuid primary key default gen_random_uuid(),
  article_id         uuid not null references public.articles(id) on delete cascade,

  german_term        text not null,
  article            text,          -- der / die / das
  plural             text,
  english_meaning    text not null,
  german_explanation text not null,
  example_sentence   text not null,
  word_type          text not null default 'noun',
  difficulty         text not null default 'B1' check (difficulty in ('A2','B1','B2')),
  is_essential       boolean not null default true,
  sort_order         integer not null default 0
);

create index if not exists vocabulary_article_id_idx on public.vocabulary(article_id);

-- ---------------------------------------------------------------------------
-- exports
-- ---------------------------------------------------------------------------
create table if not exists public.exports (
  id             uuid primary key default gen_random_uuid(),
  article_id     uuid not null references public.articles(id) on delete cascade,
  format         text not null check (format in ('docx','markdown')),
  storage_path   text,
  created_at     timestamptz not null default now()
);

create index if not exists exports_article_id_idx on public.exports(article_id);

-- ---------------------------------------------------------------------------
-- generation_logs
-- ---------------------------------------------------------------------------
create table if not exists public.generation_logs (
  id               uuid primary key default gen_random_uuid(),
  article_id       uuid not null references public.articles(id) on delete cascade,
  generation_type  text not null check (generation_type in ('extraction','ai_generation_import','export','publish')),
  status           text not null check (status in ('started','success','error')),
  error_message    text,
  model            text,
  created_at       timestamptz not null default now()
);

create index if not exists generation_logs_article_id_idx on public.generation_logs(article_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger for articles
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.articles          enable row level security;
alter table public.article_content   enable row level security;
alter table public.vocabulary        enable row level security;
alter table public.exports           enable row level security;
alter table public.generation_logs   enable row level security;

-- Admin (owner) full access: any authenticated user can manage their own articles.
-- Version 1 has a single manually-created admin account, but this scales cleanly
-- to multiple admins later (each user only ever sees their own rows).
create policy "owners manage their articles"
  on public.articles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owners manage content for their articles"
  on public.article_content for all
  using (exists (select 1 from public.articles a where a.id = article_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.articles a where a.id = article_id and a.user_id = auth.uid()));

create policy "owners manage vocabulary for their articles"
  on public.vocabulary for all
  using (exists (select 1 from public.articles a where a.id = article_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.articles a where a.id = article_id and a.user_id = auth.uid()));

create policy "owners manage exports for their articles"
  on public.exports for all
  using (exists (select 1 from public.articles a where a.id = article_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.articles a where a.id = article_id and a.user_id = auth.uid()));

create policy "owners manage generation logs for their articles"
  on public.generation_logs for all
  using (exists (select 1 from public.articles a where a.id = article_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.articles a where a.id = article_id and a.user_id = auth.uid()));

-- Public (anonymous) read access: ONLY published + is_public articles, and only
-- their content/vocabulary. Drafts are never selectable by anon/public role.
create policy "public can read published articles"
  on public.articles for select
  to anon
  using (status = 'published' and is_public = true);

create policy "public can read content of published articles"
  on public.article_content for select
  to anon
  using (exists (
    select 1 from public.articles a
    where a.id = article_id and a.status = 'published' and a.is_public = true
  ));

create policy "public can read vocabulary of published articles"
  on public.vocabulary for select
  to anon
  using (exists (
    select 1 from public.articles a
    where a.id = article_id and a.status = 'published' and a.is_public = true
  ));

-- ---------------------------------------------------------------------------
-- Storage bucket for generated exports (DOCX files, etc.)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('article-exports', 'article-exports', false)
on conflict (id) do nothing;

create policy "owners can read their export files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'article-exports' and owner = auth.uid());

create policy "owners can upload their export files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'article-exports' and owner = auth.uid());
