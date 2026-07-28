import type { ArticleLength, ArticleRow, LanguageLevel } from './types'

const LENGTH_GUIDANCE: Record<ArticleLength, string> = {
  short: 'Keep the German learning article especially short: 3-5 short paragraphs.',
  standard: 'Use a standard length: about 5-8 short paragraphs.',
  detailed: 'Give a detailed treatment: about 8-12 short paragraphs, still using short sentences.',
}

const LEVEL_GUIDANCE: Record<LanguageLevel, string> = {
  A2: 'A2 (elementary): very common vocabulary, present tense and simple perfect tense only, short sentences, explain almost all abstract words.',
  B1: 'B1 (intermediate): prefer common vocabulary; use clear connectors such as weil, obwohl, deshalb, damit, dass; keep most sentences relatively short; mix present tense and common past-tense structures; avoid excessive passive voice; explain specialised terminology.',
  B2: 'B2 (upper-intermediate): wider vocabulary and more complex sentence structures are fine, but still explain specialised or technical terminology and avoid dense academic phrasing.',
}

/**
 * Builds the copyable prompt shown on the "Generate" step. The admin pastes
 * this (plus the source article text, included below) into their own
 * ChatGPT or Claude account, and pastes the resulting JSON back into the app.
 *
 * IMPORTANT: this app never calls an AI API itself in Version 1. This prompt
 * is the entire "integration" — keep the requested JSON shape in lockstep
 * with src/lib/lessonSchema.ts.
 */
export function buildChatgptPrompt(article: ArticleRow): string {
  const level = article.language_level
  const length = article.article_length

  const instructionsBlock = article.custom_instructions?.trim()
    ? `Additional instructions from the admin: ${article.custom_instructions.trim()}`
    : 'No additional instructions.'

  const vocabFocusBlock = article.vocabulary_focus?.trim()
    ? `Prioritise vocabulary related to: ${article.vocabulary_focus.trim()}.`
    : ''

  const sourceDateLine = article.source_date ? `Published: ${article.source_date}` : ''
  const sourceAuthorLine = article.source_author ? `Author: ${article.source_author}` : ''

  return `You are creating a German learning adaptation of a news article for a German learner (CEFR level ${level}).

=== SOURCE ARTICLE ===
Title: ${article.source_title ?? '(untitled)'}
Publication: ${article.source_publication ?? '(unknown)'}
URL: ${article.source_url}
${sourceDateLine}
${sourceAuthorLine}

Article text:
"""
${article.source_text ?? '(no extracted text — ask the admin to paste the article text)'}
"""

=== YOUR TASK ===
Create an ORIGINAL German-language learning adaptation of this article. Do not
translate it sentence-by-sentence and do not copy long passages verbatim —
summarise and re-express the content in your own original German wording,
while preserving the important facts, names, dates, and statistics.

Level: ${LEVEL_GUIDANCE[level]}
Length: ${LENGTH_GUIDANCE[length]}
${vocabFocusBlock}
${instructionsBlock}

Rules:
- Use only the facts in the supplied source article text. Do not invent information, quotations, or statistics that are not present in the source.
- Preserve important numbers, dates, names, and statistics accurately.
- Clearly separate established facts from opinion or uncertainty in the article.
- Avoid adding unsupported medical, legal, political, or scientific claims beyond what the source states.
- Include 8-15 key vocabulary items relevant to the topic.
- Include 3-8 reusable "useful phrases" that go beyond this specific article.
- Only include grammar notes for structures that actually appear in the article you wrote.
- Write comprehension questions that are directly answerable from your German article.
- Write opinion questions that invite discussion of the topic, and personal questions that connect the topic to the learner's own life/work/experience.
- Also include a "quiz" with two segments: "grammar" (questions that test choosing the grammatically correct option, based on structures used in your German article) and "comprehension" (questions that test understanding of the article's content). Each segment needs at least 5 questions, ranging from easy to hard (include a mix of "easy", "medium", and "hard"), each with exactly 4 options and one correct_index.
- Return ONLY valid JSON matching the schema below — no markdown code fences, no commentary before or after it.

=== REQUIRED JSON SCHEMA ===
{
  "german_headline": "string",
  "introduction": "string (1-3 sentences in German)",
  "german_article": "string (the full learning article in German, paragraphs separated by blank lines)",
  "vocabulary": [
    {
      "german_term": "string",
      "article": "der | die | das | null (nouns only)",
      "plural": "string | null (nouns only)",
      "english_meaning": "string",
      "german_explanation": "string (simple German definition)",
      "example_sentence": "string (German)",
      "word_type": "noun | verb | adjective | adverb | connector | phrase | other",
      "difficulty": "A2 | B1 | B2",
      "is_essential": true
    }
  ],
  "useful_phrases": [
    { "german_phrase": "string", "english_meaning": "string", "example_sentence": "string" }
  ],
  "grammar_notes": [
    { "topic": "string", "explanation": "string", "example": "string" }
  ],
  "comprehension_questions": ["string", "..."],
  "conversation_questions": {
    "opinion": ["string", "..."],
    "personal": ["string", "..."]
  },
  "english_summary": "string (2-4 sentences, in English)",
  "difficult_concepts": [
    { "term": "string", "explanation_en": "string" }
  ],
  "chatgpt_instructions": "string (reusable instructions for a ChatGPT conversation practice session using this material)",
  "quiz": {
    "grammar": [
      { "question": "string", "options": ["string", "string", "string", "string"], "correct_index": 0, "difficulty": "easy | medium | hard", "explanation": "string | null" }
    ],
    "comprehension": [
      { "question": "string", "options": ["string", "string", "string", "string"], "correct_index": 0, "difficulty": "easy | medium | hard", "explanation": "string | null" }
    ]
  },
  "source": {
    "title": "${article.source_title ?? ''}",
    "publication": "${article.source_publication ?? ''}",
    "url": "${article.source_url}",
    "author": ${article.source_author ? `"${article.source_author}"` : 'null'},
    "published_date": ${article.source_date ? `"${article.source_date}"` : 'null'}
  }
}

Return the JSON now.`
}
