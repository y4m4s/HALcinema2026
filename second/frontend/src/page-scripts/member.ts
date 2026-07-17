/* eslint-disable */
// @ts-nocheck
import {
  getAuthHeaders,
  getRequestErrorMessage,
  logoutStoredMemberSession,
  readMemberSession,
  refreshStoredMemberSession,
  requestMemberJSON,
  writeMemberSession,
} from './member-session'

const INPUT_LIMITS = {
  name: 40,
  nameKana: 60,
  email: 254,
  tel: 15,
  loginIdentifier: 254,
  password: 128,
}

const HISTORY_FILTER_OPTIONS = [
  { value: 'all', label: 'すべての期間' },
  { value: '30d', label: '過去30日' },
  { value: '90d', label: '過去90日' },
  { value: '1y', label: '過去1年' },
]

export function runMember() {
  const root = document.getElementById('member-root')
  if (!root) return

  const state = {
    session: readMemberSession(),
    checking: Boolean(readMemberSession()?.token),
    mode: 'login',
    activeTab: 'profile',
    login: createLoginState(),
    register: createRegisterState(),
    history: createHistoryState(),
  }

  root.addEventListener('submit', onSubmit)
  root.addEventListener('input', onInput)
  root.addEventListener('change', onChange)
  root.addEventListener('click', onClick)
  root.addEventListener('keydown', onKeyDown)
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('focusin', onDocumentFocusIn)

  render()
  if (state.session?.token) {
    void refreshStoredMemberSession().then((session) => {
      state.session = session
      state.checking = false
      render()
    })
  }

  function onSubmit(event) {
    const target = event.target
    if (!(target instanceof HTMLFormElement)) return
    event.preventDefault()

    if (target.dataset.memberForm === 'login') {
      void loginMember()
      return
    }
    if (target.dataset.memberForm === 'register') {
      void registerMember()
    }
  }

  function onInput(event) {
    const target = event.target instanceof HTMLInputElement ? event.target : null
    if (!target) return

    const loginField = target.closest('[data-member-login-field]')
    if (loginField) {
      const fieldName = loginField.dataset.memberLoginField
      const nextValue = normalizeLoginInput(fieldName, target.value)
      if (target.value !== nextValue) target.value = nextValue
      state.login[fieldName] = nextValue
      state.login.error = ''
      syncActions()
      return
    }

    const registerField = target.closest('[data-member-register-field]')
    if (registerField && target.type !== 'checkbox') {
      const fieldName = registerField.dataset.memberRegisterField
      const nextValue = normalizeRegisterInput(fieldName, target.value)
      if (target.value !== nextValue) target.value = nextValue
      state.register[fieldName] = nextValue
      state.register.error = ''
      syncActions()
    }
  }

  function onChange(event) {
    const target = event.target instanceof Element ? event.target : null
    if (!target) return

    if (!(target instanceof HTMLInputElement)) return
    const registerField = target.closest('[data-member-register-field]')
    if (registerField && target.type === 'checkbox') {
      state.register[registerField.dataset.memberRegisterField] = Boolean(target.checked)
      state.register.error = ''
      syncActions()
    }
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null
    if (!target) return

    const historyFilterTrigger = target.closest('[data-history-filter-trigger]')
    if (historyFilterTrigger) {
      toggleHistoryFilter()
      return
    }

    const historyFilterOption = target.closest('[data-history-filter-value]')
    if (historyFilterOption) {
      const nextFilter = historyFilterOption.dataset.historyFilterValue || 'all'
      if (!HISTORY_FILTER_OPTIONS.some((option) => option.value === nextFilter)) return
      closeHistoryFilter(true)
      if (state.history.filter === nextFilter) return
      state.history.filter = nextFilter
      state.history.loaded = false
      void loadReservationHistory()
      return
    }

    const action = target.closest('[data-member-action]')?.dataset.memberAction
    if (action === 'show-register') {
      state.mode = 'register'
      state.login.error = ''
      render()
      return
    }
    if (action === 'show-login') {
      state.mode = 'login'
      state.register.error = ''
      render()
      return
    }
    if (action === 'show-profile') {
      state.activeTab = 'profile'
      render()
      return
    }
    if (action === 'show-history') {
      state.activeTab = 'history'
      render()
      state.history.loaded = false
      void loadReservationHistory()
      return
    }
    if (action === 'logout') {
      void logoutMember()
    }
  }

  function onKeyDown(event) {
    const target = event.target instanceof Element ? event.target : null
    if (!target) return

    const historyFilterTrigger = target.closest('[data-history-filter-trigger]')
    if (historyFilterTrigger && event.key === 'Escape' && historyFilterTrigger.getAttribute('aria-expanded') === 'true') {
      event.preventDefault()
      closeHistoryFilter(true)
      return
    }

    if (historyFilterTrigger && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      openHistoryFilter(event.key === 'ArrowUp' ? 'last' : 'selected')
      return
    }

    const currentOption = target.closest('[data-history-filter-value]')
    if (!currentOption) return

    if (event.key === 'Escape') {
      event.preventDefault()
      closeHistoryFilter(true)
      return
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const options = Array.from(root.querySelectorAll('[data-history-filter-value]'))
    const currentIndex = options.indexOf(currentOption)
    let nextIndex = currentIndex
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length
    if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = options.length - 1
    options[nextIndex]?.focus()
  }

  function onDocumentClick(event) {
    const target = event.target instanceof Element ? event.target : null
    if (!target?.closest('[data-history-select]')) closeHistoryFilter()
  }

  function onDocumentFocusIn(event) {
    const target = event.target instanceof Element ? event.target : null
    if (!target?.closest('[data-history-select]')) closeHistoryFilter()
  }

  function toggleHistoryFilter() {
    const trigger = root.querySelector('[data-history-filter-trigger]')
    if (trigger?.getAttribute('aria-expanded') === 'true') {
      closeHistoryFilter()
      return
    }
    openHistoryFilter()
  }

  function openHistoryFilter(focusTarget = '') {
    const trigger = root.querySelector('[data-history-filter-trigger]')
    const optionList = root.querySelector('[data-history-filter-list]')
    if (!trigger || !optionList) return
    trigger.setAttribute('aria-expanded', 'true')
    optionList.hidden = false

    if (focusTarget) {
      const options = Array.from(optionList.querySelectorAll('[data-history-filter-value]'))
      const option = focusTarget === 'last'
        ? options[options.length - 1]
        : optionList.querySelector('[aria-selected="true"]') || options[0]
      option?.focus()
    }
  }

  function closeHistoryFilter(restoreFocus = false) {
    const trigger = root.querySelector('[data-history-filter-trigger]')
    const optionList = root.querySelector('[data-history-filter-list]')
    if (!trigger || !optionList) return
    trigger.setAttribute('aria-expanded', 'false')
    optionList.hidden = true
    if (restoreFocus) trigger.focus()
  }

  async function loginMember() {
    if (!isLoginValid() || state.login.loading) return
    state.login.loading = true
    state.login.error = ''
    render()

    try {
      const result = await requestMemberJSON('/api/members/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: state.login.identifier.trim(),
          password: state.login.password,
        }),
      })
      completeMemberAuth(result)
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    } catch (error) {
      state.login.loading = false
      state.login.error = getRequestErrorMessage(error)
      render()
    }
  }

  async function registerMember() {
    if (state.register.loading) return
    syncRegisterStateFromDOM()

    const validationMessage = getRegisterValidationMessage()
    if (validationMessage) {
      state.register.error = validationMessage
      render()
      return
    }

    state.register.loading = true
    state.register.error = ''
    render()

    try {
      const result = await requestMemberJSON('/api/members/register', {
        method: 'POST',
        body: JSON.stringify({
          name: state.register.name.trim(),
          nameKana: state.register.nameKana.trim(),
          email: state.register.email.trim(),
          tel: state.register.tel.trim(),
          password: state.register.password,
          mailMagazine: Boolean(state.register.mailMagazine),
        }),
      })
      completeMemberAuth(result)
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    } catch (error) {
      state.register.loading = false
      state.register.error = getRequestErrorMessage(error)
      render()
    }
  }

  async function logoutMember() {
    const logoutPromise = logoutStoredMemberSession()
    state.session = null
    state.mode = 'login'
    state.activeTab = 'profile'
    state.login = createLoginState()
    state.register = createRegisterState()
    state.history = createHistoryState()
    render()
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    await logoutPromise
  }

  function completeMemberAuth(result) {
    if (!result?.member || !result?.token) {
      state.login.loading = false
      state.register.loading = false
      state.login.error = '会員情報の取得に失敗しました。'
      render()
      return
    }

    state.session = { member: result.member, token: result.token }
    state.mode = 'login'
    state.activeTab = 'profile'
    state.login = createLoginState()
    state.register = createRegisterState()
    state.history = createHistoryState()
    writeMemberSession(state.session)
    render()
  }

  async function loadReservationHistory() {
    const token = state.session?.token
    if (state.history.loading) return
    if (!token) {
      state.history.items = []
      state.history.error = 'ログイン状態を確認できません。再ログインしてください。'
      state.history.loaded = true
      render()
      return
    }

    state.history.loading = true
    state.history.error = ''
    render()

    try {
      const params = new URLSearchParams()
      if (state.history.filter && state.history.filter !== 'all') {
        params.set('period', state.history.filter)
      }
      const path = `/api/members/reservations${params.toString() ? `?${params.toString()}` : ''}`
      const result = await requestMemberJSON(path, {
        headers: getAuthHeaders(token),
      })
      state.history.items = Array.isArray(result.reservations) ? result.reservations : []
      state.history.loaded = true
    } catch (error) {
      state.history.error = getRequestErrorMessage(error)
      state.history.loaded = true
    } finally {
      state.history.loading = false
      render()
    }
  }

  function render() {
    if (state.checking) {
      root.innerHTML = `<div class="member-panel"><p class="member-status">会員情報を確認しています。</p></div>`
      return
    }

    if (state.session?.member) {
      root.innerHTML = renderLoggedIn(state.session.member)
      return
    }

    root.innerHTML = state.mode === 'register' ? renderRegisterView() : renderLoginView()
  }

  function renderLoginView() {
    const login = state.login || {}
    const loading = Boolean(login.loading)
    return `
      <div class="member-auth-wrap">
        <section class="account-panel member-auth-panel" aria-labelledby="member-login-title">
          <div class="account-panel-title">
            <span>MEMBER</span>
            <h3 id="member-login-title">会員ログイン</h3>
          </div>
          <p class="account-lead">メールアドレス、または会員番号でログインできます。</p>
          <form data-member-form="login" novalidate>
            <div class="account-login-form">
              <label class="account-login-row">
                <span class="account-login-label">ID <em>必須</em></span>
                <input type="text" autocomplete="username" value="${escapeAttr(login.identifier || '')}" data-member-login-field="identifier" placeholder="メールアドレス / 会員番号" maxlength="${INPUT_LIMITS.loginIdentifier}" ${loading ? 'disabled' : ''}>
              </label>
              <label class="account-login-row">
                <span class="account-login-label">パスワード <em>必須</em></span>
                <input type="password" autocomplete="current-password" value="${escapeAttr(login.password || '')}" data-member-login-field="password" maxlength="${INPUT_LIMITS.password}" ${loading ? 'disabled' : ''}>
              </label>
            </div>
            ${login.error ? `<p class="account-form-error">${escapeHtml(login.error)}</p>` : ''}
            <div class="account-panel-actions">
              <button class="btn-primary account-login-button" type="submit" data-login-submit ${!isLoginValid() || loading ? 'disabled' : ''}>${loading ? 'ログイン中...' : 'ログイン'}</button>
            </div>
          </form>
          <div class="member-switch">
            <p>未会員の方はこちら</p>
            <button class="btn-ghost" type="button" data-member-action="show-register">新規登録へ</button>
          </div>
        </section>
      </div>
    `
  }

  function renderRegisterView() {
    const join = state.register || {}
    const loading = Boolean(join.loading)
    return `
      <div class="member-auth-wrap">
        <section class="account-panel member-auth-panel member-register-panel" aria-labelledby="member-register-title">
          <div class="account-panel-title">
            <span>JOIN</span>
            <h3 id="member-register-title">会員登録</h3>
          </div>
          <p class="account-lead">登録後、そのまま会員としてログインします。</p>
          <form data-member-form="register" novalidate>
            <div class="account-login-form account-register-form">
              ${renderRegisterRow({ label: '氏名', field: 'name', value: join.name, placeholder: '例）東急太郎', autocomplete: 'name', loading })}
              ${renderRegisterRow({ label: '氏名（かな）', field: 'nameKana', value: join.nameKana, placeholder: '例）とうきゅうたろう', loading })}
              <label class="account-login-row">
                <span class="account-login-label">電話番号 <em>必須</em></span>
                <span class="account-register-tel">
                  <input type="tel" inputmode="numeric" value="${escapeAttr(join.tel || '')}" data-member-register-field="tel" placeholder="0123456789" maxlength="${INPUT_LIMITS.tel}" ${loading ? 'disabled' : ''}>
                </span>
              </label>
              ${renderRegisterRow({ label: 'メール', field: 'email', value: join.email, placeholder: 'example@hal-cinema.test', type: 'email', autocomplete: 'email', loading })}
              ${renderRegisterRow({ label: 'メール確認', field: 'emailConfirm', value: join.emailConfirm, placeholder: 'もう一度入力', type: 'email', loading })}
              ${renderRegisterRow({ label: 'パスワード', field: 'password', value: join.password, placeholder: '8文字以上', type: 'password', autocomplete: 'new-password', loading })}
              ${renderRegisterRow({ label: '確認', field: 'passwordConfirm', value: join.passwordConfirm, placeholder: 'もう一度入力', type: 'password', autocomplete: 'new-password', loading })}
            </div>
            <label class="account-checkbox-row">
              <input type="checkbox" data-member-register-field="mailMagazine" ${join.mailMagazine ? 'checked' : ''} ${loading ? 'disabled' : ''}>
              <span>会員限定のお知らせを受け取る</span>
            </label>
            ${join.error ? `<p class="account-form-error">${escapeHtml(join.error)}</p>` : ''}
            <div class="account-panel-actions account-guest-actions">
              <button class="btn-ghost" type="button" data-member-action="show-login" ${loading ? 'disabled' : ''}>ログインへ戻る</button>
              <button class="btn-primary" type="submit" data-register-submit ${loading ? 'disabled' : ''}>${loading ? '登録中...' : '登録する'}</button>
            </div>
          </form>
        </section>
      </div>
    `
  }

  function renderRegisterRow({ label, field, value, placeholder, type = 'text', autocomplete = '', loading }) {
    const maxlength = getRegisterFieldMaxlength(field)
    return `
      <label class="account-login-row">
        <span class="account-login-label">${escapeHtml(label)} <em>必須</em></span>
        <input type="${escapeAttr(type)}" value="${escapeAttr(value || '')}" data-member-register-field="${escapeAttr(field)}" placeholder="${escapeAttr(placeholder)}" maxlength="${escapeAttr(maxlength)}" ${autocomplete ? `autocomplete="${escapeAttr(autocomplete)}"` : ''} ${loading ? 'disabled' : ''}>
      </label>
    `
  }

  function renderLoggedIn(member) {
    const isHistory = state.activeTab === 'history'
    return `
      <section class="member-dashboard" aria-labelledby="member-current-title">
        <div class="member-dashboard-nav" aria-label="会員メニュー">
          <div class="member-tab-group" role="tablist" aria-label="会員ページ表示切替">
            <button class="member-tab${!isHistory ? ' active' : ''}" type="button" data-member-action="show-profile" role="tab" aria-selected="${!isHistory}">会員情報</button>
            <button class="member-tab${isHistory ? ' active' : ''}" type="button" data-member-action="show-history" role="tab" aria-selected="${isHistory}">履歴</button>
          </div>
          <button class="btn-ghost member-logout-button" type="button" data-member-action="logout">ログアウト</button>
        </div>
        <div class="member-dashboard-body">
          ${isHistory ? renderHistoryView() : renderProfileView(member)}
        </div>
      </section>
    `
  }

  function renderProfileView(member) {
    return `
      <section class="member-panel member-panel-wide" aria-labelledby="member-current-title">
        <div class="member-panel-head">
          <span>PROFILE</span>
          <h2 id="member-current-title">会員情報</h2>
        </div>
        <dl class="member-card member-profile-list">
          ${renderProfileRow('会員番号', member.memberNo || member.id || '-')}
          ${renderProfileRow('氏名', member.name || '-')}
          ${renderProfileRow('メール', member.email || '-')}
          ${renderProfileRow('電話番号', member.tel || '-')}
          ${renderProfileRow('ポイント', `${member.points ?? 0} pt`)}
        </dl>
      </section>
    `
  }

  function renderProfileRow(label, value) {
    return `
      <div>
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(value)}</dd>
      </div>
    `
  }

  function renderHistoryView() {
    const history = state.history
    return `
      <section class="member-panel member-history-panel" aria-labelledby="member-history-title">
        <div class="member-panel-head">
          <span>HISTORY</span>
          <h2 id="member-history-title">購入履歴</h2>
        </div>
        <div class="member-history-toolbar">
          <div class="member-history-filter" role="group" aria-labelledby="member-history-filter-label">
            <span class="member-history-filter-label" id="member-history-filter-label">表示期間</span>
            <div class="member-history-custom-select" data-history-select>
              <button
                class="member-history-select-trigger"
                type="button"
                id="member-history-filter-trigger"
                data-history-filter-trigger
                aria-haspopup="listbox"
                aria-expanded="false"
                aria-controls="member-history-filter-list"
                aria-labelledby="member-history-filter-label member-history-filter-value"
              >
                <span id="member-history-filter-value">${escapeHtml(getHistoryFilterLabel(state.history.filter))}</span>
              </button>
              <div
                class="member-history-option-list"
                id="member-history-filter-list"
                data-history-filter-list
                role="listbox"
                aria-labelledby="member-history-filter-label"
                hidden
              >
                ${renderHistoryFilterOptions()}
              </div>
            </div>
          </div>
        </div>
        ${history.loading ? '<p class="member-status">購入履歴を読み込んでいます。</p>' : ''}
        ${history.error ? `<p class="account-form-error">${escapeHtml(history.error)}</p>` : ''}
        ${!history.loading && !history.error ? renderHistoryList(history.items) : ''}
      </section>
    `
  }

  function renderHistoryFilterOptions() {
    return HISTORY_FILTER_OPTIONS.map(({ value, label }) => `
      <button
        class="member-history-option"
        type="button"
        role="option"
        tabindex="-1"
        data-history-filter-value="${escapeAttr(value)}"
        aria-selected="${state.history.filter === value}"
      >${escapeHtml(label)}</button>
    `).join('')
  }

  function renderHistoryList(items) {
    if (!items.length) {
      return `
        <div class="member-history-empty">
          <strong>購入履歴はありません</strong>
          <span>対象期間に会員購入した予約はまだありません。</span>
        </div>
      `
    }

    return `
      <div class="member-history-list">
        ${items.map(renderHistoryItem).join('')}
      </div>
    `
  }

  function renderHistoryItem(item) {
    return `
      <article class="member-history-item">
        <div class="member-history-main">
          <span>${escapeHtml(item.reservationId || '-')}</span>
          <strong>${escapeHtml(item.movieTitle || '-')}</strong>
          <p>${escapeHtml(formatHistoryDate(item.date, item.start, item.end))} / ${escapeHtml(item.screen || '-')}</p>
        </div>
        <dl class="member-history-meta">
          <div><dt>座席</dt><dd>${escapeHtml(item.seats || '-')}</dd></div>
          <div><dt>予約</dt><dd>${escapeHtml(statusLabel(item.status))}</dd></div>
          <div><dt>支払</dt><dd>${escapeHtml(paymentStatusLabel(item.paymentStatus))}</dd></div>
          <div><dt>合計</dt><dd>${formatYen(item.amount)}</dd></div>
        </dl>
      </article>
    `
  }

  function syncActions() {
    const loginButton = root.querySelector('[data-login-submit]')
    if (loginButton) loginButton.disabled = !isLoginValid() || state.login.loading
    const registerButton = root.querySelector('[data-register-submit]')
    if (registerButton) registerButton.disabled = state.register.loading
  }

  function syncRegisterStateFromDOM() {
    root.querySelectorAll('[data-member-register-field]').forEach((field) => {
      const fieldName = field.dataset.memberRegisterField
      if (!fieldName) return
      if (field.type === 'checkbox') {
        state.register[fieldName] = Boolean(field.checked)
        return
      }
      const nextValue = normalizeRegisterInput(fieldName, field.value)
      if (field.value !== nextValue) field.value = nextValue
      state.register[fieldName] = nextValue
    })
  }

  function isLoginValid() {
    return Boolean(
      String(state.login.identifier || '').trim() &&
      String(state.login.password || '').trim() &&
      isWithinMax(state.login.identifier, INPUT_LIMITS.loginIdentifier) &&
      isWithinMax(state.login.password, INPUT_LIMITS.password)
    )
  }

  function getRegisterValidationMessage() {
    const join = state.register
    const phone = String(join.tel || '').trim()
    const email = String(join.email || '').trim()
    const emailConfirm = String(join.emailConfirm || '').trim()
    const password = String(join.password || '')
    const passwordConfirm = String(join.passwordConfirm || '')

    if (!String(join.name || '').trim()) return '氏名を入力してください。'
    if (!String(join.nameKana || '').trim()) return '氏名かなを入力してください。'
    if (!isWithinMax(join.name, INPUT_LIMITS.name)) return '氏名は40文字以内で入力してください。'
    if (!isWithinMax(join.nameKana, INPUT_LIMITS.nameKana)) return '氏名かなは60文字以内で入力してください。'
    if (!/^[0-9]{2,5}[0-9]{2,5}[0-9]{3,5}$/.test(phone)) return '電話番号をハイフンなしで入力してください。'
    if (!isValidEmail(email)) return 'メールアドレスを正しく入力してください。'
    if (!isWithinMax(email, INPUT_LIMITS.email)) return 'メールアドレスは254文字以内で入力してください。'
    if (email !== emailConfirm) return '確認用メールアドレスが一致していません。'
    if (Array.from(password).length < 8) return 'パスワードは8文字以上で入力してください。'
    if (!isWithinMax(password, INPUT_LIMITS.password)) return 'パスワードは128文字以内で入力してください。'
    if (password !== passwordConfirm) return '確認用パスワードが一致していません。'

    return ''
  }
}

