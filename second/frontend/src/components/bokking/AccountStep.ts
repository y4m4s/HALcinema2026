/* eslint-disable */
// @ts-nocheck
import { escapeHtml } from './utils'

export function AccountStep({ stepNo, canProceed, isFirstStep }) {
  return `
    <section class="booking-step-panel booking-step-constrained">
      <div class="booking-panel-head">
        <span>STEP ${escapeHtml(stepNo)}</span>
        <h2>購入方法を選択してください</h2>
      </div>
      <div class="booking-step-body">
        <div class="account-panels">
          <section class="account-panel">
            <div class="account-panel-title">
              <span>MEMBER</span>
              <h3>会員の方</h3>
            </div>
            <p class="account-lead">メールアドレス、ログインID、または会員番号でログインできます。</p>
            <div class="account-login-form">
              <label class="account-login-row">
                <span class="account-login-label">ID <em>必須</em></span>
                <input type="text" autocomplete="username" placeholder="メールアドレス / ログインID / 会員番号">
              </label>
              <label class="account-login-row">
                <span class="account-login-label">パスワード <em>必須</em></span>
                <input type="password" autocomplete="current-password">
              </label>
            </div>
            <span class="account-link">パスワードをお忘れの方はこちら</span>
            <div class="account-panel-actions">
              <button class="btn-primary account-login-button" type="button" disabled>ログイン</button>
            </div>
            <div class="account-notes">
              <p>劇場窓口で入会された方の初期パスワードは生年月日の下6桁です。</p>
              <p>WEBで入会された方は登録時に設定したパスワードを入力してください。</p>
            </div>
          </section>

          <section class="account-panel account-panel-guest">
            <div class="account-panel-title">
              <span>GUEST</span>
              <h3>会員でない方</h3>
            </div>
            <div class="account-promo" aria-label="HAL CINEMA MEMBERS">
              <div>
                <span class="account-promo-kicker">HAL CINEMA MEMBERS</span>
                <strong>映画をもっと快適に</strong>
                <p>鑑賞ポイント、会員限定のお知らせ、スムーズな予約確認をまとめて利用できます。</p>
              </div>
              <ul>
                <li>ポイント付与</li>
                <li>会員特典</li>
                <li>予約履歴</li>
              </ul>
            </div>
            <div class="account-panel-actions account-guest-actions">
              <button class="btn-ghost account-join-button" type="button" disabled>入会する</button>
              <button class="btn-primary" type="button" data-action="next" ${!canProceed ? 'disabled' : ''}>入会せず購入に進む</button>
            </div>
          </section>
        </div>
        <div class="booking-nav-row account-nav-row">
          <button class="btn-ghost" type="button" data-action="prev" ${isFirstStep ? 'disabled' : ''}>戻る</button>
        </div>
      </div>
    </section>
  `
}
