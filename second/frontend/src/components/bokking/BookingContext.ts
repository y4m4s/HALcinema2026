/* eslint-disable */
// @ts-nocheck
import { escapeAttr, escapeHtml } from './utils'

export function BookingContext({ state, screen }) {
  const poster = state.movie.image
    ? `<img src="${escapeAttr(state.movie.image)}" alt="${escapeAttr(state.movie.title)}のポスター">`
    : `<div class="booking-context-poster-ph">NO IMAGE</div>`
  const time = state.slot ? `${state.slot.start} - ${state.slot.end}` : '上映回未選択'

  return `
    <div class="booking-context-poster">${poster}</div>
    <div class="booking-context-body">
      <div class="booking-context-heading">
        <div>
          <div class="booking-context-kicker">RESERVATION</div>
          <h2 class="booking-context-title">${escapeHtml(state.movie.title)}</h2>
        </div>
      </div>
      <div class="booking-context-meta" aria-label="予約中の上映情報">
        <div>
          <span>DATE</span>
          <strong>${escapeHtml(state.date)}</strong>
        </div>
        <div>
          <span>SCREEN</span>
          <strong>スクリーン ${escapeHtml(state.screen || '-')}</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong>${escapeHtml(time)}</strong>
        </div>
        ${screen ? `
          <div>
            <span>THEATER</span>
            <strong>${escapeHtml(screen.type)} / ${escapeHtml(screen.seats)}席</strong>
          </div>
        ` : ''}
        <a class="booking-context-link" href="/detail?id=${encodeURIComponent(state.movie.id)}#detail-booking">
          <span>作品詳細</span>
          <b aria-hidden="true">&rarr;</b>
        </a>
      </div>
    </div>
  `
}
