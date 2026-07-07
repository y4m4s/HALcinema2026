import type { PageDefinition } from '../types'

export const memberPage: PageDefinition = {
  title: "会員の方へ | HAL シネマ",
  bodyClass: "member-page-body",
  styles: [
    "/css/fonts.css",
    "/css/style.css",
    "/css/booking.css",
    "/css/member.css"
  ],
  html: String.raw`<div id="nav-root"></div>

  <main class="member-page page-enter">
    <section class="member-hero">
      <div class="section-header">
        <h1 class="section-title">会員の方へ</h1>
        <span class="section-title-en">HAL Cinema Members</span>
        <div class="section-line"></div>
      </div>
      <p class="member-hero-lead">
        ログインすると、予約時のお客様情報入力を省略できます。未会員の方はこのページから新規登録できます。
      </p>
    </section>

    <section class="member-shell" id="member-root" aria-live="polite">
      <div class="member-loading">会員情報を確認しています。</div>
    </section>
  </main>

  <div id="footer-root"></div>`,
}
