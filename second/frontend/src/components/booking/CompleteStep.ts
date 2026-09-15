/* eslint-disable */
// @ts-nocheck
import { escapeAttr, escapeHtml } from './utils'

export function CompleteStep({ confirmationNo, copied }) {
  return `
    <section class="booking-step-panel complete">
      <h2>購入が完了しました</h2>
      <p>予約番号を控えてください。</br>入場時は予約番号と本人確認書類をご用意ください。</p>
      <div class="complete-number">
        <span>予約番号</span>
        <div class="complete-number-row">
          <strong>${escapeHtml(confirmationNo)}</strong>
          <button type="button" class="complete-copy-button" data-action="copy-reservation-no" aria-label="予約番号 ${escapeAttr(confirmationNo)} をコピー">
            <svg class="complete-copy-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="8" y="8" width="11" height="11" rx="2"></rect>
              <path d="M5 15V7a2 2 0 0 1 2-2h8"></path>
            </svg>
          </button>
        </div>
        <div class="complete-copy-status" aria-live="polite">${copied ? 'コピーできました' : ''}</div>
      </div>
      <div class="complete-actions">
        <a class="btn-primary" href="/reservation">予約確認へ</a>
        <a class="btn-primary" href="/schedule">上映スケジュールへ</a>
        <a class="btn-ghost" href="/">トップページへ</a>
      </div>
    </section>
  `
}
