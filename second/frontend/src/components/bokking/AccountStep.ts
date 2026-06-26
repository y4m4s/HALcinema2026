/* eslint-disable */
// @ts-nocheck
import { escapeAttr, escapeHtml } from './utils'

export function AccountStep({ state, stepNo, canProceed, isFirstStep, canLogin }) {
  const isMember = state.account === 'member' && state.member
  const isRegisterMode = state.account === 'join'

  return `
    <section class="booking-step-panel booking-step-constrained">
      <div class="booking-panel-head">
        <span>STEP ${escapeHtml(stepNo)}</span>
        <h2>購入方法を選択してください</h2>
      </div>
      <div class="booking-step-body">
        <div class="account-panels">
          ${isMember ? renderMemberPanel(state) : renderLoginPanel(state, canLogin)}

          ${isMember ? '' : `<section class="account-panel account-panel-guest">
            ${isRegisterMode ? renderRegisterPanel(state) : renderGuestPanel(canProceed)}
          </section>`}
        </div>
        <div class="booking-nav-row account-nav-row">
          <button class="btn-ghost" type="button" data-action="prev" ${isFirstStep ? 'disabled' : ''}>戻る</button>
        </div>
      </div>
    </section>
  `
}

function renderLoginPanel(state, canLogin) {
  const login = state.login || {}
  const loading = Boolean(login.loading)
  return `
    <section class="account-panel">
      <div class="account-panel-title">
        <span>MEMBER</span>
        <h3>会員の方</h3>
      </div>
      <p class="account-lead">メールアドレス、または会員番号でログインできます。</p>
      <div class="account-login-form">
        <label class="account-login-row">
          <span class="account-login-label">ID <em>必須</em></span>
          <input type="text" autocomplete="username" value="${escapeAttr(login.identifier || '')}" data-login-field="identifier" placeholder="メールアドレス / 会員番号" maxlength="254" ${loading ? 'disabled' : ''}>
        </label>
        <label class="account-login-row">
          <span class="account-login-label">パスワード <em>必須</em></span>
          <input type="password" autocomplete="current-password" value="${escapeAttr(login.password || '')}" data-login-field="password" maxlength="128" ${loading ? 'disabled' : ''}>
        </label>
      </div>
      ${login.error ? `<p class="account-form-error">${escapeHtml(login.error)}</p>` : ''}
      <div class="account-panel-actions">
        <button class="btn-primary account-login-button" type="button" data-action="login-member" ${!canLogin || loading ? 'disabled' : ''}>${loading ? 'ログイン中...' : 'ログイン'}</button>
      </div>
      <div class="account-notes">
        <p>WEBで入会された方は登録時に設定したパスワードを入力してください。</p>
      </div>
    </section>
  `
}

function renderMemberPanel(state) {
  const member = state.member
  return `
    <section class="account-panel account-panel-member">
      <div class="account-panel-title">
        <span>MEMBER</span>
        <h3>ログイン中</h3>
      </div>
      <p class="account-lead">${escapeHtml(member.name)} 様の会員情報で購入します。</p>
      <div class="account-member-card">
        <div>
          <span>会員番号</span>
          <strong>${escapeHtml(member.memberNo)}</strong>
        </div>
        <div>
          <span>メール</span>
          <strong>${escapeHtml(member.email)}</strong>
        </div>
        <div>
          <span>ポイント</span>
          <strong>${escapeHtml(member.points || 0)} pt</strong>
        </div>
      </div>
      <div class="account-panel-actions">
        <button class="btn-ghost" type="button" data-action="logout-member">ログアウト</button>
        <button class="btn-primary" type="button" data-action="next">支払方法へ</button>
      </div>
    </section>
  `
}

