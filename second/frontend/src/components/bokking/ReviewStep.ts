/* eslint-disable */
// @ts-nocheck
import { escapeHtml, formatYen, renderReviewItem } from './utils'

export function ReviewStep({ state, stepNo, ticketTypes, totals, payment, customerName, phoneNumber }) {
  const submitting = Boolean(state.submittingReservation)
  const error = state.reservationError
  return `
    <section class="booking-step-panel booking-step-constrained">
      <div class="booking-panel-head">
        <span>STEP ${escapeHtml(stepNo)}</span>
        <h2>購入内容を確認してください</h2>
      </div>
      <div class="booking-step-body">
        <div class="review-grid">
          ${renderReviewItem('作品', state.movie.title)}
          ${renderReviewItem('上映日時', `${state.date} ${state.slot ? state.slot.start + ' - ' + state.slot.end : ''}`)}
          ${renderReviewItem('スクリーン', `スクリーン ${state.screen || '-'}`)}
          ${renderReviewItem('座席', state.selectedSeats.join(' / '))}
          ${state.member ? renderReviewItem('会員番号', state.member.memberNo) : ''}
          ${renderReviewItem('購入者', customerName)}
          ${renderReviewItem('メール', state.customer.email)}
          ${renderReviewItem('電話番号', phoneNumber)}
          ${renderReviewItem('支払方法', payment ? payment.label : '')}
        </div>
        <div class="review-tickets">
          ${ticketTypes.filter((ticket) => state.tickets[ticket.id]).map((ticket) => `
            <div>
              <span>${escapeHtml(ticket.label)} x ${state.tickets[ticket.id]}</span>
              <strong>${formatYen(ticket.price * state.tickets[ticket.id])}</strong>
            </div>
          `).join('')}
          ${totals.screenSurcharge ? `
            <div>
              <span>${escapeHtml(totals.screenSurcharge.label)} x ${escapeHtml(totals.screenSurcharge.units)}</span>
              <strong>${formatYen(totals.screenSurcharge.total)}</strong>
            </div>
          ` : ''}
          <div>
            <span>割引</span>
            <strong>-${formatYen(totals.discount)}</strong>
          </div>
          <div class="grand">
            <span>お支払い合計</span>
            <strong>${formatYen(totals.total)}</strong>
          </div>
        </div>
        <div class="booking-nav-row">
          <button class="btn-ghost" type="button" data-action="prev">戻る</button>
          <button class="btn-primary" type="button" data-action="complete" ${submitting ? 'disabled' : ''}>${submitting ? '予約を保存中...' : '購入を確定する'}</button>
        </div>
        ${error ? `<p class="coupon-error">${escapeHtml(error)}</p>` : ''}
      </div>
    </section>
  `
}
