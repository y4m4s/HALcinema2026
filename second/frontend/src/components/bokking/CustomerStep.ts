/* eslint-disable */
// @ts-nocheck
import { escapeAttr, escapeHtml, renderStepNav } from './utils'

export function CustomerStep({ state, stepNo, canProceed, isFirstStep }) {
  return `
    <section class="booking-step-panel booking-step-constrained">
      <div class="booking-panel-head">
        <span>STEP ${escapeHtml(stepNo)}</span>
        <h2>お客様情報入力</h2>
      </div>

      <div class="booking-step-body">
        <div class="customer-form-card">
          ${renderCustomerRow({
            label: '氏名',
            field: 'name',
            value: state.customer.name,
            placeholder: '例）東急太郎',
            maxlength: 40,
          })}
          ${renderCustomerRow({
            label: '氏名（かな）',
            field: 'nameKana',
            value: state.customer.nameKana,
            placeholder: '例）とうきゅうたろう',
            maxlength: 60,
          })}
          <div class="customer-form-row">
            <div class="customer-label">
              <span>電話番号</span>
              <strong>必須</strong>
            </div>
            <div class="customer-control">
              <div class="customer-tel-group">
                <input type="tel" inputmode="numeric" value="${escapeAttr(state.customer.tel)}" data-customer-field="tel" placeholder="例）0123456789" maxlength="15">
              </div>
            </div>
          </div>
          <div class="customer-form-row customer-mail-row">
            <div class="customer-label">
              <span>購入完了メール送信先</span>
              <strong>必須</strong>
            </div>
            <div class="customer-control">
              <input type="email" value="${escapeAttr(state.customer.email)}" data-customer-field="email" placeholder="例）tokyu109cinemas@tokyu.109cinemas.net" maxlength="254">
              <p>確認のためにもう一度入力してください。</p>
              <input type="email" value="${escapeAttr(state.customer.emailConfirm)}" data-customer-field="emailConfirm" placeholder="" maxlength="254">
            </div>
          </div>
        </div>

        <div class="customer-notes">
          <p>※入力いただいた電話番号は、チケット照会に必要です。</p>
          <p>※入力いただいたメールアドレスに「購入完了メール」を送信いたします。</p>
          <p>※パソコン・携帯電話のメール設定で迷惑メール防止の為にドメイン指定受信を設定されている場合、あらかじめ指定メールアドレス「@tokyu-rec.co.jp」を追加してください。</p>
          <p class="customer-notes-alert">※メールアドレスの国際基準「RFC（Request For Comments）」の定める仕様に準拠しない特殊なメールアドレスを使用されている場合、メールが配信できない場合や、決済認証時にエラーが発生する場合がございます。</p>
        </div>

        ${renderStepNav({ isFirstStep, canProceed, nextLabel: '支払方法へ' })}
      </div>
    </section>
  `
}

function renderCustomerRow({ label, field, value, placeholder, maxlength }) {
  return `
    <div class="customer-form-row">
      <div class="customer-label">
        <span>${escapeHtml(label)}</span>
        <strong>必須</strong>
      </div>
      <div class="customer-control">
        <input type="text" value="${escapeAttr(value)}" data-customer-field="${escapeAttr(field)}" placeholder="${escapeAttr(placeholder)}" maxlength="${escapeAttr(maxlength)}">
      </div>
    </div>
  `
}
