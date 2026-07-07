/* eslint-disable */
// @ts-nocheck
import { escapeHtml, renderStepNav } from './utils'

export function SeatStep({
  state,
  stepNo,
  screens,
  selectedUnits,
  ticketUnits,
  seatMapHtml,
  canProceed,
  isFirstStep,
}) {
  const selectedScreen = screens.find((screen) => screen.num === Number(state.screen))
  const showTime = state.slot ? `${state.slot.start} - ${state.slot.end}` : '上映回未選択'
  const remainingSeats = ticketUnits - selectedUnits
  const seatStatus = ticketUnits === 0
    ? { type: 'warning', message: '先に券種を選択してください。' }
    : remainingSeats === 0
      ? { type: 'ok', message: '必要な座席数を選択済みです。' }
      : remainingSeats > 0
        ? { type: 'pending', message: `あと${remainingSeats}席選択してください。` }
        : { type: 'warning', message: `${Math.abs(remainingSeats)}席分多く選択されています。座席を減らしてください。` }
  const selectedScreenInfo = selectedScreen
    ? `
      <div class="seat-screen-info">
        <div>
          <span>SELECTED SHOW</span>
          <strong>${escapeHtml(state.date)} ${escapeHtml(showTime)}</strong>
        </div>
        <p>スクリーン ${escapeHtml(selectedScreen.num)} / ${escapeHtml(selectedScreen.type)} / ${escapeHtml(selectedScreen.seats)}席</p>
      </div>`
    : ''

  return `
    <section class="booking-step-panel">
      <div class="booking-panel-head">
        <span>STEP ${escapeHtml(stepNo)}</span>
        <h2>座席を選択してください</h2>
      </div>
      ${selectedScreenInfo}
      <div class="seat-selection-status ${seatStatus.type}">
        <span>必要座席 ${escapeHtml(ticketUnits)}席</span>
        <strong>選択中 ${escapeHtml(selectedUnits)}席</strong>
        <em>${escapeHtml(seatStatus.message)}</em>
      </div>
      <div class="seat-stage">SCREEN${selectedScreen ? ` ${escapeHtml(selectedScreen.num)}` : ''}</div>
      <div class="seat-map${selectedUnits > 0 ? ' has-selection' : ''}" aria-label="座席表">${seatMapHtml}</div>
      <div class="seat-legend">
        <span><i class="legend-free"></i>選択可能</span>
        <span><i class="legend-selected"></i>選択中</span>
        <span><i class="legend-unavailable"></i>予約済み</span>
      </div>
      <p class="booking-help">前の画面で選択した券種の席数に合わせて座席を選択してください。</p>
      ${renderStepNav({ isFirstStep, canProceed, nextLabel: '購入内容・規約へ' })}
    </section>
  `
}
