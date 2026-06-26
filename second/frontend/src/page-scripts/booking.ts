/* eslint-disable */
// @ts-nocheck
import { AccountStep } from '../components/bokking/AccountStep'
import { BookingContext } from '../components/bokking/BookingContext'
import { BookingStepper } from '../components/bokking/BookingStepper'
import { CompleteStep } from '../components/bokking/CompleteStep'
import { CustomerStep } from '../components/bokking/CustomerStep'
import { PaymentStep } from '../components/bokking/PaymentStep'
import { ReviewStep } from '../components/bokking/ReviewStep'
import { SeatStep } from '../components/bokking/SeatStep'
import { TermsStep } from '../components/bokking/TermsStep'
import { TicketsStep } from '../components/bokking/TicketsStep'
import { escapeAttr, escapeHtml, formatYen } from '../components/bokking/utils'
import { MOVIES, SCREENS, DATES } from './data'

const FLOW_STEPS = [
  { id: 'tickets', label: '券種選択', en: 'TICKET' },
  { id: 'seat', label: '座席選択', en: 'SEAT' },
  { id: 'terms', label: '購入確認・同意', en: 'TERMS' },
  { id: 'account', label: '購入方法', en: 'ACCOUNT' },
  { id: 'customer', label: 'お客様情報', en: 'GUEST' },
  { id: 'payment', label: '支払方法', en: 'PAYMENT' },
  { id: 'review', label: '購入確認', en: 'REVIEW' },
  { id: 'complete', label: '購入完了', en: 'DONE' },
]

const TICKET_TYPES = [
  { id: 'pair', label: 'ペアチケット', note: '2名分', price: 3200, seats: 2, serviceDayEligible: true },
  { id: 'adult', label: '一般', note: '大人', price: 1800, seats: 1, serviceDayEligible: true },
  { id: 'university', label: '大学生・専門学生', note: '学生証提示', price: 1600, seats: 1, serviceDayEligible: true },
  { id: 'student', label: '中学・高校生', note: '学生証提示', price: 1400, seats: 1, serviceDayEligible: true },
  { id: 'child', label: '小学生・幼児', note: '3歳以上', price: 1000, seats: 1, serviceDayEligible: false },
  { id: 'senior', label: 'シニア', note: '60歳以上', price: 1200, seats: 1, serviceDayEligible: true },
  { id: 'disability', label: '障がい者', note: '手帳提示 / 窓口のみ', price: 1000, seats: 1, onlineAvailable: false },
]

const MAX_SEATS_PER_ORDER = 6
const SERVICE_DAY_PRICE = 1300
const THREE_D_EXTRA_FEE = 400
const STEP_TRANSITION_OUT_MS = 220
const STEP_TRANSITION_GAP_MS = 60
const STEP_TRANSITION_IN_MS = 460
const MEMBER_SESSION_STORAGE_KEY = 'halcinema-member-session'
const INPUT_LIMITS = {
  name: 40,
  nameKana: 60,
  email: 254,
  tel: 15,
  coupon: 20,
  loginIdentifier: 254,
  password: 128,
}

const SCREEN_SEAT_LAYOUTS = {
  200: { rows: 10, columns: 20 },
  120: { rows: 8, columns: 15 },
  70: { rows: 7, columns: 10 },
}

const PAYMENT_METHODS = [
  { id: 'credit', label: 'クレジットカード', note: '購入完了後、予約番号を発行します。' },
  { id: 'qr', label: 'QR決済', note: '外部決済画面へ進む想定のデモです。' },
  { id: 'konbini', label: 'コンビニ払い', note: '支払期限まで座席を仮押さえします。' },
]

const COUPONS = {
  LATE100: {
    label: 'レイトショー割引',
    description: '20:00以降の回で1席100円引き',
    isAvailable: (state) => Number(String(state.slot?.start || '0').split(':')[0]) >= 20,
    discount: (state) => getTicketUnitsFromState(state) * 100,
  },
  GRUP200: {
    label: 'グループ割引',
    description: '4席以上で1席200円引き',
    isAvailable: (state) => getTicketUnitsFromState(state) >= 4,
    discount: (state) => getTicketUnitsFromState(state) * 200,
  },
}

