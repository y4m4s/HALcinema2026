import type { PageDefinition } from '../types'

export const reservationPage: PageDefinition = {
  title: "予約確認 | HAL シネマ",
  bodyClass: "reservation-body",
  styles: [
    "/css/fonts.css",
    "/css/style.css",
    "/css/booking.css",
    "/css/reservation.css"
  ],
  html: String.raw`<div id="nav-root"></div>

  <main class="reservation-page page-enter">
    <section class="reservation-hero">
      <nav class="breadcrumb-nav" aria-label="パンくずリスト">
        <ol class="breadcrumb">
          <li class="breadcrumb__list"><a href="/">トップページ</a></li>
          <li class="breadcrumb__list" aria-current="page">予約確認</li>
        </ol>
      </nav>
      <div class="section-header">
        <h1 class="section-title">予約確認</h1>
        <span class="section-title-en">Reservation Lookup</span>
        <div class="section-line"></div>
      </div>
    </section>

    <section class="reservation-shell" aria-label="予約確認フォーム">
      <div class="reservation-panel">
        <div class="booking-panel-head">
          <span>LOOKUP</span>
          <h2>予約内容を確認する</h2>
        </div>
        <form class="reservation-lookup-form" id="reservation-lookup-form" novalidate>
          <label>
            <span>予約番号</span>
            <input type="text" name="reservationId" autocomplete="off" placeholder="R0000000000" maxlength="32" required>
          </label>
          <label>
            <span>メールアドレス</span>
            <input type="email" name="email" autocomplete="email" placeholder="example@hal-cinema.test" maxlength="254" required>
          </label>
          <label>
            <span>電話番号</span>
            <input type="tel" name="tel" autocomplete="tel" placeholder="09012345678" maxlength="15" required>
          </label>
          <button class="btn-primary" type="submit">予約を確認する</button>
        </form>
        <p class="reservation-help">購入時に入力したメールアドレスと電話番号が一致した場合のみ、予約内容を表示します。</p>
      </div>
      <div class="reservation-result" id="reservation-result" aria-live="polite"></div>
    </section>
  </main>

  <div id="footer-root"></div>`,
}
