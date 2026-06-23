/* eslint-disable */
// @ts-nocheck
import { escapeAttr, escapeHtml, formatYen, renderStepNav } from './utils'

export function PaymentStep({ state, stepNo, paymentMethods, totals, coupon, canProceed, isFirstStep }) {
  const methods = paymentMethods.map((method) => `
    <button class="payment-choice${state.payment === method.id ? ' active' : ''}" type="button" data-payment-choice="${escapeAttr(method.id)}">
      <strong>${escapeHtml(method.label)}</strong>
      <span>${escapeHtml(method.note)}</span>
    </button>
  `).join('')

  return `
    <section class="booking-step-panel booking-step-constrained">
      <div class="booking-panel-head">
        <span>STEP ${escapeHtml(stepNo)}</span>
        <h2>支払方法を選択してください</h2>
      </div>
      <div class="booking-step-body">
        <div class="payment-grid">${methods}</div>
        <div class="coupon-box">
          <label>
            <span>クーポンコード</span>
            <input type="text" value="${escapeAttr(state.couponInput)}" data-coupon-input placeholder="クーポンコードを入力してください。" maxlength="20" autocomplete="off" spellcheck="false" autocapitalize="characters">
          </label>
          <div class="coupon-actions">
            <button class="btn-ghost" type="button" data-action="apply-coupon">適用</button>
            ${state.couponCode ? `<button class="btn-ghost subtle" type="button" data-action="remove-coupon">解除</button>` : ''}
          </div>
          ${coupon ? `<p class="coupon-success">${escapeHtml(coupon.label)}: ${escapeHtml(coupon.description)}</p>` : ''}
          ${state.couponError ? `<p class="coupon-error">${escapeHtml(state.couponError)}</p>` : ''}
        </div>
        <div class="ticket-total-line">
          <span>券種 ${formatYen(totals.ticketSubtotal)}</span>
          ${totals.surcharge ? `<span>追加料金 ${formatYen(totals.surcharge)}</span>` : ''}
          <span>割引 -${formatYen(totals.discount)}</span>
          <strong>合計 ${formatYen(totals.total)}</strong>
        </div>
        <div class="booking-note-box">
          <strong>デモ実装について</strong>
          <span>この画面では決済情報の入力は行わず、支払方法の選択のみ保持します。</span>
        </div>
        ${renderStepNav({ isFirstStep, canProceed, nextLabel: '購入確認へ' })}
      </div>
    </section>
  `
}
