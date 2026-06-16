/* eslint-disable */
// @ts-nocheck
import { escapeHtml } from './utils'

export function BookingStepper({ steps, currentStep, maxStep }) {
  return steps
    .filter((step) => step.id !== 'complete')
    .map((step) => {
      const isActive = step.index === currentStep
      const isDone = step.index < currentStep
      const isLocked = step.index > maxStep

      return `
        <button class="booking-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}" type="button" data-step-index="${step.index}" ${isLocked ? 'disabled' : ''}>
          <span class="booking-step-num">${String(step.index + 1).padStart(2, '0')}</span>
          <span class="booking-step-label">${escapeHtml(step.label)}</span>
          <span class="booking-step-en">${escapeHtml(step.en)}</span>
        </button>
      `
    })
    .join('')
}
