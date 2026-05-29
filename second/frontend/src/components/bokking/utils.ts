/* eslint-disable */
// @ts-nocheck

export function renderStepNav({ isFirstStep, canProceed, nextLabel }) {
  return `
    <div class="booking-nav-row">
      <button class="btn-ghost" type="button" data-action="prev" ${isFirstStep ? 'disabled' : ''}>戻る</button>
      <button class="btn-primary" type="button" data-action="next" ${!canProceed ? 'disabled' : ''}>${escapeHtml(nextLabel)}</button>
    </div>
  `
}

export function renderInput({ field, label, placeholder, state, type = 'text' }) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input type="${escapeAttr(type)}" value="${escapeAttr(state.customer[field])}" data-customer-field="${escapeAttr(field)}" placeholder="${escapeAttr(placeholder)}">
    </label>
  `
}

export function renderReviewItem(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || '-')}</strong>
    </div>
  `
}

export function formatYen(value) {
  return `${Number(value || 0).toLocaleString('ja-JP')}円`
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function escapeAttr(value) {
  return escapeHtml(value)
}
