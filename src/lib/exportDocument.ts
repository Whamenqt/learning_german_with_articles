import type { ArticleContentRow, ArticleRow, VocabularyRow } from './types'

export interface ExportPayload {
  article: ArticleRow
  content: ArticleContentRow
  vocabulary: VocabularyRow[]
}

const CHATGPT_INSTRUCTIONS_FALLBACK =
  'Use this document for a German conversation lesson. Speak mainly in German at the selected level. ' +
  'Use short sentences and ask only one question at a time. Begin by reading one short paragraph from the article. ' +
  'Then ask me to explain what it means. Correct my important mistakes gently. When I ask you to repeat something, ' +
  'repeat only the relevant sentence. Help me restate difficult sentences in simpler German. Use the vocabulary list during the conversation.'

const CONVERSATION_STAGES = [
  'Read one paragraph',
  'Check understanding',
  'Explain difficult vocabulary',
  'Ask the learner to summarise',
  "Correct the learner's response",
  'Ask one opinion question',
  'Continue to the next paragraph',
  'Review vocabulary at the end',
]

function vocabLine(v: VocabularyRow): string {
  const noun = v.article ? `${v.article} ` : ''
  const plural = v.plural ? ` (Pl. ${v.plural})` : ''
  return `- **${noun}${v.german_term}${plural}** — ${v.english_meaning}\n  _${v.german_explanation}_\n  Beispiel: ${v.example_sentence}`
}

/** Builds the Markdown export. Pure string templating — no server round trip needed. */
export function buildMarkdownExport({ article, content, vocabulary }: ExportPayload): string {
  const lines: string[] = []
  lines.push(`# ${article.german_title ?? 'German Learning Article'}`)
  lines.push('')
  lines.push(`**Level:** ${article.language_level}  `)
  lines.push(`**Topic source:** [${article.source_title ?? article.source_url}](${article.source_url})  `)
  lines.push(`**Publication:** ${article.source_publication ?? 'Unknown'}  `)
  if (article.source_date) lines.push(`**Original date:** ${article.source_date}  `)
  lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`)
  lines.push('')
  lines.push(
    '> This is an AI-generated German learning adaptation of the source article above, not a direct translation. ' +
      'Facts and meaning are preserved; wording is original. Always review before using.',
  )
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## German Article')
  lines.push('')
  lines.push(content.introduction)
  lines.push('')
  lines.push(content.german_article)
  lines.push('')
  lines.push('## Key Vocabulary')
  lines.push('')
  vocabulary.forEach((v) => lines.push(vocabLine(v)))
  lines.push('')
  lines.push('## Useful Phrases')
  lines.push('')
  content.useful_phrases.forEach((p) => {
    lines.push(`- **${p.german_phrase}** — ${p.english_meaning}`)
    lines.push(`  Beispiel: ${p.example_sentence}`)
  })
  lines.push('')
  lines.push('## Grammar Notes')
  lines.push('')
  content.grammar_notes.forEach((g) => {
    lines.push(`- **${g.topic}**: ${g.explanation}`)
    lines.push(`  Beispiel: ${g.example}`)
  })
  lines.push('')
  lines.push('## English Summary')
  lines.push('')
  lines.push(content.english_summary)
  lines.push('')
  lines.push('## Comprehension Questions')
  lines.push('')
  content.comprehension_questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`))
  lines.push('')
  lines.push('## Conversation Questions')
  lines.push('')
  lines.push('**Opinion:**')
  content.conversation_questions.opinion.forEach((q, i) => lines.push(`${i + 1}. ${q}`))
  lines.push('')
  lines.push('**Personal:**')
  content.conversation_questions.personal.forEach((q, i) => lines.push(`${i + 1}. ${q}`))
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## ChatGPT Conversation Instructions')
  lines.push('')
  lines.push(content.chatgpt_instructions || CHATGPT_INSTRUCTIONS_FALLBACK)
  lines.push('')
  lines.push('### Conversation Stages')
  lines.push('')
  CONVERSATION_STAGES.forEach((stage, i) => lines.push(`${i + 1}. ${stage}`))
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(`Original article: [${article.source_title ?? article.source_url}](${article.source_url})`)
  lines.push('')

  return lines.join('\n')
}

export function downloadTextFile(filename: string, content: string, mime = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Calls the Netlify function that builds a .docx (server-side, using the `docx` package). */
export async function downloadDocxExport(payload: ExportPayload): Promise<void> {
  const res = await fetch('/.netlify/functions/export-docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Export failed (${res.status}): ${text || res.statusText}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const slug = payload.article.slug ?? 'german-lesson'
  a.download = `${slug}.docx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export { CHATGPT_INSTRUCTIONS_FALLBACK, CONVERSATION_STAGES }
