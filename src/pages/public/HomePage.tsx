import { Link } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'

const topics = [
  ['Weltraum', 'Planeten, Missionen und die Zukunft der Menschheit'],
  ['Gehirn & Körper', 'Schlaf, Psychologie und Gesundheit'],
  ['Natur', 'Ozeane, Tiere, Klima und unser Planet'],
]

export function HomePage() {
  return (
    <PublicLayout>
      <main>
        <section className="hero">
          <div className="container hero__grid">
            <div>
              <span className="eyebrow">German reading for curious minds</span>
              <h1>Deutsch lernen.<br /><em>Die Welt verstehen.</em></h1>
              <p>
                Intelligente A2- und B1-Lesetexte über Wissenschaft, Psychologie,
                Technik und die Welt – mit Wortschatz, Übungen und Quizfragen.
              </p>
              <div className="row hero__actions">
                <Link to="/learn" className="btn">Artikel entdecken</Link>
                <a href="#how-it-works" className="btn btn--secondary">So funktioniert es</a>
              </div>
            </div>
            <div className="hero__card" aria-label="Example learning card">
              <span className="level-badge level-badge--B1">B1 · Intermediate</span>
              <div className="hero__orbit">✦</div>
              <h2>Jeder Text öffnet eine neue Welt.</h2>
              <p>Lies. Verstehe. Sprich. Wiederhole.</p>
            </div>
          </div>
        </section>

        <section className="container home-section">
          <div className="section-heading">
            <span className="eyebrow">Knowledge domains</span>
            <h2>Themen, über die man wirklich sprechen möchte</h2>
          </div>
          <div className="topic-grid">
            {topics.map(([title, description], index) => (
              <Link to={`/learn?topic=${encodeURIComponent(title)}`} className="topic-card" key={title}>
                <span className="topic-card__number">0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
                <span>Artikel ansehen →</span>
              </Link>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="home-band">
          <div className="container home-band__grid">
            <div>
              <span className="eyebrow">A simple learning rhythm</span>
              <h2>Ein Artikel. Viele Wege zu lernen.</h2>
            </div>
            <ol className="learning-steps">
              <li><strong>Vorbereiten</strong><span>Lerne den wichtigsten Wortschatz.</span></li>
              <li><strong>Entdecken</strong><span>Lies einen echten, interessanten Sachtext.</span></li>
              <li><strong>Anwenden</strong><span>Übe Grammatik, Verständnis und Gespräch.</span></li>
              <li><strong>Abschließen</strong><span>Markiere deinen Fortschritt und wähle den nächsten Text.</span></li>
            </ol>
          </div>
        </section>
      </main>
    </PublicLayout>
  )
}
