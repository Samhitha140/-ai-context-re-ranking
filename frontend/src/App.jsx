import { useState, useRef } from 'react'
import './App.css'

const PERSONAS = [
  {
    id: 'student',
    label: 'Student',
    icon: '🎓',
    desc: 'Prefers free resources, tutorials & learning platforms',
    context: 'I am a student. I strongly prefer free resources, free tools, educational content, tutorials, beginner-friendly explanations, and student discounts. I am budget-conscious — always highlight anything free or discounted for students. When I search for tools or software, assume I need the free version.',
  },
  {
    id: 'researcher',
    label: 'Researcher',
    icon: '🔬',
    desc: 'Needs academic papers, datasets & peer-reviewed sources',
    context: 'I am an academic researcher. I need peer-reviewed papers, datasets, preprints, technical depth, scholarly sources, methodologies, and citation-worthy references. Prioritize academic credibility and rigor over simplicity. Prefer Google Scholar, arXiv, PubMed, ResearchGate, and university sources.',
  },
  {
    id: 'professional',
    label: 'Professional',
    icon: '💼',
    desc: 'Wants industry tools, case studies & enterprise solutions',
    context: 'I am a working professional in a corporate environment. I need practical, industry-ready tools. Prioritize productivity, ROI, enterprise integrations, professional-grade platforms, and real-world case studies. I can afford paid tools if they are worth it.',
  },
  {
    id: 'developer',
    label: 'Developer',
    icon: '💻',
    desc: 'Looks for docs, GitHub repos, APIs & code examples',
    context: 'I am a software developer or engineer. I need official documentation, APIs, GitHub repositories, code examples, open-source tools, CLI tools, npm/pip packages, and technical specifications. Skip marketing pages — go straight to technical depth. Prefer Stack Overflow, GitHub, dev.to, official docs.',
  },
  {
    id: 'entrepreneur',
    label: 'Entrepreneur',
    icon: '🚀',
    desc: 'Focused on growth, startups & cost-effective solutions',
    context: 'I am a startup founder or entrepreneur. I need tools to build and scale quickly, market insights, lean cost-effective solutions, business-growth resources, and competitive intelligence. I value speed and ROI. Prefer tools with free tiers I can start with immediately.',
  },
  {
    id: 'creative',
    label: 'Creative / Designer',
    icon: '🎨',
    desc: 'Wants design tools, inspiration & visual resources',
    context: 'I am a creative professional, designer, or artist. I need design tools, visual inspiration, free assets, templates, tutorials, and aesthetic references. Highlight free tiers prominently. Prefer Figma, Dribbble, Behance, Canva, Adobe, Unsplash, and creative community platforms.',
  },
  {
    id: 'educator',
    label: 'Educator',
    icon: '📚',
    desc: 'Seeks classroom tools, curriculum & teaching resources',
    context: 'I am a teacher or educator. I need classroom tools, curriculum resources, teaching aids, free educational platforms, and content appropriate for students. Highlight tools that are free for teachers. Prefer platforms with educational pricing or classroom integrations.',
  },
  {
    id: 'jobseeker',
    label: 'Job Seeker',
    icon: '🎯',
    desc: 'Looking for jobs, resume tools & interview prep',
    context: 'I am actively looking for a job or internship. I need job boards, resume and CV builders, interview preparation guides, career advice, salary benchmarks, and skill-building resources to get hired. Prioritize actionable, practical content. Prefer LinkedIn, Glassdoor, Indeed, and career coaching platforms.',
  },
]

const TAG_STYLES = {
  free:          { backgroundColor: '#d1fae5', color: '#065f46' },
  'open-source': { backgroundColor: '#d1fae5', color: '#065f46' },
  premium:       { backgroundColor: '#fef3c7', color: '#92400e' },
  academic:      { backgroundColor: '#ede9fe', color: '#5b21b6' },
  tutorial:      { backgroundColor: '#dbeafe', color: '#1e40af' },
  beginner:      { backgroundColor: '#dbeafe', color: '#1e40af' },
  advanced:      { backgroundColor: '#fee2e2', color: '#991b1b' },
  tool:          { backgroundColor: '#e0f2fe', color: '#0c4a6e' },
  documentation: { backgroundColor: '#f0fdf4', color: '#14532d' },
  community:     { backgroundColor: '#fdf4ff', color: '#701a75' },
  official:      { backgroundColor: '#ecfdf5', color: '#064e3b' },
  news:          { backgroundColor: '#fff7ed', color: '#7c2d12' },
  video:         { backgroundColor: '#fce7f3', color: '#831843' },
  forum:         { backgroundColor: '#f5f3ff', color: '#4c1d95' },
  blog:          { backgroundColor: '#f3f4f6', color: '#6b7280' },
  article:       { backgroundColor: '#f3f4f6', color: '#6b7280' },
}

const DEFAULT_TAG_STYLE = { backgroundColor: '#f3f4f6', color: '#374151' }

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

function scoreColor(score) {
  if (score >= 0.75) return '#10b981'
  if (score >= 0.5)  return '#f59e0b'
  return '#ef4444'
}