function createLoginState() {
  return {
    identifier: '',
    password: '',
    loading: false,
    error: '',
  }
}

function createRegisterState() {
  return {
    name: '',
    nameKana: '',
    email: '',
    emailConfirm: '',
    tel: '',
    password: '',
    passwordConfirm: '',
    mailMagazine: false,
    loading: false,
    error: '',
  }
}

function createHistoryState() {
  return {
    filter: 'all',
    items: [],
    loading: false,
    loaded: false,
    error: '',
  }
}

function getHistoryFilterLabel(value) {
  return HISTORY_FILTER_OPTIONS.find((option) => option.value === value)?.label || HISTORY_FILTER_OPTIONS[0].label
}

function normalizeLoginInput(field, value) {
  if (field === 'password') return limitString(stripControlChars(value), INPUT_LIMITS.password)
  return limitString(stripControlChars(value), INPUT_LIMITS.loginIdentifier)
}

function getRegisterFieldMaxlength(field) {
  if (field === 'name') return INPUT_LIMITS.name
  if (field === 'nameKana') return INPUT_LIMITS.nameKana
  if (field === 'tel') return INPUT_LIMITS.tel
  if (field === 'email' || field === 'emailConfirm') return INPUT_LIMITS.email
  if (field === 'password' || field === 'passwordConfirm') return INPUT_LIMITS.password
  return 100
}

