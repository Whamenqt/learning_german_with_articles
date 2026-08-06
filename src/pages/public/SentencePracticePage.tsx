import { useEffect, useState } from 'react'
import { PublicNav } from '@/components/layout/PublicNav'
import { fetchSentencesByLevel } from '@/lib/api'
import type { LanguageLevel, Sentence } from '@/lib/types'

const LEVELS: LanguageLevel[] = ['A2', 'B1', 'B2']
const LEVEL_LABEL: Record<LanguageLevel, string> = {
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper-Intermediate',
}

type Direction = 'de-en' | 'en-de'

function shuffledIndices(length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Reshuffle a deck, making sure the very next card isn't the same one just seen. */
function reshuffleAvoidingRepeat(length: number, lastIndex: number | undefined): number[] {
  const deck = shuffledIndices(length)
  if (deck.length > 1 && lastIndex !== undefined && deck[0] === lastIndex) {
    ;[deck[0], deck[1]] = [deck[1], deck[0]]
  }
  return deck
}

function speak(text: string, lang: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = lang
  utter.rate = 0.9
  window.speechSynthesis.speak(utter)
}

export function SentencePracticePage() {
  const [level, setLevel] = useState<LanguageLevel>('A2')
  const [direction, setDirection] = useState<Direction>('de-en')
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deck, setDeck] = useState<number[]>([])
  const [pos, setPos] = useState(0)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setRevealed(false)
    fetchSentencesByLevel(level)
      .then((rows) => {
        if (cancelled) return
        setSentences(rows)
        setDeck(shuffledIndices(rows.length))
        setPos(0)
        setError(null)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [level])

  const current = sentences.length > 0 && deck.length > 0 ? sentences[deck[pos]] : null

  function handleNext() {
    setRevealed(false)
    if (pos + 1 >= deck.length) {
      setDeck(reshuffleAvoidingRepeat(sentences.length, deck[pos]))
      setPos(0)
    } else {
      setPos(pos + 1)
    }
  }

  function handleShuffle() {
    setRevealed(false)
    setDeck(reshuffleAvoidingRepeat(sentences.length, deck[pos]))
    setPos(0)
  }

  function changeDirection(next: Direction) {
    setDirection(next)
    setRevealed(false)
  }

  function changeLevel(next: LanguageLevel) {
    if (next === level) return
    setLevel(next)
  }

  const promptIsGerman = direction === 'de-en'
  const promptText = current ? (promptIsGerman ? current.german : current.english) : ''
  const answerText = current ? (promptIsGerman ? current.english : current.german) : ''

  return (
    <>
      <PublicNav />
      <main className="container container--narrow page">
        <div className="breadcrumb print-hide">
          <a href="/">German News Learning</a> / Sentence Practice
        </div>

        <h1 style={{ fontSize: 30, margin: '0 0 6px' }}>Sentence Practice</h1>
        <p className="hint" style={{ marginBottom: 24 }}>
          Guess the translation in your head, then click Reveal to check yourself. Switch levels or direction
          any time.
        </p>

        <div className="row row--between practice-controls print-hide">
          <div className="row" style={{ gap: 6 }}>
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={lvl === level ? 'btn btn--small' : 'btn btn--secondary btn--small'}
                onClick={() => changeLevel(lvl)}
              >
                {lvl} · {LEVEL_LABEL[lvl]}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className={direction === 'de-en' ? 'btn btn--small' : 'btn btn--secondary btn--small'}
              onClick={() => changeDirection('de-en')}
            >
              German → English
            </button>
            <button
              type="button"
              className={direction === 'en-de' ? 'btn btn--small' : 'btn btn--secondary btn--small'}
              onClick={() => changeDirection('en-de')}
            >
              English → German
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert--error" style={{ marginTop: 20 }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ marginTop: 20 }}>Loading…</p>
        ) : !current ? (
          <div className="card" style={{ marginTop: 20 }}>
            No sentences available for this level yet.
          </div>
        ) : (
          <div className="card practice-card">
            <div className="row row--between" style={{ marginBottom: 16 }}>
              <span className="badge">
                {pos + 1} / {deck.length}
              </span>
              <button type="button" className="btn btn--secondary btn--small" onClick={handleShuffle}>
                Shuffle
              </button>
            </div>

            <div className="practice-side">
              <div className="practice-label">{promptIsGerman ? 'German' : 'English'}</div>
              <div className="practice-sentence">
                <span>{promptText}</span>
                {promptIsGerman && (
                  <button
                    type="button"
                    className="practice-audio-btn"
                    aria-label="Play German pronunciation"
                    onClick={() => speak(promptText, 'de-DE')}
                  >
                    🔊
                  </button>
                )}
              </div>
            </div>

            {revealed ? (
              <div className="practice-side practice-side--answer">
                <div className="practice-label">{promptIsGerman ? 'English' : 'German'}</div>
                <div className="practice-sentence">
                  <span>{answerText}</span>
                  {!promptIsGerman && (
                    <button
                      type="button"
                      className="practice-audio-btn"
                      aria-label="Play German pronunciation"
                      onClick={() => speak(answerText, 'de-DE')}
                    >
                      🔊
                    </button>
                  )}
                </div>
                {current.notes && <div className="practice-notes">{current.notes}</div>}
              </div>
            ) : (
              <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => setRevealed(true)}>
                Reveal
              </button>
            )}

            <div className="row" style={{ marginTop: 22 }}>
              <button type="button" className="btn btn--secondary" onClick={handleNext}>
                Next sentence →
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
