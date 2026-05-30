/* eslint-disable */
// @ts-nocheck
import { escapeAttr, escapeHtml, formatYen, renderStepNav } from './utils'

export function TicketsStep({
  state,
  stepNo,
  ticketTypes,
  totals,
  pricingNotices = [],
  canProceed,
  isFirstStep,
}) {
  const ticketRows = ticketTypes.map((ticket) => {
    const active = state.tickets[ticket.id]
    const unavailable = ticket.onlineAvailable === false
    const priceChanged = ticket.basePrice && ticket.basePrice !== ticket.price
    return `
    <button class="ticket-option${active ? ' active' : ''}${unavailable ? ' disabled' : ''}" type="button" data-ticket-choice="${escapeAttr(ticket.id)}" aria-pressed="${active ? 'true' : 'false'}" ${unavailable ? 'disabled' : ''}>
      <div>
        <strong>${escapeHtml(ticket.label)}</strong>
        <span>${escapeHtml(ticket.note)} / ${formatYen(ticket.price)}</span>
        ${priceChanged ? `<small>通常 ${formatYen(ticket.basePrice)} / ${escapeHtml(ticket.priceNote)}</small>` : ''}
        ${unavailable ? '<small>オンラインでは選択できません。劇場窓口で手帳確認のうえ適用します。</small>' : ''}
      </div>
      <em>${escapeHtml(ticket.seats)}席</em>
    </button>
  `}).join('')

  const notices = pricingNotices.length
    ? `
      <div class="ticket-pricing-notes">
        ${pricingNotices.map(notice => `
          <div>
            <strong>${escapeHtml(notice.title)}</strong>
            <span>${escapeHtml(notice.body)}</span>
          </div>
        `).join('')}
      </div>
    `
    : ''

  return `
    <section class="booking-step-panel booking-step-constrained">
      <div class="booking-panel-head">
        <span>STEP ${escapeHtml(stepNo)}</span>
        <h2>券種を選択してください</h2>
      </div>
      <div class="booking-step-body">
        ${notices}
        <div class="ticket-list">${ticketRows}</div>
        <div class="ticket-total-line">
          <span>券種 ${formatYen(totals.ticketSubtotal)}</span>
          ${totals.surcharge ? `<span>追加料金 ${formatYen(totals.surcharge)}</span>` : ''}
          <span>割引 -${formatYen(totals.discount)}</span>
          <strong>合計 ${formatYen(totals.total)}</strong>
        </div>
        <p class="booking-help">券種は1つだけ選択できます。ペアチケットのみ2席分として座席選択に進みます。</p>
        ${renderStepNav({ isFirstStep, canProceed, nextLabel: '座席選択へ' })}
      </div>
    </section>
  `
}
