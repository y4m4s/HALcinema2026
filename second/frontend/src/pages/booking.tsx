/* eslint-disable no-irregular-whitespace */
import type { PageDefinition } from '../types'

export const bookingPage: PageDefinition = {
  title: "座席予約 | HAL シネマ",
  bodyClass: "booking-body",
  styles: [
  "/css/fonts.css",
  "/css/style.css",
  "/css/booking.css"
],
  html: String.raw`<div id="nav-root"></div>

  <main class="booking-page page-enter">
    <section class="booking-hero">
      <nav class="breadcrumb-nav" aria-label="パンくずリスト">
        <ol class="breadcrumb">
          <li class="breadcrumb__list"><a href="/">トップページ</a></li>
          <li class="breadcrumb__list"><a href="/schedule">上映スケジュール</a></li>
          <li class="breadcrumb__list" aria-current="page">座席予約</li>
        </ol>
      </nav>
      <div class="section-header">
        <h1 class="section-title">座席予約</h1>
        <span class="section-title-en">Seat Reservation</span>
        <div class="section-line"></div>
      </div>
    </section>

    <section class="booking-shell" aria-label="座席予約フォーム">
      <div class="booking-context" id="booking-context"></div>
      <div class="booking-stepper" id="booking-stepper"></div>
      <div class="booking-layout">
        <div class="booking-main" id="booking-step-root"></div>
      </div>
    </section>
  </main>

  <div id="footer-root"></div>`,
}
