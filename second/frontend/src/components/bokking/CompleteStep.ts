/* eslint-disable */
// @ts-nocheck
import { escapeHtml } from './utils'

export function CompleteStep({ confirmationNo }) {
  return `
    <section class="booking-step-panel complete">
      <div class="complete-mark">DONE</div>
      <h2>購入が完了しました</h2>
      <p>予約番号をメールでお送りしました。入場時は予約番号と本人確認書類をご用意ください。</p>
      <div class="complete-number">
        <span>予約番号</span>
        <strong>${escapeHtml(confirmationNo)}</strong>
      </div>
      <div class="complete-actions">
        <a class="btn-primary" href="/schedule">上映スケジュールへ</a>
        <a class="btn-ghost" href="/">トップページへ</a>
      </div>
    </section>
  `
}
