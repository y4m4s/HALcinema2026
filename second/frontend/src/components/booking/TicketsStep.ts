/* eslint-disable */
// @ts-nocheck
import { escapeAttr, escapeHtml, formatYen, renderStepNav } from './utils'

export function TicketsStep({
  state,
  stepNo,
  ticketTypes,
  totals,
  pricingNotices = [],
  maxSeatsPerOrder = 6,
  canProceed,
  isFirstStep,
}) {
  const selectedUnits = ticketTypes.reduce((sum, ticket) => {
    return sum + ticket.seats * Number(state.tickets[ticket.id] || 0)
  }, 0)
  const ticketRows = ticketTypes.map((ticket) => {
    const count = Number(state.tickets[ticket.id] || 0)
    const active = count > 0
    const unavailable = ticket.onlineAvailable === false
    const incrementDisabled = unavailable || selectedUnits + ticket.seats > maxSeatsPerOrder
    const priceChanged = ticket.basePrice && ticket.basePrice !== ticket.price
    const unitLabel = ticket.seats === 1 ? '1席分' : `${ticket.seats}席分`
    return `
    <div class="ticket-option${active ? ' active' : ''}${unavailable ? ' disabled' : ''}" data-ticket-choice="${escapeAttr(ticket.id)}">
      <div class="ticket-option-main">
        <strong>${escapeHtml(ticket.label)}</strong>
        <span>${escapeHtml(ticket.note)} / ${formatYen(ticket.price)}</span>
        ${priceChanged ? `<small>通常 ${formatYen(ticket.basePrice)} / ${escapeHtml(ticket.priceNote)}</small>` : ''}
        ${unavailable ? '<small>オンラインでは選択できません。劇場窓口で手帳確認のうえ適用します。</small>' : ''}
      </div>
      <div class="ticket-option-side">
        <em>${escapeHtml(unitLabel)}</em>
        <div class="ticket-option-controls" aria-label="${escapeAttr(ticket.label)}の枚数">
          <button class="ticket-quantity-button" type="button" data-ticket-decrement="${escapeAttr(ticket.id)}" ${unavailable || count <= 0 ? 'disabled' : ''}>-</button>
          <strong class="ticket-quantity-count">${escapeHtml(count)}</strong>
          <button class="ticket-quantity-button" type="button" data-ticket-increment="${escapeAttr(ticket.id)}" ${incrementDisabled ? 'disabled' : ''}>+</button>
        </div>
      </div>
    </div>
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
        <div class="ticket-list">${ticketRows}</div>
        <p class="booking-help">一度に予約できる座席は最大6席です。券種の合計席数に合わせて、次の画面で座席を選択してください。</p>
        ${notices}
        <div class="ticket-total-line">
          <span>券種 ${formatYen(totals.ticketSubtotal)}</span>
          ${totals.surcharge ? `<span>追加料金 ${formatYen(totals.surcharge)}</span>` : ''}
          <span>割引 -${formatYen(totals.discount)}</span>
          <strong>合計 ${formatYen(totals.total)}</strong>
        </div>
        ${renderStepNav({ isFirstStep, canProceed, nextLabel: '座席選択へ' })}
      </div>
    </section>
  `
}
