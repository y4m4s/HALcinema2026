type MovieDetail = {
  id: string
  title: string
  titleKana: string
  titleEn: string
  rating: string
  durationMin: number
  posterUrl: string
  tagline: string
  synopsis: string
  genre: string
  language: string
  director: string
  mainActor: string
}

const ADMIN_CREDENTIAL_KEY = 'halcinema-admin-credential'

export function runAdmin() {
  const loginSection = document.getElementById('admin-login')
  const appSection = document.getElementById('admin-app')
  const loginForm = document.getElementById('admin-login-form') as HTMLFormElement | null
  const loginMessage = document.getElementById('admin-login-message')
  const movieForm = document.getElementById('admin-movie-form') as HTMLFormElement | null
  const movieMessage = document.getElementById('admin-movie-message')
  const movieList = document.getElementById('admin-movie-list')
  const logoutButton = document.getElementById('admin-logout')

  if (
    !loginSection || !appSection || !loginForm || !loginMessage ||
    !movieForm || !movieMessage || !movieList || !logoutButton
  ) {
    return
  }

  function showLogin() {
    appSection!.classList.add('admin-hidden')
    loginSection!.classList.remove('admin-hidden')
  }

  function showApp() {
    loginSection!.classList.add('admin-hidden')
    appSection!.classList.remove('admin-hidden')
  }

  function setMessage(target: HTMLElement, text: string, kind: 'success' | 'error' | '') {
    target.textContent = text
    target.classList.remove('is-success', 'is-error')
    if (kind === 'success') target.classList.add('is-success')
    if (kind === 'error') target.classList.add('is-error')
  }

  function getCredential(): string | null {
    return window.sessionStorage.getItem(ADMIN_CREDENTIAL_KEY)
  }

  function authHeader(credential: string) {
    return { Authorization: `Basic ${credential}` }
  }

  async function loadMovies(credential: string): Promise<MovieDetail[]> {
    const response = await fetch('/api/admin/movies', {
      headers: authHeader(credential),
    })
    if (response.status === 401) {
      throw new Error('unauthorized')
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || '一覧の取得に失敗しました。')
    }
    return response.json()
  }

  function renderMovies(movies: MovieDetail[]) {
    if (movies.length === 0) {
      movieList!.innerHTML = '<p class="admin-empty">登録済みの映画はまだありません。</p>'
      return
    }

    const rows = movies
      .map(
        (movie) => `<tr>
          <td>${escapeHtml(movie.id)}</td>
          <td>${escapeHtml(movie.title)}</td>
          <td>${escapeHtml(movie.genre)}</td>
          <td>${movie.durationMin}分</td>
          <td>${escapeHtml(movie.director)}</td>
          <td><button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-delete-id="${escapeHtml(
            movie.id,
          )}" data-delete-title="${escapeHtml(movie.title)}">削除</button></td>
        </tr>`,
      )
      .join('')

    movieList!.innerHTML = `<table class="admin-table">
      <thead>
        <tr><th>ID</th><th>タイトル</th><th>ジャンル</th><th>上映時間</th><th>監督</th><th></th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`

    movieList!.querySelectorAll<HTMLButtonElement>('[data-delete-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.deleteId || ''
        const title = button.dataset.deleteTitle || ''
        deleteMovie(id, title)
      })
    })
  }

  async function deleteMovie(id: string, title: string) {
    if (!id) return
    if (!window.confirm(`「${title}」（${id}）を削除します。よろしいですか？`)) return

    const credential = getCredential()
    if (!credential) {
      handleSessionExpired()
      return
    }

    setMessage(movieMessage!, '削除中...', '')
    try {
      const response = await fetch(`/api/admin/movies/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeader(credential),
      })

      if (response.status === 401) {
        handleSessionExpired()
        return
      }

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || '削除に失敗しました。')
      }

      setMessage(movieMessage!, `「${title}」（${id}）を削除しました。`, 'success')
      await refreshList(credential)
    } catch (error) {
      setMessage(movieMessage!, error instanceof Error ? error.message : '通信に失敗しました。', 'error')
    }
  }

  async function refreshList(credential: string) {
    try {
      const movies = await loadMovies(credential)
      renderMovies(movies)
    } catch (error) {
      if (error instanceof Error && error.message === 'unauthorized') {
        handleSessionExpired()
        return
      }
      movieList!.innerHTML = `<p class="admin-empty">${escapeHtml(
        error instanceof Error ? error.message : '一覧の取得に失敗しました。',
      )}</p>`
    }
  }

  function handleSessionExpired() {
    window.sessionStorage.removeItem(ADMIN_CREDENTIAL_KEY)
    showLogin()
    setMessage(loginMessage!, '認証の有効期限が切れました。再度ログインしてください。', 'error')
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const username = (document.getElementById('admin-username') as HTMLInputElement).value.trim()
    const password = (document.getElementById('admin-password') as HTMLInputElement).value
    if (!username || !password) {
      setMessage(loginMessage, 'ユーザー名とパスワードを入力してください。', 'error')
      return
    }

    const credential = window.btoa(`${username}:${password}`)
    setMessage(loginMessage, '認証中...', '')
    try {
      const movies = await loadMovies(credential)
      window.sessionStorage.setItem(ADMIN_CREDENTIAL_KEY, credential)
      setMessage(loginMessage, '', '')
      showApp()
      renderMovies(movies)
    } catch (error) {
      if (error instanceof Error && error.message === 'unauthorized') {
        setMessage(loginMessage, 'ユーザー名またはパスワードが正しくありません。', 'error')
        return
      }
      setMessage(loginMessage, error instanceof Error ? error.message : '通信に失敗しました。', 'error')
    }
  })

  movieForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const credential = getCredential()
    if (!credential) {
      handleSessionExpired()
      return
    }

    const formData = new FormData(movieForm)
    const payload = {
      title: String(formData.get('title') || '').trim(),
      titleKana: String(formData.get('titleKana') || '').trim(),
      titleEn: String(formData.get('titleEn') || '').trim(),
      rating: String(formData.get('rating') || '').trim(),
      durationMin: Number(formData.get('durationMin') || 0),
      posterUrl: String(formData.get('posterUrl') || '').trim(),
      tagline: String(formData.get('tagline') || '').trim(),
      synopsis: String(formData.get('synopsis') || '').trim(),
      genre: String(formData.get('genre') || '').trim(),
      language: String(formData.get('language') || '').trim(),
      director: String(formData.get('director') || '').trim(),
      mainActor: String(formData.get('mainActor') || '').trim(),
    }

    setMessage(movieMessage, '登録中...', '')
    try {
      const response = await fetch('/api/admin/movies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(credential),
        },
        body: JSON.stringify(payload),
      })

      if (response.status === 401) {
        handleSessionExpired()
        return
      }

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || '登録に失敗しました。')
      }

      setMessage(movieMessage, `「${data.title}」を登録しました（ID: ${data.id}）。`, 'success')
      movieForm.reset()
      await refreshList(credential)
    } catch (error) {
      setMessage(movieMessage, error instanceof Error ? error.message : '通信に失敗しました。', 'error')
    }
  })

  logoutButton.addEventListener('click', () => {
    window.sessionStorage.removeItem(ADMIN_CREDENTIAL_KEY)
    movieForm.reset()
    setMessage(movieMessage, '', '')
    showLogin()
  })

  const storedCredential = getCredential()
  if (storedCredential) {
    showApp()
    refreshList(storedCredential)
  } else {
    showLogin()
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
