/* eslint-disable */
// @ts-nocheck
import { escapeHtml, renderStepNav } from './utils'

export function TermsStep({ state, stepNo, canProceed, isFirstStep }) {
  const checked = state.agreed ? 'checked' : ''
  const showTime = state.slot ? `${state.slot.start} - ${state.slot.end}` : '上映回未選択'

  return `
    <section class="booking-step-panel booking-step-constrained">
      <div class="booking-panel-head">
        <span>STEP ${escapeHtml(stepNo)}</span>
        <h2>購入内容と利用規約をご確認ください</h2>
      </div>
      <div class="booking-step-body">
        <div class="booking-confirm-strip">
          <div>
            <span>劇場名</span>
            <strong>HALシネマ 境界</strong>
          </div>
          <div>
            <span>作品名</span>
            <strong>${escapeHtml(state.movie.title)}</strong>
          </div>
          <div>
            <span>シアター番号</span>
            <strong>スクリーン ${escapeHtml(state.screen || '-')}</strong>
          </div>
          <div>
            <span>日時</span>
            <strong>${escapeHtml(state.date)} ${escapeHtml(showTime)}</strong>
          </div>
          <div>
            <span>座席</span>
            <strong>${escapeHtml(state.selectedSeats.join(' / ') || '-')}</strong>
          </div>
        </div>
        <div class="terms-box" tabindex="0">
          <p>チケット購入後のキャンセル、変更、払い戻しはできません。</p>
          <p>R15+、R18+作品では入場時に年齢確認を行う場合があります。</p>
          <p>上映開始時刻を過ぎてからの入場は、劇場スタッフの案内に従ってください。</p>
          <p>コンビニ払いを選択した場合、支払期限を過ぎると予約は自動で取り消されます。</p>
        </div>
        <label class="booking-check">
          <input type="checkbox" data-terms-check ${checked}>
          <span>購入内容と利用規約に同意します</span>
        </label>
        ${renderStepNav({ isFirstStep, canProceed, nextLabel: '購入方法へ' })}
      </div>
    </section>
  `
}
