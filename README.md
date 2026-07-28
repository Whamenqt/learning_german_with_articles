# German News Learning App — v1

Turn a news article into a German learning pack: paste a link, get an original
German adaptation with vocabulary, grammar notes, and conversation questions,
publish it on your own domain, and export a document you can upload to ChatGPT
for guided conversation practice.

**Version 1 does not call an AI API directly.** You paste a generated prompt
into your own ChatGPT or Claude account, then upload/paste the JSON it returns
back into this app. See [How generation works](#how-generation-works) below.

## Stack

- **Frontend:** React + TypeScript + Vite, React Router, deployed on Netlify
- **Backend:** Netlify Functions (article extraction, DOCX export)
- **Database/Auth/Storage:** Supabase (Postgres + Row Level Security, email/password auth)

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the migration in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   It creates the `articles`, `article_content`, `vocabulary`, `exports`, and
   `generation_logs` tables, enables Row Level Security, and creates a private
   `article-exports` storage bucket.
3. Create your admin account manually: **Authentication → Users → Add user**
   (email + password). There is no public sign-up in v1 — this is intentional.
4. Grab your project URL and anon key from **Settings → API**.

## 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_PUBLIC_SITE_URL`
(your custom domain once you've set it up in Netlify, e.g. `https://german.example.com`).

The anon key is safe to expose in the browser — every table is protected by
Row Level Security policies (owners see their own articles; the public can only
read articles that are `status = 'published' AND is_public = true`).

## 3. Run locally

```bash
npm install
npm run dev          # frontend only, at http://localhost:5173

# or, to also run the Netlify Functions locally:
npx netlify-cli dev  # proxies http://localhost:8888 -> Vite + local functions
```

## 4. Deploy to Netlify

1. Push this repo to GitHub/GitLab/Bitbucket and connect it as a new Netlify site
   (or run `netlify deploy` from the CLI).
2. Build command: `npm run build` · Publish directory: `dist` · Functions directory:
   `netlify/functions` (already set in `netlify.toml`).
3. Add the environment variables from `.env` in **Site settings → Environment variables**.
4. Add your custom domain in **Domain management**, then update `VITE_PUBLIC_SITE_URL`
   to match and redeploy.

## How generation works

Version 1 deliberately does **not** integrate with an AI API. The workflow is:

1. **Create Article** → paste a news URL, pick a level (A2/B1/B2, default B1),
   length (short/standard/detailed), and optional instructions.
2. The app extracts the article server-side (`netlify/functions/extract-article.ts`,
   using [Readability](https://github.com/mozilla/readability)). If extraction fails
   (paywall, cookie wall, JS-only site, blocked bot access, etc.), the **Generate**
   page lets you paste the title, publication, and article text manually — nothing
   entered is lost.
3. The **Generate** page shows a copyable prompt (`src/lib/chatgptPrompt.ts`) built
   from the source article + your chosen level/length/instructions. Paste it into
   your own ChatGPT or Claude account.
4. Copy the JSON the AI returns and either upload the `.json` file or paste it
   directly. It's validated against the schema in `src/lib/lessonSchema.ts`
   (`src/lib/lessonSchema.ts` mirrors the JSON shape requested in the prompt) before
   saving. Validation errors are shown inline so you can fix and re-paste — nothing
   is lost.
5. Once valid, the lesson is saved as a **draft** you can edit, then **publish**
   with an editable URL slug.

A worked example of the exact JSON shape (validated against the live schema) is
in [`docs/sample-lesson.json`](docs/sample-lesson.json) — useful for testing the
upload/paste step without waiting on a live AI response.

This keeps API keys, rate limits, and cost entirely out of the app for v1, while
still producing the same structured output a direct integration would.

## Copyright-safe by default

The prompt explicitly asks for an **original adaptation**, not a sentence-by-sentence
translation: it instructs the AI to summarise and re-express the article in its own
German wording, preserve facts/names/dates/statistics, and avoid copying long passages.
Every published page displays the original title, publication, link, and a notice
that the German text is an AI-generated learning adaptation.

## Project structure

```
netlify/functions/
  extract-article.ts   # POST { url } -> { source_title, source_text, ... } or an error code
  export-docx.ts        # POST { article, content, vocabulary } -> .docx binary
  _shared/http.ts        # small response helpers + source-text length guardrail

src/lib/
  types.ts               # ArticleRow / ArticleContentRow / VocabularyRow / LessonJSON
  lessonSchema.ts         # zod schema + validateLessonJson() for the manual JSON import
  chatgptPrompt.ts        # builds the copyable prompt for ChatGPT/Claude
  api.ts                  # all Supabase reads/writes (articles, content, vocabulary, publish, export)
  exportDocument.ts       # Markdown export (client-side) + DOCX export (calls the function)
  supabaseClient.ts, AuthContext.tsx, slug.ts

src/pages/
  admin/LoginPage.tsx, DashboardPage.tsx, NewArticlePage.tsx, GeneratePage.tsx, EditorPage.tsx
  public/ArticlePage.tsx, NotFoundPage.tsx

supabase/migrations/0001_init.sql   # schema + RLS policies + storage bucket
```

## Article statuses

`new → extracting → generating → draft → published`, with `error` reachable from
extraction or JSON-import failures (retryable, nothing lost), and `archived` as a
manual end state.

## What's intentionally out of scope for v1

Direct AI API integration, public sign-up, multiple learning profiles, teacher/student
roles, flashcards/spaced repetition, audio narration, scheduled/bulk imports, and
per-section "regenerate" buttons (in v1, re-running generation replaces the whole
lesson via a fresh prompt/JSON round-trip — see the "Re-run generation" link on the
editor page). See the original product spec for the full v2 backlog.

## Security notes

- Claude/ChatGPT credentials never touch this app — there's nothing to leak.
- `extract-article.ts` validates the URL (http/https only, blocks localhost/private
  IPs), applies a 15s timeout, and truncates source text to 40k characters.
- Row Level Security is the only thing standing between a draft and the public —
  double-check the policies in `0001_init.sql` if you change the schema.
- The Supabase **anon** key is the only credential shipped to the browser; there is
  no service-role key in this MVP (not needed — see `api.ts`).
