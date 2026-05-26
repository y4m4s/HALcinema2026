import { useEffect, useState } from 'react'
import './App.css'

type HealthResponse = {
  service: string
  status: string
  version: string
}

type MovieSummary = {
  id: number
  title: string
  genre: string
  releaseYear: number
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [movies, setMovies] = useState<MovieSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadApiStatus() {
      try {
        const [healthResponse, moviesResponse] = await Promise.all([
          fetch('/api/health'),
          fetch('/api/movies'),
        ])

        if (!healthResponse.ok || !moviesResponse.ok) {
          throw new Error('API request failed')
        }

        setHealth(await healthResponse.json())
        setMovies(await moviesResponse.json())
      } catch {
        setError('Gin APIに接続できませんでした')
      }
    }

    loadApiStatus()
  }, [])

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">HAL CINEMA 2026</p>
        <h1>React + Vite / Gin starter</h1>
        <p className="lead">
          mockディレクトリのHTML/CSS/JSを移植していくための、フロントエンドとAPIサーバーの最小構成です。
        </p>
      </section>

      <section className="status-grid" aria-label="開発環境ステータス">
        <article className="status-panel">
          <span className="status-label">Frontend</span>
          <strong>React + Vite</strong>
          <p>Vite dev serverからGin APIへ /api をプロキシします。</p>
        </article>

        <article className="status-panel">
          <span className="status-label">Backend</span>
          <strong>{health ? health.service : 'Gin API'}</strong>
          <p>
            {error
              ? error
              : health
                ? `${health.status} / ${health.version}`
                : 'APIステータスを確認しています'}
          </p>
        </article>
      </section>

      <section className="movie-list" aria-label="APIレスポンス例">
        <div className="section-heading">
          <span className="status-label">Sample API</span>
          <h2>Movies endpoint</h2>
        </div>

        <div className="movie-grid">
          {movies.map((movie) => (
            <article className="movie-card" key={movie.id}>
              <span>{movie.genre}</span>
              <h3>{movie.title}</h3>
              <p>{movie.releaseYear}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default App
