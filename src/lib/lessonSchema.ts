import { z } from 'zod'

// ---------------------------------------------------------------------------
// This is the contract between the app and whatever the admin pastes back
// from ChatGPT/Claude after running the copyable prompt (see chatgptPrompt.ts).
// Keep this in sync with:
//   - the JSON schema described inside the generated prompt
//   - supabase/migrations/0001_init.sql (article_content + vocabulary columns)
//   - src/lib/types.ts (LessonJSON)
// ---------------------------------------------------------------------------

const levelEnum = z.enum(['A2', 'B1', 'B2'])

const vocabularyItemSchema = z.object({
  german_term: z.string().min(1, 'german_term is required'),
  article: z.string().nullish(),
  plural: z.string().nullish(),
  english_meaning: z.string().min(1),
  german_explanation: z.string().min(1),
  example_sentence: z.string().min(1),
  word_type: z.string().min(1),
  difficulty: levelEnum,
  is_essential: z.boolean(),
})

const usefulPhraseSchema = z.object({
  german_phrase: z.string().min(1),
  english_meaning: z.string().min(1),
  example_sentence: z.string().min(1),
})

const grammarNoteSchema = z.object({
  topic: z.string().min(1),
  explanation: z.string().min(1),
  example: z.string().min(1),
})

const difficultConceptSchema = z.object({
  term: z.string().min(1),
  explanation_en: z.string().min(1),
})

const conversationQuestionsSchema = z.object({
  opinion: z.array(z.string().min(1)).min(1, 'at least one opinion question is required'),
  personal: z.array(z.string().min(1)).min(1, 'at least one personal question is required'),
})

const sourceAttributionSchema = z.object({
  title: z.string().min(1),
  publication: z.string().min(1),
  url: z.string().url(),
  author: z.string().nullish(),
  published_date: z.string().nullish(),
})

const quizDifficultyEnum = z.enum(['easy', 'medium', 'hard'])

const quizQuestionSchema = z.object({
  question: z.string().min(1, 'question is required'),
  options: z.array(z.string().min(1)).length(4, 'exactly 4 options are required'),
  correct_index: z.number().int().min(0).max(3),
  difficulty: quizDifficultyEnum,
  explanation: z.string().nullish(),
})

export const quizJsonSchema = z.object({
  grammar: z.array(quizQuestionSchema).min(3, 'at least 3 grammar questions are required'),
  comprehension: z.array(quizQuestionSchema).min(3, 'at least 3 comprehension questions are required'),
})

export type QuizJsonParsed = z.infer<typeof quizJsonSchema>

export interface QuizValidationResult {
  success: boolean
  data?: QuizJsonParsed
  errors: string[]
}

/** Parses + validates raw text pasted into the Editor's quiz import box. Never throws. */
export function validateQuizJson(rawText: string): QuizValidationResult {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawText)
  } catch (err) {
    return {
      success: false,
      errors: [`The pasted content is not valid JSON: ${err instanceof Error ? err.message : String(err)}`],
    }
  }

  const result = quizJsonSchema.safeParse(parsedJson)
  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.join('.') || '(root)'
      return `${path}: ${issue.message}`
    })
    return { success: false, errors }
  }

  return { success: true, data: result.data, errors: [] }
}

export const lessonJsonSchema = z.object({
  german_headline: z.string().min(1, 'german_headline is required'),
  introduction: z.string().min(1, 'introduction is required'),
  german_article: z.string().min(1, 'german_article is required'),
  vocabulary: z.array(vocabularyItemSchema).min(1, 'at least one vocabulary item is required'),
  useful_phrases: z.array(usefulPhraseSchema).min(1, 'at least one useful phrase is required'),
  grammar_notes: z.array(grammarNoteSchema).default([]),
  comprehension_questions: z.array(z.string().min(1)).min(1, 'at least one comprehension question is required'),
  conversation_questions: conversationQuestionsSchema,
  english_summary: z.string().min(1, 'english_summary is required'),
  difficult_concepts: z.array(difficultConceptSchema).default([]),
  chatgpt_instructions: z.string().min(1, 'chatgpt_instructions is required'),
  source: sourceAttributionSchema,
  quiz: quizJsonSchema.optional(),
})

export type LessonJsonParsed = z.infer<typeof lessonJsonSchema>

export interface LessonValidationResult {
  success: boolean
  data?: LessonJsonParsed
  errors: string[]
}

/**
 * Parses + validates raw text (pasted or from an uploaded .json file) against
 * the lesson schema. Never throws — always returns a result the UI can render.
 */
export function validateLessonJson(rawText: string): LessonValidationResult {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawText)
  } catch (err) {
    return {
      success: false,
      errors: [`The pasted content is not valid JSON: ${err instanceof Error ? err.message : String(err)}`],
    }
  }

  const result = lessonJsonSchema.safeParse(parsedJson)
  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.join('.') || '(root)'
      return `${path}: ${issue.message}`
    })
    return { success: false, errors }
  }

  return { success: true, data: result.data, errors: [] }
}