function renderGuestPanel(canProceed) {
  return `
    <div class="account-panel-title">
      <span>GUEST</span>
      <h3>会員でない方</h3>
    </div>
    <a class="account-promo" href="news.html?id=10" aria-label="HAL CINEMA MEMBERSの詳しいご案内">
      <div>
        <span class="account-promo-kicker">HAL CINEMA MEMBERS</span>
        <strong>映画をもっと快適に</strong>
        <p>鑑賞ポイント、会員限定のお知らせ、スムーズな予約確認をまとめて利用できます。登録方法と特典の詳細はお知らせページで確認できます。</p>
        <span class="account-promo-link-text">詳しい案内を見る</span>
      </div>
      <ul class="account-benefit-list" aria-label="会員登録の主なメリット">
        <li><span>POINT</span><strong>ポイント付与</strong></li>
        <li><span>BENEFIT</span><strong>会員特典</strong></li>
        <li><span>HISTORY</span><strong>予約履歴</strong></li>
      </ul>
    </a>
    <div class="account-panel-actions account-guest-actions">
      <button class="btn-ghost account-join-button" type="button" data-account-choice="join">入会する</button>
      <button class="btn-primary" type="button" data-action="next" ${!canProceed ? 'disabled' : ''}>入会せず購入に進む</button>
    </div>
  `
}

function renderRegisterPanel(state) {
  const join = state.join || {}
  const loading = Boolean(join.loading)
  return `
    <div class="account-panel-title">
      <span>JOIN</span>
      <h3>会員登録</h3>
    </div>
    <p class="account-lead">登録後、この予約は会員情報を使ってそのまま支払方法へ進みます。</p>
    <div class="account-login-form account-register-form">
      ${renderRegisterRow({ label: '氏名', field: 'name', value: join.name, placeholder: '例）東急太郎', autocomplete: 'name', loading })}
      ${renderRegisterRow({ label: '氏名（かな）', field: 'nameKana', value: join.nameKana, placeholder: '例）とうきゅうたろう', loading })}
      <label class="account-login-row">
        <span class="account-login-label">電話番号 <em>必須</em></span>
        <span class="account-register-tel">
          <input type="tel" inputmode="numeric" value="${escapeAttr(join.tel || '')}" data-register-field="tel" placeholder="0123456789" maxlength="15" ${loading ? 'disabled' : ''}>
        </span>
      </label>
      ${renderRegisterRow({ label: 'メール', field: 'email', value: join.email, placeholder: 'example@hal-cinema.test', type: 'email', autocomplete: 'email', loading })}
      ${renderRegisterRow({ label: 'メール確認', field: 'emailConfirm', value: join.emailConfirm, placeholder: 'もう一度入力', type: 'email', loading })}
      ${renderRegisterRow({ label: 'パスワード', field: 'password', value: join.password, placeholder: '8文字以上', type: 'password', autocomplete: 'new-password', loading })}
      ${renderRegisterRow({ label: '確認', field: 'passwordConfirm', value: join.passwordConfirm, placeholder: 'もう一度入力', type: 'password', autocomplete: 'new-password', loading })}
    </div>
    <label class="account-checkbox-row">
      <input type="checkbox" data-register-field="mailMagazine" ${join.mailMagazine ? 'checked' : ''} ${loading ? 'disabled' : ''}>
      <span>会員限定のお知らせを受け取る</span>
    </label>
    ${join.error ? `<p class="account-form-error">${escapeHtml(join.error)}</p>` : ''}
    <div class="account-panel-actions account-guest-actions">
      <button class="btn-ghost" type="button" data-account-choice="guest" ${loading ? 'disabled' : ''}>戻る</button>
      <button class="btn-primary" type="button" data-action="register-member" ${loading ? 'disabled' : ''}>${loading ? '登録中...' : '登録して購入へ'}</button>
    </div>
  `
}

function renderRegisterRow({ label, field, value, placeholder, type = 'text', autocomplete = '', loading }) {
  const maxlength = getRegisterFieldMaxlength(field)
  return `
    <label class="account-login-row">
      <span class="account-login-label">${escapeHtml(label)} <em>必須</em></span>
      <input type="${escapeAttr(type)}" value="${escapeAttr(value || '')}" data-register-field="${escapeAttr(field)}" placeholder="${escapeAttr(placeholder)}" maxlength="${escapeAttr(maxlength)}" ${autocomplete ? `autocomplete="${escapeAttr(autocomplete)}"` : ''} ${loading ? 'disabled' : ''}>
    </label>
  `
}

function getRegisterFieldMaxlength(field) {
  if (field === 'name') return 40
  if (field === 'nameKana') return 60
  if (field === 'email' || field === 'emailConfirm') return 254
  if (field === 'password' || field === 'passwordConfirm') return 128
  return 100
}
