/* eslint-disable */
// @ts-nocheck
import { escapeHtml, formatYen } from '../components/bokking/utils'

export function runReservation() {
  const form = document.getElementById('reservation-lookup-form')
  const resultRoot = document.getElementById('reservation-result')
  if (!form || !resultRoot) return
  const shell = form.closest('.reservation-shell')

  form.addEventListener('input', function (event) {
    const target = event.target instanceof HTMLInputElement ? event.target : null
    if (!target) return
    if (target.name === 'reservationId') {
      let v = target.value.toUpperCase().replace(/[^R0-9]/g, '')
      const rCount = (v.match(/R/g) || []).length
      if (rCount > 1) v = 'R' + v.replace(/R/g, '')
      if (v.length > 0 && !v.startsWith('R')) v = 'R' + v.replace(/R/g, '')
      target.value = v.slice(0, 11)
    }
    if (target.name === 'email') {
      target.value = target.value.trim().slice(0, 254)
    }
    if (target.name === 'tel') {
      target.value = normalizeTel(target.value)
    }
  })

  form.addEventListener('submit', async function (event) {
    event.preventDefault()
    const data = new FormData(form)
    const reservationId = String(data.get('reservationId') || '').trim().toUpperCase()
    const email = String(data.get('email') || '').trim()
    const tel = String(data.get('tel') || '').trim()

    if (!reservationId || !email || !tel) {
      renderError('予約番号、メールアドレス、電話番号を入力してください。')
      return
    }

    setLoading(true)
    resultRoot.innerHTML = ''


    try {
      const result = await requestJSON('/api/reservations/lookup', {
        method: 'POST',
        body: JSON.stringify({ reservationId, email, tel }),
      })
      renderReservation(result)
      resultRoot.querySelector('[data-reservation-back]')?.addEventListener('click', () => {
        resultRoot.innerHTML = ''
        shell?.classList.remove('has-result')
      })
      shell?.classList.add('has-result')

    } catch (error) {
      renderError(error instanceof Error ? error.message : '予約情報の確認に失敗しました。')
      shell?.classList.remove('has-result')
    } finally {
      setLoading(false)
    }
  })

  function renderReservation(reservation) {
    const seats = Array.isArray(reservation.seats) ? reservation.seats : []
    const tickets = Array.isArray(reservation.tickets) ? reservation.tickets : []
    const payment = reservation.payment || {}
    const customer = reservation.customer || {}

    resultRoot.innerHTML = `
      <section class="reservation-detail-panel">
        <div class="reservation-detail-head">
          <div>
            <span>RESERVATION</span>
            <h2>${escapeHtml(reservation.movieTitle || '-')}</h2>
          </div>
          <div class="reservation-detail-actions">
            <button type="button" class="reservation-back btn-ghost" data-reservation-back>別の予約を確認する</button>
            <strong>${escapeHtml(statusLabel(reservation.status))}</strong>
          </div>
          </div>
        <div class="review-grid reservation-review-grid">
          ${reviewItem('予約番号', reservation.reservationId)}
          ${reviewItem('上映日時', `${dateLabel(reservation.date)} ${reservation.start || ''} - ${reservation.end || ''}`)}
          ${reviewItem('スクリーン', reservation.screen)}
          ${reviewItem('座席', seats.length ? seats.join(' / ') : '-')}
          ${reviewItem('購入者', customer.name)}
          ${reviewItem('メール', customer.email)}
          ${reviewItem('電話番号', customer.tel)}
          ${reviewItem('支払方法', payment.method)}
          ${reviewItem('支払状況', paymentStatusLabel(payment.status))}
        </div>
        <div class="review-tickets reservation-ticket-lines">
          ${tickets.map((ticket) => `
            <div>
              <span>${escapeHtml(ticket.name)} x ${escapeHtml(ticket.count || 1)}</span>
              <strong>${formatYen(ticket.price)}</strong>
            </div>
          `).join('')}
          <div class="grand">
            <span>お支払い合計</span>
            <strong>${formatYen(payment.amount)}</strong>
          </div>
        </div>
      </section>
    `
  }

  function renderError(message) {
    resultRoot.innerHTML = `
      <div class="reservation-message error">
        <strong>確認できませんでした</strong>
        <span>${escapeHtml(message)}</span>
      </div>
    `
  }

  function setLoading(loading) {
    const button = form.querySelector('button[type="submit"]')
    if (!button) return
    button.disabled = loading
    button.textContent = loading ? '確認中...' : '予約を確認する'
  }
}

function reviewItem(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || '-')}</strong>
    </div>
  `
}

function statusLabel(status) {
  const labels = {
    pending: '支払待ち',
    confirmed: '予約確定',
    cancelled: 'キャンセル済み',
    used: '入場済み',
    expired: '期限切れ',
  }
  return labels[status] || status || '-'
}

function paymentStatusLabel(status) {
  const labels = {
    unpaid: '未払い',
    paid: '支払済み',
    failed: '失敗',
    refunded: '返金済み',
    cancelled: '取消済み',
  }
  return labels[status] || status || '-'
}

function dateLabel(value) {
  if (!value) return ''
  return String(value).replace(/-/g, '/')
}

function normalizeTel(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 15)
}

async function requestJSON(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || '通信に失敗しました。')
  return data
}