export function runBooking() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

  const stepRoot = document.getElementById('booking-step-root')
  const stepperRoot = document.getElementById('booking-stepper')
  const contextRoot = document.getElementById('booking-context')

  if (!stepRoot || !stepperRoot || !contextRoot) return

  const params = new URLSearchParams(location.search)
  const movie = resolveMovie(params)
  const initialSlot = resolveInitialSlot(movie, params)
  const initialDate = params.get('date') || getDefaultDate(movie)
  const initialStep = getStepIndex(params.get('step'))
  const savedMemberSession = readMemberSession()

  const state = {
    currentStep: initialStep,
    maxStep: initialStep,
    movie,
    date: initialDate,
    screen: initialSlot ? initialSlot.screen : null,
    slot: initialSlot ? initialSlot.slot : null,
    selectedSeats: [],
    agreed: false,
    account: savedMemberSession?.member ? 'member' : 'guest',
    member: savedMemberSession?.member || null,
    memberToken: savedMemberSession?.token || '',
    login: createLoginState(),
    join: createJoinState(),
    customer: createCustomerState(savedMemberSession?.member),
    mailMagazine: Boolean(savedMemberSession?.member?.mailMagazine),
    tickets: createEmptyTickets(),
    couponInput: '',
    couponCode: '',
    couponError: '',
    payment: 'credit',
    confirmationNo: '',
    dbReservedSeats: [],
    availabilityKey: '',
    availabilityLoading: false,
    submittingReservation: false,
    reservationError: '',
  }
  let renderedStep = null
  let isStepTransitioning = false

  stepRoot.addEventListener('click', onClick)
  stepRoot.addEventListener('input', onInput)
  stepRoot.addEventListener('change', onChange)
  stepperRoot.addEventListener('click', onStepperClick)

  render()
  if (savedMemberSession?.token) {
    void refreshMemberSession()
  }

  function onClick(event) {
    if (isStepTransitioning) return
    const target = event.target instanceof Element ? event.target : null
    if (!target) return
    const disabled = target.closest('button:disabled')
    if (disabled) return

    const seat = target.closest('[data-seat-id]')
    if (seat) {
      toggleSeat(seat.dataset.seatId)
      return
    }

    const accountChoice = target.closest('[data-account-choice]')
    if (accountChoice) {
      state.account = accountChoice.dataset.accountChoice
      state.login.error = ''
      state.join.error = ''
      render()
      return
    }

    const ticketIncrement = target.closest('[data-ticket-increment]')
    if (ticketIncrement) {
      adjustTicketCount(ticketIncrement.dataset.ticketIncrement, 1)
      return
    }

    const ticketDecrement = target.closest('[data-ticket-decrement]')
    if (ticketDecrement) {
      adjustTicketCount(ticketDecrement.dataset.ticketDecrement, -1)
      return
    }

    const ticketChoice = target.closest('[data-ticket-choice]')
    if (ticketChoice) {
      adjustTicketCount(ticketChoice.dataset.ticketChoice, 1)
      return
    }

    const paymentChoice = target.closest('[data-payment-choice]')
    if (paymentChoice) {
      state.payment = paymentChoice.dataset.paymentChoice
      render()
      return
    }

    const action = target.closest('[data-action]')?.dataset.action
    if (!action) return

    if (action === 'next') {
      goNext()
      return
    }

    if (action === 'login-member') {
      void loginMember()
      return
    }

    if (action === 'register-member') {
      void registerMember()
      return
    }

    if (action === 'logout-member') {
      void logoutMember()
      return
    }

    if (action === 'prev') {
      goPrev()
      return
    }

    if (action === 'apply-coupon') {
      applyCoupon()
      render()
      return
    }

    if (action === 'remove-coupon') {
      state.couponCode = ''
      state.couponError = ''
      render()
      return
    }

    if (action === 'edit-seats') {
      state.currentStep = getStepIndex('seat')
      render()
      return
    }

    if (action === 'complete') {
      if (!canProceed()) return
      void completeReservation()
    }
  }

  function onInput(event) {
    if (isStepTransitioning) return
    const target = event.target instanceof Element ? event.target : null
    if (!target) return

    const field = target.closest('[data-customer-field]')
    if (field) {
      const fieldName = field.dataset.customerField
      const nextValue = normalizeCustomerInput(fieldName, field.value)
      if (field.value !== nextValue) field.value = nextValue
      state.customer[fieldName] = nextValue
      syncCustomerDerivedValues()
      syncCurrentStepAction()
      return
    }

    const loginField = target.closest('[data-login-field]')
    if (loginField) {
      const fieldName = loginField.dataset.loginField
      const nextValue = normalizeLoginInput(fieldName, loginField.value)
      if (loginField.value !== nextValue) loginField.value = nextValue
      state.login[fieldName] = nextValue
      state.login.error = ''
      syncAccountActions()
      return
    }

    const registerField = target.closest('[data-register-field]')
    if (registerField && registerField.type !== 'checkbox') {
      const fieldName = registerField.dataset.registerField
      const nextValue = normalizeRegisterInput(fieldName, registerField.value)
      if (registerField.value !== nextValue) registerField.value = nextValue
      state.join[fieldName] = nextValue
      state.join.error = ''
      syncAccountActions()
      return
    }

    const couponInput = target.closest('[data-coupon-input]')
    if (couponInput) {
      const nextValue = normalizeCouponInput(couponInput.value)
      if (couponInput.value !== nextValue) couponInput.value = nextValue
      state.couponInput = nextValue
      state.couponError = ''
    }
  }

  function onChange(event) {
    if (isStepTransitioning) return
    const target = event.target instanceof Element ? event.target : null
    if (!target) return

    const terms = target.closest('[data-terms-check]')
    if (terms) {
      state.agreed = Boolean(terms.checked)
      render()
      return
    }

    const registerCheck = target.closest('[data-register-field]')
    if (registerCheck && registerCheck.type === 'checkbox') {
      state.join[registerCheck.dataset.registerField] = Boolean(registerCheck.checked)
      state.join.error = ''
      syncAccountActions()
      return
    }

    const mail = target.closest('[data-mail-magazine]')
    if (mail) {
      state.mailMagazine = Boolean(mail.checked)
    }
  }

  function onStepperClick(event) {
    if (isStepTransitioning) return
    const target = event.target instanceof Element ? event.target : null
    if (!target) return

    const button = target.closest('[data-step-index]')
    if (!button) return
    const nextIndex = Number(button.dataset.stepIndex)
    if (nextIndex > state.maxStep || nextIndex === getStepIndex('complete')) return
    state.currentStep = nextIndex
    render()
  }

  function goNext() {
    if (!canProceed()) return
    const nextStep = getNextStepIndex()
    state.currentStep = nextStep
    state.maxStep = Math.max(state.maxStep, nextStep)
    render()
  }

  function goPrev() {
    state.currentStep = getPreviousStepIndex()
    render()
  }

  function getNextStepIndex() {
    if (FLOW_STEPS[state.currentStep].id === 'account' && state.account === 'member') {
      return getStepIndex('payment')
    }
    return Math.min(state.currentStep + 1, FLOW_STEPS.length - 1)
  }

  function getPreviousStepIndex() {
    if (FLOW_STEPS[state.currentStep].id === 'payment' && state.account === 'member') {
      return getStepIndex('account')
    }
    return Math.max(0, state.currentStep - 1)
  }

  function render() {
    const stepChanged = renderedStep !== state.currentStep
    document.title = `${FLOW_STEPS[state.currentStep].label} | 座席予約 | HAL シネマ`
    if (stepChanged && renderedStep !== null) {
      renderStepTransition()
      return
    }

    renderCurrentView()
    renderedStep = state.currentStep
    if (stepChanged) scrollToStepTop()
  }

  function renderStepTransition() {
    isStepTransitioning = true
    stepRoot.classList.remove('is-entering')
    stepRoot.classList.add('is-leaving')

    window.setTimeout(() => {
      renderCurrentView()
      renderedStep = state.currentStep
      resetScrollTop()
      stepRoot.classList.remove('is-leaving')
      stepRoot.classList.add('is-entering')

      window.setTimeout(() => {
        stepRoot.classList.remove('is-entering')
        isStepTransitioning = false
      }, STEP_TRANSITION_IN_MS)
    }, STEP_TRANSITION_OUT_MS + STEP_TRANSITION_GAP_MS)
  }

  function renderCurrentView() {
    renderContext()
    renderStepper()
    renderStep()
    updateUrl()
    void refreshAvailability()
  }

  function renderContext() {
    contextRoot.innerHTML = BookingContext({
      state,
      screen: getScreen(),
    })
  }

  function renderStepper() {
    stepperRoot.innerHTML = BookingStepper({
      steps: FLOW_STEPS.map((step, index) => ({ ...step, index })),
      currentStep: state.currentStep,
      maxStep: state.maxStep,
    })
  }

  function renderStep() {
    const id = FLOW_STEPS[state.currentStep].id
    const shared = {
      state,
      stepNo: String(state.currentStep + 1).padStart(2, '0'),
      canProceed: canProceed(),
      isFirstStep: state.currentStep === 0,
    }

    if (id === 'seat') {
      stepRoot.innerHTML = SeatStep({
        ...shared,
        screens: SCREENS,
        selectedUnits: state.selectedSeats.length,
        ticketUnits: getTicketSeatUnits(),
        seatMapHtml: renderSeatMap(),
      })
      return
    }

    if (id === 'terms') {
      stepRoot.innerHTML = TermsStep({
        ...shared,
        totals: getTotals(),
      })
    }
    if (id === 'account') {
      stepRoot.innerHTML = AccountStep({
        ...shared,
        canLogin: isLoginValid(),
      })
    }
    if (id === 'customer') stepRoot.innerHTML = CustomerStep(shared)
    if (id === 'tickets') {
      stepRoot.innerHTML = TicketsStep({
        ...shared,
        ticketTypes: getPricedTicketTypes(),
        totals: getTotals(),
        pricingNotices: getPricingNotices(),
        maxSeatsPerOrder: MAX_SEATS_PER_ORDER,
      })
    }
    if (id === 'payment') {
      stepRoot.innerHTML = PaymentStep({
        ...shared,
        paymentMethods: PAYMENT_METHODS,
        totals: getTotals(),
        coupon: getAppliedCoupon(),
      })
    }
    if (id === 'review') {
      stepRoot.innerHTML = ReviewStep({
        stepNo: shared.stepNo,
        state,
        ticketTypes: getPricedTicketTypes(),
        totals: getTotals(),
        payment: getPayment(),
        customerName: getCustomerName(),
        phoneNumber: getPhoneNumber(),
      })
    }
    if (id === 'complete') {
      if (!state.confirmationNo) state.confirmationNo = createConfirmationNo()
      stepRoot.innerHTML = CompleteStep({ confirmationNo: state.confirmationNo })
    }
  }

  function scrollToStepTop() {
    requestAnimationFrame(resetScrollTop)
  }

  function resetScrollTop() {
    const originalScrollBehavior = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'auto'
    setScrollTopImmediate()
    requestAnimationFrame(() => {
      setScrollTopImmediate()
      window.setTimeout(() => {
        setScrollTopImmediate()
        document.documentElement.style.scrollBehavior = originalScrollBehavior
      }, 80)
    })
  }

  function setScrollTopImmediate() {
    const scrollRoot = document.scrollingElement || document.documentElement
    scrollRoot.scrollTop = 0
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }

  function renderSeatMap() {
    const screen = getScreen()
    if (!screen) return '<div class="booking-empty">上映回を選択すると座席表が表示されます。</div>'
    const layout = getSeatLayout(screen)
    const unavailable = getUnavailableSeats()
    return getSeatRows(layout).map(row => {
      const seats = row.seats.map(seatId => {
        const selected = state.selectedSeats.includes(seatId)
        const reserved = unavailable.has(seatId)
        const disabled = reserved
        return `
          <button class="seat-button${selected ? ' selected' : ''}${reserved ? ' unavailable' : ''}" type="button" data-seat-id="${escapeAttr(seatId)}" aria-pressed="${selected ? 'true' : 'false'}" ${disabled ? 'disabled' : ''}>
            ${escapeHtml(seatId)}
          </button>`
      }).join('')
      return `
        <div class="seat-row" style="--seat-grid-min: ${layout.gridMinWidth}px;">
          <span>${escapeHtml(row.label)}</span>
          <div class="seat-row-grid" style="--seat-cols: ${layout.columns}; --seat-grid-min: ${layout.gridMinWidth}px;">${seats}</div>
        </div>`
    }).join('')
  }

  function toggleSeat(seatId) {
    if (!seatId) return
    if (state.selectedSeats.includes(seatId)) {
      state.selectedSeats = state.selectedSeats.filter(seat => seat !== seatId)
      state.couponCode = ''
      state.agreed = false
      state.maxStep = state.currentStep
      render()
      return
    }

    const ticketUnits = getTicketSeatUnits()
    const seatLimit = Math.min(ticketUnits, MAX_SEATS_PER_ORDER)
    if (seatLimit <= 0) return

    const nextSeats = state.selectedSeats.concat(seatId)
    while (nextSeats.length > seatLimit) nextSeats.shift()
    state.selectedSeats = nextSeats
    state.couponCode = ''
    state.agreed = false
    state.maxStep = state.currentStep
    render()
  }

  function adjustTicketCount(ticketId, delta) {
    if (!ticketId || !(ticketId in state.tickets)) return
    const ticket = TICKET_TYPES.find(item => item.id === ticketId)
    if (!ticket || ticket.onlineAvailable === false) return
    const nextTickets = { ...state.tickets }
    const currentCount = Number(nextTickets[ticketId] || 0)
    const nextCount = Math.max(0, currentCount + delta)
    if (nextCount === currentCount) return

    nextTickets[ticketId] = nextCount
    const nextUnits = getTicketUnitsFromTickets(nextTickets)
    if (nextUnits > MAX_SEATS_PER_ORDER) return
    state.tickets = nextTickets
    if (state.selectedSeats.length > nextUnits) {
      state.selectedSeats = state.selectedSeats.slice(0, nextUnits)
    }
    if (nextUnits === 0) state.selectedSeats = []
    state.couponCode = ''
    state.couponError = ''
    state.agreed = false
    state.maxStep = state.currentStep
    render()
  }

  function canProceed() {
    const id = FLOW_STEPS[state.currentStep].id
    if (id === 'tickets') return getTicketSeatUnits() > 0 && getTicketSeatUnits() <= MAX_SEATS_PER_ORDER
    if (id === 'seat') return Boolean(state.slot && state.screen && state.selectedSeats.length === getTicketSeatUnits() && getTicketSeatUnits() > 0)
    if (id === 'terms') return state.agreed
    if (id === 'account') return state.account === 'guest' || (state.account === 'member' && Boolean(state.member))
    if (id === 'customer') return isCustomerValid()
    if (id === 'payment') return Boolean(state.payment)
    if (id === 'review') return true
    return false
  }

  function isCustomerValid() {
    const name = state.customer.name.trim() || `${state.customer.lastName} ${state.customer.firstName}`.trim()
    const kana = state.customer.nameKana.trim() || state.customer.kana.trim()
    const phone = getPhoneNumber()
    const email = state.customer.email.trim()
    const emailConfirm = state.customer.emailConfirm.trim()

    return Boolean(
      name &&
      kana &&
      isWithinMax(name, INPUT_LIMITS.name) &&
      isWithinMax(kana, INPUT_LIMITS.nameKana) &&
      isWithinMax(email, INPUT_LIMITS.email) &&
      /^[0-9]{2,5}[0-9]{2,5}[0-9]{3,5}$/.test(phone) &&
      isValidEmail(email) &&
      email === emailConfirm
    )
  }

  function applyCoupon() {
    const code = normalizeCouponInput(state.couponInput)
    if (!code) {
      state.couponError = 'クーポンコードを入力してください。'
      state.couponCode = ''
      return
    }

    const coupon = COUPONS[code]
    if (!coupon) {
      state.couponError = 'このクーポンコードは利用できません。'
      state.couponCode = ''
      return
    }

    if (!coupon.isAvailable(state)) {
      state.couponError = 'この上映回または枚数では利用条件を満たしていません。'
      state.couponCode = ''
      return
    }

    state.couponCode = code
    state.couponInput = code
    state.couponError = ''
  }

  async function refreshAvailability() {
    const key = getAvailabilityKey()
    if (!key || state.availabilityLoading || state.availabilityKey === key) return

    state.availabilityKey = key
    state.availabilityLoading = true

    try {
      const params = new URLSearchParams({
        movie: String(state.movie.id),
        screen: String(state.screen),
        start: state.slot.start,
        end: state.slot.end || '',
        date: state.date || '',
      })
      const result = await requestJSON(`/api/reservations/availability?${params.toString()}`)
      if (state.availabilityKey !== key) return

      const reserved = Array.isArray(result.reservedSeats) ? result.reservedSeats : []
      state.dbReservedSeats = reserved
      if (state.selectedSeats.length) {
        const reservedSet = new Set(reserved)
        const nextSeats = state.selectedSeats.filter(seat => !reservedSet.has(seat))
        if (nextSeats.length !== state.selectedSeats.length) {
          state.selectedSeats = nextSeats
          state.agreed = false
          state.maxStep = Math.min(state.maxStep, getStepIndex('seat'))
        }
      }
    } catch {
      if (state.availabilityKey === key) state.dbReservedSeats = []
    } finally {
      if (state.availabilityKey === key) {
        state.availabilityLoading = false
        render()
      }
    }
  }

  async function completeReservation() {
    if (state.submittingReservation) return

    state.submittingReservation = true
    state.reservationError = ''
    render()

    try {
      const result = await requestJSON('/api/reservations', {
        method: 'POST',
        headers: state.memberToken ? getAuthHeaders(state.memberToken) : {},
        body: JSON.stringify({
          movieId: String(state.movie.id),
          screen: String(state.screen),
          start: state.slot?.start || '',
          end: state.slot?.end || '',
          date: state.date || '',
          seats: state.selectedSeats,
          tickets: state.tickets,
          couponCode: state.couponCode,
          paymentMethod: state.payment,
          customer: {
            name: getCustomerName(),
            nameKana: state.customer.nameKana || state.customer.kana,
            email: state.customer.email,
            tel: getPhoneNumber(),
          },
        }),
      })

      state.confirmationNo = result.confirmationNo || result.reservationId || createConfirmationNo()
      state.currentStep = getStepIndex('complete')
      state.maxStep = state.currentStep
      state.submittingReservation = false
      state.dbReservedSeats = Array.from(new Set([...(state.dbReservedSeats || []), ...state.selectedSeats]))
      render()
    } catch (error) {
      state.submittingReservation = false
      state.reservationError = getRequestErrorMessage(error)
      state.availabilityKey = ''
      render()
    }
  }

  function getTotals() {
    const pricedTickets = getPricedTicketTypes()
    const ticketSubtotal = pricedTickets.reduce((sum, ticket) => sum + ticket.price * (state.tickets[ticket.id] || 0), 0)
    const screenSurcharge = getScreenSurcharge()
    const surcharge = screenSurcharge ? screenSurcharge.total : 0
    const subtotal = ticketSubtotal + surcharge
    const coupon = getAppliedCoupon()
    const discount = coupon ? Math.min(subtotal, coupon.discount(state)) : 0
    return {
      ticketSubtotal,
      surcharge,
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount),
      serviceDay: isCurseServiceDay(state.date),
      screenSurcharge,
    }
  }

  function getPricedTicketTypes() {
    const serviceDay = isCurseServiceDay(state.date)
    return TICKET_TYPES.map(ticket => {
      const servicePrice = serviceDay && ticket.serviceDayEligible
        ? SERVICE_DAY_PRICE * ticket.seats
        : null
      return {
        ...ticket,
        basePrice: ticket.price,
        price: servicePrice || ticket.price,
        priceNote: servicePrice ? '呪いのサービスデー適用' : '',
      }
    })
  }

  function getScreenFee() {
    const screen = getScreen()
    const unitPrice = Number(screen?.threeDExtraFee ?? (screen?.is3d ? THREE_D_EXTRA_FEE : 0))
    if (!unitPrice) return null
    return {
      id: '3d',
      label: '3D追加料金',
      unitPrice,
      note: `スクリーン ${screen.num} は3D対応`,
    }
  }

  function getScreenSurcharge() {
    const screenFee = getScreenFee()
    const units = getTicketSeatUnits()
    if (!screenFee || !units) return null
    return {
      ...screenFee,
      units,
      total: screenFee.unitPrice * units,
    }
  }

  function getPricingNotices() {
    const notices = []
    const screenFee = getScreenFee()
    if (isCurseServiceDay(state.date)) {
      notices.push({
        title: '呪いのサービスデー',
        body: '毎月13日は中高生以上の券種が1席1,300円になります。ペアチケットは2席分として2,600円で計算します。',
      })
    }
    if (screenFee) {
      notices.push({
        title: '3D追加料金',
        body: `${screenFee.note}のため、1席につき${formatYen(screenFee.unitPrice)}を自動加算します。`,
      })
    }
    notices.push({
      title: '障がい者割引',
      body: 'オンラインでは手帳確認ができないため、この予約フローでは選択できません。劇場窓口で手帳をご提示いただいた場合に適用します。',
    })
    return notices
  }

  function getTicketSeatUnits() {
    return getTicketUnitsFromState(state)
  }

  function getAppliedCoupon() {
    if (!state.couponCode) return null
    const coupon = COUPONS[state.couponCode]
    if (!coupon || !coupon.isAvailable(state)) return null
    return coupon
  }

  function getCustomerName() {
    return state.customer.name.trim() || `${state.customer.lastName} ${state.customer.firstName}`.trim()
  }

  function getPhoneNumber() {
    return state.customer.tel.trim()
  }

  function syncCustomerDerivedValues() {
    state.customer.tel = getPhoneNumber()
    state.customer.lastName = state.customer.name
    state.customer.firstName = ''
    state.customer.kana = state.customer.nameKana
  }

  function syncCurrentStepAction() {
    const nextButton = stepRoot.querySelector('[data-action="next"]')
    if (nextButton) nextButton.disabled = !canProceed()
  }

  function syncAccountActions() {
    const loginButton = stepRoot.querySelector('[data-action="login-member"]')
    if (loginButton) loginButton.disabled = !isLoginValid() || state.login.loading

    const registerButton = stepRoot.querySelector('[data-action="register-member"]')
    if (registerButton) registerButton.disabled = state.join.loading
  }

  async function loginMember() {
    if (!isLoginValid() || state.login.loading) return

    state.login.loading = true
    state.login.error = ''
    render()

    try {
      const result = await requestJSON('/api/members/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: state.login.identifier.trim(),
          password: state.login.password,
        }),
      })
      completeMemberAuth(result)
    } catch (error) {
      state.login.loading = false
      state.login.error = getRequestErrorMessage(error)
      render()
    }
  }

  async function registerMember() {
    if (state.join.loading) return
    syncJoinStateFromDOM()

    const validationMessage = getJoinValidationMessage()
    if (validationMessage) {
      state.join.error = validationMessage
      render()
      return
    }

    state.join.loading = true
    state.join.error = ''
    render()

    try {
      const result = await requestJSON('/api/members/register', {
        method: 'POST',
        body: JSON.stringify({
          name: state.join.name.trim(),
          nameKana: state.join.nameKana.trim(),
          email: state.join.email.trim(),
          tel: state.join.tel.trim(),
          password: state.join.password,
          mailMagazine: Boolean(state.join.mailMagazine),
        }),
      })
      completeMemberAuth(result)
    } catch (error) {
      state.join.loading = false
      state.join.error = getRequestErrorMessage(error)
      render()
    }
  }

  async function logoutMember() {
    const token = state.memberToken
    clearMemberAuth()
    render()

    if (!token) return
    try {
      await requestJSON('/api/members/logout', {
        method: 'POST',
        headers: getAuthHeaders(token),
      })
    } catch {
      // Local logout should still complete even if the session has already expired.
    }
  }

  async function refreshMemberSession() {
    const token = state.memberToken
    if (!token) return

    try {
      const result = await requestJSON('/api/members/me', {
        headers: getAuthHeaders(token),
      })
      if (result.member) {
        applyMemberSession(result.member, token)
        render()
      }
    } catch {
      if (state.memberToken === token) {
        clearMemberAuth()
        render()
      }
    }
  }

  function completeMemberAuth(result) {
    if (!result?.member || !result?.token) {
      state.login.loading = false
      state.join.loading = false
      state.login.error = '会員情報の取得に失敗しました。'
      render()
      return
    }

    state.login = createLoginState()
    state.join = createJoinState()
    applyMemberSession(result.member, result.token)
    state.currentStep = getStepIndex('payment')
    state.maxStep = Math.max(state.maxStep, state.currentStep)
    render()
  }

  function applyMemberSession(member, token) {
    state.account = 'member'
    state.member = member
    state.memberToken = token
    state.mailMagazine = Boolean(member.mailMagazine)
    fillCustomerFromMember(member)
    writeMemberSession({ member, token })
  }

  function clearMemberAuth() {
    state.account = 'guest'
    state.member = null
    state.memberToken = ''
    state.login = createLoginState()
    state.join = createJoinState()
    state.customer = createCustomerState()
    state.mailMagazine = false
    removeMemberSession()
  }

  function fillCustomerFromMember(member) {
    state.customer = {
      ...state.customer,
      name: member.name || '',
      nameKana: member.nameKana || '',
      lastName: member.name || '',
      firstName: '',
      kana: member.nameKana || '',
      email: member.email || '',
      emailConfirm: member.email || '',
      tel: member.tel || '',
    }
  }

  function isLoginValid() {
    return Boolean(
      String(state.login.identifier || '').trim() &&
      String(state.login.password || '').trim() &&
      isWithinMax(state.login.identifier, INPUT_LIMITS.loginIdentifier) &&
      isWithinMax(state.login.password, INPUT_LIMITS.password)
    )
  }

  function getJoinValidationMessage() {
    const join = state.join
    const phone = String(join.tel || '').trim()
    const email = String(join.email || '').trim()
    const emailConfirm = String(join.emailConfirm || '').trim()
    const password = String(join.password || '')
    const passwordConfirm = String(join.passwordConfirm || '')

    if (!String(join.name || '').trim()) return '氏名を入力してください。'
    if (!String(join.nameKana || '').trim()) return '氏名（かな）を入力してください。'
    if (!isWithinMax(join.name, INPUT_LIMITS.name)) return '氏名は40文字以内で入力してください。'
    if (!isWithinMax(join.nameKana, INPUT_LIMITS.nameKana)) return '氏名（かな）は60文字以内で入力してください。'
    if (!/^[0-9]{2,5}[0-9]{2,5}[0-9]{3,5}$/.test(phone)) return '電話番号をハイフンなしで入力してください。'
    if (!isValidEmail(email)) return 'メールアドレスを正しく入力してください。'
    if (!isWithinMax(email, INPUT_LIMITS.email)) return 'メールアドレスは254文字以内で入力してください。'
    if (email !== emailConfirm) return '確認用メールアドレスが一致していません。'
    if (Array.from(password).length < 8) return 'パスワードは8文字以上で入力してください。'
    if (!isWithinMax(password, INPUT_LIMITS.password)) return 'パスワードは128文字以内で入力してください。'
    if (password !== passwordConfirm) return '確認用パスワードが一致していません。'

    return ''
  }


  function syncJoinStateFromDOM() {
    stepRoot.querySelectorAll('[data-register-field]').forEach((field) => {
      const fieldName = field.dataset.registerField
      if (!fieldName) return
      if (field.type === 'checkbox') {
        state.join[fieldName] = Boolean(field.checked)
        return
      }
      const nextValue = normalizeRegisterInput(fieldName, field.value)
      if (field.value !== nextValue) field.value = nextValue
      state.join[fieldName] = nextValue
    })
  }

  function getPayment() {
    return PAYMENT_METHODS.find(method => method.id === state.payment)
  }

  function getAvailabilityKey() {
    if (!state.movie?.id || !state.screen || !state.slot?.start) return ''
    return [
      state.movie.id,
      state.screen,
      state.slot.start,
      state.slot.end || '',
      state.date || '',
    ].join('|')
  }

  function getScreen() {
    return SCREENS.find(screen => screen.num === Number(state.screen))
  }

  function getSeatLayout(screen = getScreen()) {
    const seatCount = Number(screen?.seats) || 96
    const preset = SCREEN_SEAT_LAYOUTS[seatCount] || createSeatLayoutByCapacity(seatCount)
    return {
      ...preset,
      seatCount,
      gridMinWidth: preset.columns * 36,
    }
  }

  function getUnavailableSeats() {
    return new Set(state.dbReservedSeats || [])
  }

  function updateUrl() {
    const url = new URL(location.href)
    url.pathname = '/booking'
    url.searchParams.set('movie', state.movie.id)
    url.searchParams.set('date', state.date)
    url.searchParams.set('step', FLOW_STEPS[state.currentStep].id)
    if (state.screen) url.searchParams.set('screen', state.screen)
    if (state.slot) {
      url.searchParams.set('start', state.slot.start)
      url.searchParams.set('end', state.slot.end)
    }
    history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`)
  }
}

function createLoginState() {
  return {
    identifier: '',
    password: '',
    loading: false,
    error: '',
  }
}

function createJoinState() {
  return {
    name: '',
    nameKana: '',
    email: '',
    emailConfirm: '',
    password: '',
    passwordConfirm: '',
    mailMagazine: false,
    loading: false,
    error: '',
  }
}

function createCustomerState(member = null) {
  return {
    name: member?.name || '',
    nameKana: member?.nameKana || '',
    lastName: member?.name || '',
    firstName: '',
    kana: member?.nameKana || '',
    email: member?.email || '',
    emailConfirm: member?.email || '',
    tel: member?.tel || '',
    postal: '',
    request: '',
  }
}

function readMemberSession() {
  try {
    const raw = window.localStorage.getItem(MEMBER_SESSION_STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session?.token || !session?.member) return null
    return session
  } catch {
    return null
  }
}

function writeMemberSession(session) {
  try {
    window.localStorage.setItem(MEMBER_SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Storage can be unavailable in private browsing; the current purchase still works.
  }
}

function removeMemberSession() {
  try {
    window.localStorage.removeItem(MEMBER_SESSION_STORAGE_KEY)
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

async function requestJSON(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  const response = await fetch(path, {
    ...options,
    headers,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || '通信に失敗しました。')
  }
  return data
}

function getAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  }
}

function getRequestErrorMessage(error) {
  return error instanceof Error ? error.message : '通信に失敗しました。'
}

function resolveMovie(params) {
  const requestedId = Number(params.get('movie') || params.get('id'))
  return MOVIES.find(movie => movie.id === requestedId) || MOVIES.find(movie => movie.status === 'now') || MOVIES[0]
}

function resolveInitialSlot(movie, params) {
  const requestedScreen = Number(params.get('screen'))
  const requestedStart = params.get('start')
  const requestedEnd = params.get('end')
  const slots = getAvailableSlots(movie)

  if (requestedScreen && requestedStart) {
    const matched = slots.find(item =>
      item.screen === requestedScreen &&
      item.slot.start === requestedStart &&
      (!requestedEnd || item.slot.end === requestedEnd)
    )
    if (matched) return matched
  }

  return slots[0] || null
}

function getAvailableSlots(movie) {
  if (!movie || !Array.isArray(movie.screenSchedules)) return []
  return movie.screenSchedules.flatMap(schedule =>
    schedule.slots
      .filter(slot => slot.status !== 'soldout')
      .map(slot => ({ screen: schedule.screen, slot }))
  )
}

function getDefaultDate(movie) {
  const todayIndex = Math.min(3, DATES.length - 1)
  const fromToday = DATES.slice(todayIndex).find(date => isPlayingDate(movie, date))
  return fromToday || DATES.find(date => isPlayingDate(movie, date)) || DATES[0]
}

function isPlayingDate(movie, date) {
  if (!movie || !Array.isArray(movie.playingDays)) return true
  const dayMap = { '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6 }
  const match = String(date).match(/\((.)\)/)
  if (!match) return true
  return movie.playingDays.includes(dayMap[match[1]])
}

function isCurseServiceDay(dateLabel) {
  const match = String(dateLabel || '').match(/\/(\d{1,2})\(/)
  return Number(match?.[1]) === 13
}

function createEmptyTickets() {
  return TICKET_TYPES.reduce((tickets, ticket) => {
    tickets[ticket.id] = 0
    return tickets
  }, {})
}

function getTicketUnitsFromState(state) {
  return getTicketUnitsFromTickets(state.tickets)
}

function getTicketUnitsFromTickets(tickets) {
  return TICKET_TYPES.reduce((sum, ticket) => sum + ticket.seats * (tickets[ticket.id] || 0), 0)
}

function getStepIndex(stepId) {
  const index = FLOW_STEPS.findIndex(step => step.id === stepId)
  return index >= 0 ? index : 0
}

function createSeatLayoutByCapacity(seatCount) {
  const columns = seatCount >= 160 ? 20 : seatCount >= 100 ? 15 : 10
  return {
    rows: Math.ceil(seatCount / columns),
    columns,
  }
}

function getSeatRows(layout) {
  let remaining = layout.seatCount
  return Array.from({ length: layout.rows }, (_, rowIndex) => {
    const seatTotal = Math.min(layout.columns, remaining)
    const label = getRowLabel(rowIndex)
    remaining -= seatTotal
    return {
      label,
      seats: Array.from({ length: seatTotal }, (_, seatIndex) => `${label}${seatIndex + 1}`),
    }
  }).filter(row => row.seats.length > 0)
}

function getRowLabel(index) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (index < alphabet.length) return alphabet[index]
  return `${alphabet[Math.floor(index / alphabet.length) - 1]}${alphabet[index % alphabet.length]}`
}

function hashString(value) {
  return Array.from(String(value)).reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0, 0)
}

function createConfirmationNo() {
  return `HAL-${Date.now().toString(36).toUpperCase().slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function normalizeCustomerInput(field, value) {
  if (String(field || '').startsWith('tel')) return normalizeDigits(value, INPUT_LIMITS.tel)
  if (field === 'name') return limitString(stripControlChars(value), INPUT_LIMITS.name)
  if (field === 'nameKana') return limitString(stripControlChars(value), INPUT_LIMITS.nameKana)
  if (field === 'email' || field === 'emailConfirm') return limitString(stripControlChars(value), INPUT_LIMITS.email)
  return limitString(stripControlChars(value), 100)
}

function normalizeLoginInput(field, value) {
  if (field === 'password') return limitString(stripControlChars(value), INPUT_LIMITS.password)
  return limitString(stripControlChars(value), INPUT_LIMITS.loginIdentifier)
}

function normalizeRegisterInput(field, value) {
  if (String(field || '').startsWith('tel')) return normalizeDigits(value, INPUT_LIMITS.tel)
  if (field === 'name') return limitString(stripControlChars(value), INPUT_LIMITS.name)
  if (field === 'nameKana') return limitString(stripControlChars(value), INPUT_LIMITS.nameKana)
  if (field === 'email' || field === 'emailConfirm') return limitString(stripControlChars(value), INPUT_LIMITS.email)
  if (field === 'password' || field === 'passwordConfirm') return limitString(stripControlChars(value), INPUT_LIMITS.password)
  return limitString(stripControlChars(value), 100)
}

function normalizeCouponInput(value) {
  return limitString(String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''), INPUT_LIMITS.coupon)
}

function normalizeDigits(value, maxLength) {
  return limitString(String(value || '').replace(/\D/g, ''), maxLength)
}

function limitString(value, maxLength) {
  return Array.from(String(value || '')).slice(0, maxLength).join('')
}

function isWithinMax(value, maxLength) {
  return Array.from(String(value || '')).length <= maxLength
}

function stripControlChars(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '')
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())
}
