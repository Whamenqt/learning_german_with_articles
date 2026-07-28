import { supabase } from './supabaseClient'
import { slugify } from './slug'
import type {
  ArticleContentRow,
  ArticleLength,
  ArticleRow,
  ArticleStatus,
  FullArticle,
  LanguageLevel,
  LessonJSON,
  Quiz,
  VocabularyRow,
} from './types'

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export async function fetchArticles(): Promise<ArticleRow[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as ArticleRow[]
}

export async function fetchArticleFull(articleId: string): Promise<FullArticle> {
  const [{ data: article, error: articleError }, { data: content, error: contentError }, { data: vocabulary, error: vocabError }] =
    await Promise.all([
      supabase.from('articles').select('*').eq('id', articleId).single(),
      supabase.from('article_content').select('*').eq('article_id', articleId).maybeSingle(),
      supabase.from('vocabulary').select('*').eq('article_id', articleId).order('sort_order', { ascending: true }),
    ])

  if (articleError) throw articleError
  if (contentError) throw contentError
  if (vocabError) throw vocabError

  return {
    article: article as ArticleRow,
    content: (content as ArticleContentRow | null) ?? null,
    vocabulary: (vocabulary as VocabularyRow[]) ?? [],
  }
}

export interface NewArticleInput {
  userId: string
  sourceUrl: string
  languageLevel: LanguageLevel
  articleLength: ArticleLength
  customInstructions?: string
  vocabularyFocus?: string
  customTitle?: string
}