export default function App() {
  const [selectedPersona, setSelectedPersona] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [meta, setMeta] = useState(null)
  const inputRef = useRef(null)

  const handleSearch = async () => {
    if (!query.trim()) { setError('Enter a search query'); inputRef.current?.focus(); return }
    if (!selectedPersona) { setError('Please select your persona first'); return }

    setLoading(true)
    setError('')
    setResults([])
    setSearched(true)

    try {
      const requestBody = { query: query.trim(), persona: selectedPersona }
      
      const res = await fetch(`${BACKEND_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        const hint = data.hint || ''
        const errorMsg = res.status === 400 
          ? `Invalid request: ${data.error || 'query and persona are required'}`
          : res.status === 500
          ? `Server error: ${data.error}. ${hint}`
          : data.error || `Search failed (${res.status})`
        throw new Error(errorMsg)
      }
      
      setResults(data.results || [])
      setMeta({
        totalFetched: data.totalFetched,
        persona: selectedPersona,
        highRelevanceCount: data.highRelevanceCount,
      })
    } catch (err) {
      setError(err.message || 'Network or server error. Make sure backend is running on http://localhost:3001')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleSearch() }

  const highRelevanceCount = results.filter(r => r.relevanceScore >= 0.75).length

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-badge">AI-Powered · Personalized · Real Results</div>
        <h1>Contextual Search Re-Ranker</h1>
        <p className="hero-sub">Tell us who you are — we'll surface what actually matters to you</p>
      </header>

      <main className="main">

        {/* Step 1: Persona Picker */}
        <section className="section">
          <div className="section-label">
            <span className="step-num">1</span>
            Who are you?
          </div>
          <div className="persona-grid">
            {PERSONAS.map(p => (
              <button
                key={p.id}
                className={`persona-card ${selectedPersona?.id === p.id ? 'selected' : ''}`}
                onClick={() => { setSelectedPersona(p); setError('') }}
              >
                <span className="persona-icon">{p.icon}</span>
                <span className="persona-label">{p.label}</span>
                <span className="persona-desc">{p.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Step 2: Search */}
        <section className="section">
          <div className="section-label">
            <span className="step-num">2</span>
            What are you looking for?
          </div>
          <div className="search-row">
            <div className="search-wrap">
              <svg className="search-icon" viewBox="0 0 20 20" fill="none">
                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                ref={inputRef}
                className="search-input"
                type="text"
                placeholder={selectedPersona
                  ? `Search as a ${selectedPersona.label} — e.g. "research papers on AI"...`
                  : 'Select your persona first, then search...'}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                disabled={!selectedPersona}
              />
              {query && (
                <button className="clear-btn" onClick={() => { setQuery(''); setResults([]); setSearched(false) }}>✕</button>
              )}
            </div>
            <button className="search-btn" onClick={handleSearch} disabled={loading || !selectedPersona}>
              {loading ? <span className="btn-spinner"/> : 'Search'}
            </button>
          </div>

          {selectedPersona && !searched && (
            <div className="persona-hint">
              <span className="hint-icon">{selectedPersona.icon}</span>
              <span>
                <strong>{selectedPersona.label} mode active.</strong> {selectedPersona.desc}.
                Results are personalised for you — max 2 blog articles, always at the bottom.
              </span>
            </div>
          )}

          {error && <div className="error-box">⚠️ {error}</div>}
        </section>

        {/* Loading skeletons */}
        {loading && (
          <section className="section loading-section">
            <div className="loading-card">
              <div className="loading-spinner"/>
              <div className="loading-text">
                <div>Fetching real results · AI re-ranking for <strong>{selectedPersona?.icon} {selectedPersona?.label}</strong>...</div>
                <div className="loading-sub">Personalising results for your persona · blogs limited to 2</div>
              </div>
            </div>
            {[1,2,3].map(i => (
              <div key={i} className="result-skeleton">
                <div className="skel skel-title"/>
                <div className="skel skel-url"/>
                <div className="skel skel-body"/>
              </div>
            ))}
          </section>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <section className="section">
            <div className="results-header">
              <div className="results-meta">
                <strong>{results.length}</strong> results for "<em>{query}</em>"
                {meta && (
                  <span className="meta-sub">
                    {' '}· from {meta.totalFetched} raw results · {highRelevanceCount} high-relevance
                  </span>
                )}
              </div>
              <div className="persona-badge">
                {selectedPersona?.icon} {selectedPersona?.label}
              </div>
            </div>

            <div className="results-list">
              {results.map((r) => {
                // FIX: use resultType from backend — not score threshold
                const isBlog = r.resultType === 'blog'
                return (
                  <div key={r.rank} className={`result-card ${isBlog ? 'result-card-dim' : ''}`}>
                    <div className="result-top">
                      <div className="rank-badge">#{r.rank}</div>
                      <div className="score-bar-wrap">
                        <span className="score-label" style={{ color: scoreColor(r.relevanceScore) }}>
                          {Math.round(r.relevanceScore * 100)}% match
                        </span>
                        <span className="score-bar">
                          <span
                            className="score-fill"
                            style={{
                              width: `${r.relevanceScore * 100}%`,
                              backgroundColor: scoreColor(r.relevanceScore),
                            }}
                          />
                        </span>
                      </div>
                    </div>

                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="result-title">
                      {r.title}
                    </a>
                    <div className="result-url">{r.displayUrl}</div>

                    {r.personaSnippet && (
                      <div className="persona-snippet">
                        <span className="snippet-icon">{selectedPersona?.icon}</span>
                        {r.personaSnippet}
                      </div>
                    )}

                    {r.originalSnippet && (
                      <div className="result-snippet">{r.originalSnippet}</div>
                    )}

                    {r.tags?.length > 0 && (
                      <div className="tag-row">
                        {r.tags.map(t => (
                          <span
                            key={t}
                            className="tag"
                            style={TAG_STYLES[t] || DEFAULT_TAG_STYLE}
                          >
                            {t}
                          </span>
                        ))}
                        {isBlog && (
                          <span className="tag tag-blog-warn">lower priority</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {!loading && searched && results.length === 0 && !error && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <div>No results found. Try a different query.</div>
          </div>
        )}
      </main>

      <footer className="footer">
        Built with Tavily Search API · Google Gemini AI · Personalised per persona · Max 2 blog results
      </footer>
    </div>
  )
}