function normalizeRegisterInput(field, value) {
  if (String(field || '').startsWith('tel')) return normalizeDigits(value, INPUT_LIMITS.tel)
  if (field === 'name') return limitString(stripControlChars(value), INPUT_LIMITS.name)
  if (field === 'nameKana') return limitString(stripControlChars(value), INPUT_LIMITS.nameKana)
  if (field === 'email' || field === 'emailConfirm') return limitString(stripControlChars(value), INPUT_LIMITS.email)
  if (field === 'password' || field === 'passwordConfirm') return limitString(stripControlChars(value), INPUT_LIMITS.password)
  return limitString(stripControlChars(value), 100)
}

function normalizeDigits(value, maxLength) {
  return limitString(String(value || '').replace(/\D/g, ''), maxLength)
}

function limitString(value, maxLength) {
  return Array.from(String(value || '')).slice(0, maxLength).join('')
}

function isWithinMax(value, maxLength) {
  return Array.from(String(value || '')).length <= maxLength
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function stripControlChars(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(value) {
  return escapeHtml(value)
}

function formatHistoryDate(date, start, end) {
  const normalizedDate = date ? String(date).replace(/-/g, '/') : '-'
  const time = start ? `${start}${end ? ` - ${end}` : ''}` : ''
  return time ? `${normalizedDate} ${time}` : normalizedDate
}

function statusLabel(status) {
  const labels = {
    pending: '支払待ち',
    confirmed: '予約確定',
    cancelled: 'キャンセル済み',
    used: '入場済み',
    expired: '期限切れ',
  }
  return labels[status] || status || '-'
}

function paymentStatusLabel(status) {
  const labels = {
    unpaid: '未払い',
    paid: '支払済み',
    failed: '失敗',
    refunded: '返金済み',
    cancelled: '取消済み',
  }
  return labels[status] || status || '-'
}

function formatYen(value) {
  return `${Number(value || 0).toLocaleString('ja-JP')}円`
}