export async function createArticleDraft(input: NewArticleInput): Promise<ArticleRow> {
  const { data, error } = await supabase
    .from('articles')
    .insert({
      user_id: input.userId,
      source_url: input.sourceUrl,
      language_level: input.languageLevel,
      article_length: input.articleLength,
      custom_instructions: input.customInstructions || null,
      vocabulary_focus: input.vocabularyFocus || null,
      german_title: input.customTitle || null,
      status: 'new',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as ArticleRow
}

export async function updateArticleFields(articleId: string, patch: Partial<ArticleRow>): Promise<ArticleRow> {
  const { data, error } = await supabase.from('articles').update(patch).eq('id', articleId).select('*').single()
  if (error) throw error
  return data as ArticleRow
}

export async function setArticleStatus(articleId: string, status: ArticleStatus, errorMessage?: string | null) {
  return updateArticleFields(articleId, { status, error_message: errorMessage ?? null })
}

export async function deleteArticle(articleId: string) {
  const { error } = await supabase.from('articles').delete().eq('id', articleId)
  if (error) throw error
}

export async function archiveArticle(articleId: string) {
  return updateArticleFields(articleId, { status: 'archived', is_public: false })
}

export async function duplicateArticle(article: ArticleRow): Promise<ArticleRow> {
  const { data, error } = await supabase
    .from('articles')
    .insert({
      user_id: article.user_id,
      source_url: article.source_url,
      source_title: article.source_title,
      source_publication: article.source_publication,
      source_author: article.source_author,
      source_date: article.source_date,
      source_text: article.source_text,
      source_image_url: article.source_image_url,
      source_description: article.source_description,
      language_level: article.language_level,
      article_length: article.article_length,
      custom_instructions: article.custom_instructions,
      vocabulary_focus: article.vocabulary_focus,
      status: 'new',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as ArticleRow
}

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

export async function isSlugAvailable(slug: string, excludeArticleId?: string): Promise<boolean> {
  let query = supabase.from('articles').select('id').eq('slug', slug)
  if (excludeArticleId) query = query.neq('id', excludeArticleId)
  const { data, error } = await query.maybeSingle()
  if (error && error.code !== 'PGRST116') throw error
  return !data
}

export async function suggestUniqueSlug(base: string, excludeArticleId?: string): Promise<string> {
  const root = slugify(base) || 'article'
  let candidate = root
  let attempt = 1
  while (!(await isSlugAvailable(candidate, excludeArticleId))) {
    attempt += 1
    candidate = `${root}-${attempt}`
  }
  return candidate
}

// ---------------------------------------------------------------------------
// Generated content (the manual JSON import step)
// ---------------------------------------------------------------------------

export async function saveGeneratedContent(articleId: string, lesson: LessonJSON, model?: string): Promise<void> {
  const { error: upsertError } = await supabase.from('article_content').upsert(
    {
      article_id: articleId,
      introduction: lesson.introduction,
      german_article: lesson.german_article,
      english_summary: lesson.english_summary,
      grammar_notes: lesson.grammar_notes,
      useful_phrases: lesson.useful_phrases,
      comprehension_questions: lesson.comprehension_questions,
      conversation_questions: lesson.conversation_questions,
      difficult_concepts: lesson.difficult_concepts,
      chatgpt_instructions: lesson.chatgpt_instructions,
      quiz: lesson.quiz ?? null,
      generation_model: model ?? 'manual-import',
      generation_prompt_version: 'v1',
    },
    { onConflict: 'article_id' },
  )
  if (upsertError) throw upsertError

  // Replace vocabulary wholesale for simplicity (MVP): delete then insert.
  const { error: deleteError } = await supabase.from('vocabulary').delete().eq('article_id', articleId)
  if (deleteError) throw deleteError

  if (lesson.vocabulary.length > 0) {
    const { error: insertError } = await supabase.from('vocabulary').insert(
      lesson.vocabulary.map((item, index) => ({
        article_id: articleId,
        german_term: item.german_term,
        article: item.article ?? null,
        plural: item.plural ?? null,
        english_meaning: item.english_meaning,
        german_explanation: item.german_explanation,
        example_sentence: item.example_sentence,
        word_type: item.word_type,
        difficulty: item.difficulty,
        is_essential: item.is_essential,
        sort_order: index,
      })),
    )
    if (insertError) throw insertError
  }

  const suggestedSlug = await suggestUniqueSlug(lesson.german_headline, articleId)
  await updateArticleFields(articleId, {
    german_title: lesson.german_headline,
    slug: suggestedSlug,
    status: 'draft',
    error_message: null,
    source_title: lesson.source.title,
    source_publication: lesson.source.publication,
    source_url: lesson.source.url,
    source_author: lesson.source.author ?? null,
    source_date: lesson.source.published_date ?? null,
  })
}

// ---------------------------------------------------------------------------
// Editor: saving hand-edited content (as opposed to a fresh AI import above)
// ---------------------------------------------------------------------------

export type EditableContent = Omit<
  ArticleContentRow,
  'id' | 'article_id' | 'generation_model' | 'generation_prompt_version' | 'created_at'
>

export async function updateArticleContent(articleId: string, content: EditableContent): Promise<void> {
  const { error } = await supabase.from('article_content').upsert(
    {
      article_id: articleId,
      ...content,
    },
    { onConflict: 'article_id' },
  )
  if (error) throw error
}

/**
 * Saves just the quiz (grammar + comprehension multiple-choice segments) for an
 * article, without touching the rest of the lesson content. Used by the
 * Editor page's "paste quiz JSON" import, which lets the admin add/replace a
 * quiz for an article independently of a full re-generation.
 */
export async function saveQuiz(articleId: string, quiz: Quiz): Promise<void> {
  const { error } = await supabase
    .from('article_content')
    .update({ quiz })
    .eq('article_id', articleId)
  if (error) throw error
}

export async function replaceVocabulary(articleId: string, items: VocabularyRow[]): Promise<void> {
  const { error: deleteError } = await supabase.from('vocabulary').delete().eq('article_id', articleId)
  if (deleteError) throw deleteError

  if (items.length === 0) return

  const { error: insertError } = await supabase.from('vocabulary').insert(
    items.map((item, index) => ({
      article_id: articleId,
      german_term: item.german_term,
      article: item.article ?? null,
      plural: item.plural ?? null,
      english_meaning: item.english_meaning,
      german_explanation: item.german_explanation,
      example_sentence: item.example_sentence,
      word_type: item.word_type,
      difficulty: item.difficulty,
      is_essential: item.is_essential,
      sort_order: index,
    })),
  )
  if (insertError) throw insertError
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export async function publishArticle(articleId: string, slug: string, allowIndexing: boolean): Promise<ArticleRow> {
  const available = await isSlugAvailable(slug, articleId)
  if (!available) {
    throw new Error(`The slug "${slug}" is already in use by another article.`)
  }
  return updateArticleFields(articleId, {
    slug,
    status: 'published',
    is_public: true,
    allow_indexing: allowIndexing,
    published_at: new Date().toISOString(),
  })
}

export async function unpublishArticle(articleId: string): Promise<ArticleRow> {
  return updateArticleFields(articleId, { status: 'draft', is_public: false })
}

// ---------------------------------------------------------------------------
// Public read (used by the public article page; runs under the `anon` RLS policy)
// ---------------------------------------------------------------------------

export async function fetchPublishedArticleBySlug(slug: string): Promise<FullArticle | null> {
  const { data: article, error: articleError } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('is_public', true)
    .maybeSingle()

  if (articleError) throw articleError
  if (!article) return null

  const [{ data: content, error: contentError }, { data: vocabulary, error: vocabError }] = await Promise.all([
    supabase.from('article_content').select('*').eq('article_id', article.id).maybeSingle(),
    supabase.from('vocabulary').select('*').eq('article_id', article.id).order('sort_order', { ascending: true }),
  ])
  if (contentError) throw contentError
  if (vocabError) throw vocabError

  return {
    article: article as ArticleRow,
    content: (content as ArticleContentRow | null) ?? null,
    vocabulary: (vocabulary as VocabularyRow[]) ?? [],
  }
}

// ---------------------------------------------------------------------------
// Generation logs (lightweight audit trail)
// ---------------------------------------------------------------------------

export async function logGeneration(
  articleId: string,
  generationType: 'extraction' | 'ai_generation_import' | 'export' | 'publish',
  status: 'started' | 'success' | 'error',
  errorMessage?: string,
  model?: string,
) {
  const { error } = await supabase.from('generation_logs').insert({
    article_id: articleId,
    generation_type: generationType,
    status,
    error_message: errorMessage ?? null,
    model: model ?? null,
  })
  // Logging failures shouldn't block the main workflow.
  if (error) console.error('logGeneration failed', error)
}

export async function recordExport(articleId: string, format: 'docx' | 'markdown', storagePath?: string) {
  const { error } = await supabase.from('exports').insert({
    article_id: articleId,
    format,
    storage_path: storagePath ?? null,
  })
  if (error) console.error('recordExport failed', error)
}
