/* eslint-disable */
// @ts-nocheck
import { escapeHtml, formatYen, renderStepNav } from './utils'

export function TermsStep({ state, stepNo, totals, canProceed, isFirstStep }) {
  const checked = state.agreed ? 'checked' : ''
  const showTime = state.slot ? `${state.slot.start} - ${state.slot.end}` : '上映回未選択'

  return `
    <section class="booking-step-panel booking-step-constrained">
      <div class="booking-panel-head">
        <span>STEP ${escapeHtml(stepNo)}</span>
        <h2>購入内容と利用規約をご確認ください</h2>
      </div>
      <div class="booking-step-body">
        <section class="terms-summary-section" aria-labelledby="terms-summary-title">
          <h3 id="terms-summary-title">購入内容</h3>
          <dl class="terms-summary-table">
            <div>
              <dt>劇場名</dt>
              <dd>HALシネマ 境界</dd>
            </div>
            <div>
              <dt>作品名</dt>
              <dd>${escapeHtml(state.movie.title)}</dd>
            </div>
            <div>
              <dt>シアター</dt>
              <dd>スクリーン ${escapeHtml(state.screen || '-')}</dd>
            </div>
            <div>
              <dt>鑑賞日時</dt>
              <dd>${escapeHtml(state.date)} ${escapeHtml(showTime)}</dd>
            </div>
            <div>
              <dt>座席</dt>
              <dd>${escapeHtml(state.selectedSeats.join(' / ') || '-')}</dd>
            </div>
            <div>
              <dt>料金</dt>
              <dd>${formatYen(totals.total)}${totals.screenSurcharge ? `（${escapeHtml(totals.screenSurcharge.label)} ${formatYen(totals.screenSurcharge.total)}含む）` : ''}</dd>
            </div>
          </dl>
        </section>

        <section class="terms-agreement-section" aria-labelledby="terms-title">
          <div class="terms-section-head">
            <span>AGREEMENT</span>
            <h3 id="terms-title">利用規約</h3>
            <p>利用規約と注意事項をご確認の上、同意して次へ進んでください。</p>
          </div>

          <div class="terms-box" tabindex="0">
            <div class="terms-box-title">オンラインチケット購入に関する利用規約</div>
            <div class="terms-box-body">
              <h4>本サービスの内容と利用条件</h4>
              <ol>
                <li>本サービスは、HALシネマが運営する劇場において、事前にインターネットで座席指定チケットを購入できるサービスです。</li>
                <li>本サービスをご利用いただけるのは、本規約に同意されたお客様のみです。お客様が本規約に違反した場合、本サービスの利用をお断りすることがあります。</li>
                <li>お客様はご自身の責任で、インターネットおよび電子メールに接続できる環境を設定してください。通信環境や端末の不具合による影響について、当劇場は責任を負いかねます。</li>
                <li>チケット購入後のキャンセル、作品・上映回・券種・座席の変更、払い戻しはできません。</li>
                <li>R15+、R18+作品では、入場時に年齢確認を行う場合があります。確認できない場合は入場をお断りすることがあります。</li>
                <li>上映開始時刻を過ぎてからの入場は、劇場スタッフの案内に従ってください。混雑状況により入場を制限する場合があります。</li>
                <li>コンビニ払いを選択した場合、支払期限を過ぎると予約は自動で取り消されます。</li>
              </ol>
            </div>
          </div>

          <div class="terms-caution">
            <strong>ご利用劇場の注意事項</strong>
            <p>無料鑑賞券、招待券、その他一部の券種はオンライン予約の対象外となる場合があります。</p>
            <p>上映当日は、購入完了メールまたは予約番号をご用意ください。</p>
          </div>
        </section>

        <label class="booking-check terms-check">
          <input type="checkbox" data-terms-check ${checked}>
          <span>上記の利用規約に同意する</span>
        </label>
        ${renderStepNav({ isFirstStep, canProceed, nextLabel: '同意して次へ' })}
      </div>
    </section>
  `
}
