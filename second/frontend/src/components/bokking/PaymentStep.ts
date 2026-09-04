/* eslint-disable */
// @ts-nocheck
import { escapeAttr, escapeHtml, formatCardNumber, formatYen, renderStepNav } from './utils'

export function PaymentStep({
  state,
  stepNo,
  paymentMethods,
  qrProviders,
  konbiniStores,
  cardBrand = '',
  errors = {},
  totals,
  coupon,
  canProceed,
  isFirstStep,
}) {
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
        ${renderPaymentDetail({ state, qrProviders, konbiniStores, cardBrand, errors, totals })}
        <div class="coupon-box">
          <label>
            <span>クーポンコード</span>
            <input type="text" value="${escapeAttr(state.couponInput)}" data-coupon-input placeholder="クーポンコードを入力してください。" maxlength="20" autocomplete="off" spellcheck="false" autocapitalize="characters">
          </label>
          <div class="coupon-actions">
            <button class="btn-ghost" type="button" data-action="apply-coupon" ${state.couponApplying ? 'disabled' : ''}>${state.couponApplying ? '確認中...' : '適用'}</button>
            ${state.couponCode ? `<button class="btn-ghost subtle" type="button" data-action="remove-coupon">解除</button>` : ''}
          </div>
          ${coupon ? `<p class="coupon-success">${escapeHtml(coupon.label)}: ${escapeHtml(coupon.description)}</p>` : ''}
          ${state.couponError ? `<p class="coupon-error">${escapeHtml(state.couponError)}</p>` : ''}
        </div>
        <div class="ticket-total-line">${renderPaymentTotals(totals)}</div>
        ${renderStepNav({ isFirstStep, canProceed, nextLabel: '購入確認へ' })}
      </div>
    </section>
  `
}

export function renderPaymentTotals(totals) {
  return `
    <span>券種 ${formatYen(totals.ticketSubtotal)}</span>
    ${totals.surcharge ? `<span>追加料金 ${formatYen(totals.surcharge)}</span>` : ''}
    <span>割引 -${formatYen(totals.discount)}</span>
    <strong>合計 ${formatYen(totals.total)}</strong>
  `
}

function renderPaymentDetail({ state, qrProviders, konbiniStores, cardBrand, errors, totals }) {
  if (state.payment === 'credit') return renderCardForm({ state, cardBrand, errors })
  if (state.payment === 'qr') {
    return renderOptionPicker({
      title: '決済サービスを選択',
      note: '購入確定後、選択したサービスの決済画面へ進みます。',
      field: 'qrProvider',
      options: qrProviders,
      selected: state.paymentDetails.qrProvider,
    })
  }
  if (state.payment === 'konbini') {
    return renderOptionPicker({
      title: '支払うコンビニを選択',
      note: `購入確定後に払込番号を発行します。お支払い金額は ${formatYen(totals.total)} です。支払期限までは座席を仮押さえします。`,
      field: 'konbiniStore',
      options: konbiniStores,
      selected: state.paymentDetails.konbiniStore,
    })
  }
  return ''
}

function renderCardForm({ state, cardBrand, errors }) {
  const d = state.paymentDetails
  return `
    <div class="payment-detail">
      <div class="payment-detail-head">
        <strong>カード情報を入力</strong>
        <span>ご本人名義のカードをご利用ください。</span>
      </div>
      <div class="payment-field-grid">
        ${renderPaymentField({
          label: 'カード番号',
          field: 'cardNumber',
          value: formatCardNumber(d.cardNumber),
          placeholder: '4111 1111 1111 1111',
          maxlength: 19,
          inputmode: 'numeric',
          error: errors.cardNumber,
          brand: cardBrand,
          wide: true,
        })}
        ${renderPaymentField({
          label: '有効期限',
          field: 'cardExpiry',
          value: d.cardExpiry,
          placeholder: 'MM/YY',
          maxlength: 5,
          inputmode: 'numeric',
          error: errors.cardExpiry,
        })}
        ${renderPaymentField({
          label: 'セキュリティコード',
          field: 'cardCvc',
          value: d.cardCvc,
          placeholder: '123',
          maxlength: 3,
          inputmode: 'numeric',
          error: errors.cardCvc,
        })}
        ${renderPaymentField({
          label: 'カード名義',
          field: 'cardHolder',
          value: d.cardHolder,
          placeholder: 'HAL TARO',
          maxlength: 40,
          inputmode: 'latin',
          error: errors.cardHolder,
          wide: true,
        })}
      </div>
    </div>
  `
}

function renderPaymentField({ label, field, value, placeholder, maxlength, inputmode, error, wide, brand }) {
  const input = `
      <input
        type="text"
        value="${escapeAttr(value)}"
        data-payment-field="${escapeAttr(field)}"
        placeholder="${escapeAttr(placeholder)}"
        maxlength="${escapeAttr(maxlength)}"
        inputmode="${escapeAttr(inputmode)}"
        autocomplete="off"
        spellcheck="false">`

  const control = brand === undefined
    ? input
    : `<span class="payment-field-input">${input}
        <span class="payment-field-brand" data-payment-brand>${escapeHtml(brand)}</span>
      </span>`

  return `
    <label class="payment-field${wide ? ' payment-field-wide' : ''}">
      <span>${escapeHtml(label)}</span>
      ${control}
      <p class="payment-field-error" data-payment-error="${escapeAttr(field)}">${error ? escapeHtml(error) : ''}</p>
    </label>
  `
}

function renderOptionPicker({ title, note, field, options, selected }) {
  const buttons = options.map((option) => `
    <button class="payment-option${selected === option.id ? ' active' : ''}" type="button"
      data-payment-option="${escapeAttr(field)}" data-payment-option-value="${escapeAttr(option.id)}"
      aria-pressed="${selected === option.id ? 'true' : 'false'}">
      ${escapeHtml(option.label)}
    </button>
  `).join('')

  return `
    <div class="payment-detail">
      <div class="payment-detail-head">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(note)}</span>
      </div>
      <div class="payment-option-grid">${buttons}</div>
    </div>
  `
}
