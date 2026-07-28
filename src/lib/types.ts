// Core domain types, mirroring the Supabase schema in supabase/migrations/0001_init.sql

export type LanguageLevel = 'A2' | 'B1' | 'B2'
export type ArticleLength = 'short' | 'standard' | 'detailed'

export type ArticleStatus =
  | 'new'
  | 'extracting'
  | 'generating'
  | 'draft'
  | 'published'
  | 'error'
  | 'archived'

export interface ArticleRow {
  id: string
  user_id: string
  source_url: string
  source_title: string | null
  source_publication: string | null
  source_author: string | null
  source_date: string | null
  source_text: string | null
  source_image_url: string | null
  source_description: string | null
  german_title: string | null
  slug: string | null
  language_level: LanguageLevel
  article_length: ArticleLength
  custom_instructions: string | null
  vocabulary_focus: string | null
  status: ArticleStatus
  is_public: boolean
  allow_indexing: boolean
  error_message: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface VocabularyItem {
  german_term: string
  article?: string | null // der/die/das for nouns
  plural?: string | null
  english_meaning: string
  german_explanation: string
  example_sentence: string
  word_type: string // noun, verb, adjective, adverb, connector, phrase...
  difficulty: LanguageLevel
  is_essential: boolean
}

export interface UsefulPhrase {
  german_phrase: string
  english_meaning: string
  example_sentence: string
}

export interface GrammarNote {
  topic: string
  explanation: string
  example: string
}

export interface DifficultConcept {
  term: string
  explanation_en: string
}

export interface ConversationQuestions {
  opinion: string[]
  personal: string[]
}

export interface SourceAttribution {
  title: string
  publication: string
  url: string
  author?: string | null
  published_date?: string | null
}

export type QuizDifficulty = 'easy' | 'medium' | 'hard'

export interface QuizQuestion {
  question: string
  options: string[] // exactly 4 options
  correct_index: number // 0-3
  difficulty: QuizDifficulty
  explanation?: string | null
}

/** Two segments: grammar (correct-grammar selection) and comprehension (pure understanding). */
export interface Quiz {
  grammar: QuizQuestion[]
  comprehension: QuizQuestion[]
}

/** The structured lesson payload produced by ChatGPT/Claude and uploaded/pasted by the admin. */
export interface LessonJSON {
  german_headline: string
  introduction: string
  german_article: string
  vocabulary: VocabularyItem[]
  useful_phrases: UsefulPhrase[]
  grammar_notes: GrammarNote[]
  comprehension_questions: string[]
  conversation_questions: ConversationQuestions
  english_summary: string
  difficult_concepts: DifficultConcept[]
  chatgpt_instructions: string
  source: SourceAttribution
  quiz?: Quiz
}

export interface ArticleContentRow {
  id: string
  article_id: string
  introduction: string
  german_article: string
  english_summary: string
  grammar_notes: GrammarNote[]
  useful_phrases: UsefulPhrase[]
  comprehension_questions: string[]
  conversation_questions: ConversationQuestions
  difficult_concepts: DifficultConcept[]
  chatgpt_instructions: string
  quiz: Quiz | null
  generation_model: string | null
  generation_prompt_version: string | null
  created_at: string
}

export interface VocabularyRow extends VocabularyItem {
  id: string
  article_id: string
  sort_order: number
}

export interface ExportRow {
  id: string
  article_id: string
  format: 'docx' | 'markdown'
  storage_path: string | null
  created_at: string
}

export interface GenerationLogRow {
  id: string
  article_id: string
  generation_type: 'extraction' | 'ai_generation_import' | 'export' | 'publish'
  status: 'started' | 'success' | 'error'
  error_message: string | null
  model: string | null
  created_at: string
}

/** Combined view used by the editor and public article page. */
export interface FullArticle {
  article: ArticleRow
  content: ArticleContentRow | null
  vocabulary: VocabularyRow[]
}
