import type { Handler } from '@netlify/functions'
import { Document, Packer, Paragraph, HeadingLevel, TextRun, ExternalHyperlink } from 'docx'
import { errorResponse } from './_shared/http'
import type { ArticleContentRow, ArticleRow, VocabularyRow } from '../../src/lib/types'

// ---------------------------------------------------------------------------
// POST /.netlify/functions/export-docx
// Body: { article: ArticleRow, content: ArticleContentRow, vocabulary: VocabularyRow[] }
//
// Builds the DOCX conversation document (spec section 11). Runs server-side
// so the (larger) `docx` library isn't in the client bundle and so a future
// version can persist the file to Supabase Storage from here too.
// ---------------------------------------------------------------------------

interface ExportRequestBody {
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

function h(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } })
}

function p(text: string) {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 120 } })
}

function bullet(text: string) {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 60 } })
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Use POST.')
  }

  let body: ExportRequestBody
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return errorResponse(400, 'invalid_request', 'Request body must be valid JSON.')
  }

  const { article, content, vocabulary } = body
  if (!article || !content) {
    return errorResponse(400, 'invalid_request', 'Missing article or content in request body.')
  }

  try {
    const paragraphs: Paragraph[] = []

    // --- Header ---
    paragraphs.push(h(article.german_title ?? 'German Learning Article', HeadingLevel.TITLE))
    paragraphs.push(
      p(
        `Level: ${article.language_level}   |   Topic source: ${article.source_publication ?? 'Unknown'}   |   Generated: ${new Date()
          .toISOString()
          .slice(0, 10)}`,
      ),
    )
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun('Original article: '),
          new ExternalHyperlink({
            link: article.source_url,
            children: [new TextRun({ text: article.source_title ?? article.source_url, style: 'Hyperlink' })],
          }),
        ],
        spacing: { after: 200 },
      }),
    )
    paragraphs.push(
      p(
        'Note: this is an AI-generated German learning adaptation of the source article above, not a direct translation. Review before use.',
      ),
    )

    // --- Learning content ---
    paragraphs.push(h('German Article', HeadingLevel.HEADING_1))
    paragraphs.push(p(content.introduction))
    content.german_article.split(/\n{2,}/).forEach((para) => paragraphs.push(p(para)))

    paragraphs.push(h('Key Vocabulary', HeadingLevel.HEADING_1))
    vocabulary.forEach((v) => {
      const noun = v.article ? `${v.article} ` : ''
      const plural = v.plural ? ` (Pl. ${v.plural})` : ''
      paragraphs.push(bullet(`${noun}${v.german_term}${plural} — ${v.english_meaning}`))
      paragraphs.push(p(`   ${v.german_explanation}   |   Beispiel: ${v.example_sentence}`))
    })

    paragraphs.push(h('Useful Phrases', HeadingLevel.HEADING_1))
    content.useful_phrases.forEach((phrase) => {
      paragraphs.push(bullet(`${phrase.german_phrase} — ${phrase.english_meaning}`))
      paragraphs.push(p(`   Beispiel: ${phrase.example_sentence}`))
    })

    paragraphs.push(h('Grammar Notes', HeadingLevel.HEADING_1))
    content.grammar_notes.forEach((g) => {
      paragraphs.push(bullet(`${g.topic}: ${g.explanation}`))
      paragraphs.push(p(`   Beispiel: ${g.example}`))
    })

    paragraphs.push(h('English Summary', HeadingLevel.HEADING_1))
    paragraphs.push(p(content.english_summary))

    paragraphs.push(h('Comprehension Questions', HeadingLevel.HEADING_1))
    content.comprehension_questions.forEach((q, i) => paragraphs.push(p(`${i + 1}. ${q}`)))

    paragraphs.push(h('Conversation Questions', HeadingLevel.HEADING_1))
    paragraphs.push(p('Opinion:'))
    content.conversation_questions.opinion.forEach((q, i) => paragraphs.push(p(`${i + 1}. ${q}`)))
    paragraphs.push(p('Personal:'))
    content.conversation_questions.personal.forEach((q, i) => paragraphs.push(p(`${i + 1}. ${q}`)))

    // --- ChatGPT conversation instructions ---
    paragraphs.push(h('ChatGPT Conversation Instructions', HeadingLevel.HEADING_1))
    paragraphs.push(p(content.chatgpt_instructions || CHATGPT_INSTRUCTIONS_FALLBACK))
    paragraphs.push(h('Conversation Stages', HeadingLevel.HEADING_2))
    CONVERSATION_STAGES.forEach((stage, i) => paragraphs.push(p(`${i + 1}. ${stage}`)))

    const doc = new Document({
      sections: [{ properties: {}, children: paragraphs }],
    })

    const buffer = await Packer.toBuffer(doc)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${article.slug ?? 'german-lesson'}.docx"`,
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (err) {
    return errorResponse(500, 'export_failed', `Could not generate the DOCX file: ${err instanceof Error ? err.message : String(err)}`)
  }
}
