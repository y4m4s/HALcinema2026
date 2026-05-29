/* eslint-disable */
// @ts-nocheck
import { escapeAttr, escapeHtml, formatYen, renderStepNav } from './utils'

export function TicketsStep({
  state,
  stepNo,
  ticketTypes,
  totals,
  canProceed,
  isFirstStep,
}) {
  const ticketRows = ticketTypes.map((ticket) => `
    <button class="ticket-option${state.tickets[ticket.id] ? ' active' : ''}" type="button" data-ticket-choice="${escapeAttr(ticket.id)}" aria-pressed="${state.tickets[ticket.id] ? 'true' : 'false'}">
      <div>
        <strong>${escapeHtml(ticket.label)}</strong>
        <span>${escapeHtml(ticket.note)} / ${formatYen(ticket.price)}</span>
      </div>
      <em>${escapeHtml(ticket.seats)}席</em>
    </button>
  `).join('')

  return `
    <section class="booking-step-panel booking-step-constrained">
      <div class="booking-panel-head">
        <span>STEP ${escapeHtml(stepNo)}</span>
        <h2>券種を選択してください</h2>
      </div>
      <div class="booking-step-body">
        <div class="ticket-list">${ticketRows}</div>
        <div class="ticket-total-line">
          <span>小計 ${formatYen(totals.subtotal)}</span>
          <span>割引 -${formatYen(totals.discount)}</span>
          <strong>合計 ${formatYen(totals.total)}</strong>
        </div>
        <p class="booking-help">券種は1つだけ選択できます。ペアチケットのみ2席分として座席選択に進みます。</p>
        ${renderStepNav({ isFirstStep, canProceed, nextLabel: '座席選択へ' })}
      </div>
    </section>
  `
}
