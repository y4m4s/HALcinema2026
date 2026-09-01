import type { PageDefinition } from '../types'

export const detailPage: PageDefinition = {
  title: "作品詳細 | HAL シネマ",
  bodyClass: "detail-page",
  styles: [
  "/css/fonts.css",
  "/css/style.css",
  "/css/schedule.css",
  "/css/detail.css"
],
  html: String.raw`<main class="page page-enter" id="detail-main">
    <div class="detail-breadcrumb-wrap">
      <nav class="breadcrumb-nav" aria-label="パンくずリスト">
        <ol class="breadcrumb">
          <li class="breadcrumb__list"><a href="/">トップページ</a></li>
          <li class="breadcrumb__list"><a href="/works">上映作品一覧</a></li>
          <li class="breadcrumb__list" id="detail-breadcrumb-current" aria-current="page"></li>
        </ol>
      </nav>
    </div>

    <section class="detail-hero-wrap">
      <div class="detail-hero">
        <div class="detail-hero-poster-wrap" id="detail-poster"></div>
        <div class="detail-hero-content">
          <div class="detail-status-label" id="detail-status"></div>
          <h1 class="detail-title">
            <span id="detail-title"></span>
          </h1>
          <div class="detail-title-en" id="detail-title-en"></div>
          <div class="detail-meta" id="detail-meta"></div>
          <div class="detail-hero-synopsis">
            <div class="detail-section-title">Synopsis — あらすじ</div>
            <p class="detail-synopsis" id="detail-synopsis"></p>
          </div>
        </div>
      </div>
    </section>

    <section class="detail-info-section">
      <div class="detail-sub-grid">
        <div>
          <div class="detail-section-title">Staff &amp; Cast</div>
          <div class="detail-cast-list" id="detail-cast-list"></div>
        </div>
        <div>
          <div class="detail-section-title">Film Info</div>
          <div id="detail-film-info"></div>
        </div>
      </div>
    </section>

    <section class="detail-booking" id="detail-booking">
      <div class="booking-section-label">Ticket — チケット予約</div>
      <div id="detail-booking-content">
        <div class="coming-soon-notice" id="detail-coming-notice" hidden>
          <div class="coming-soon-date" id="detail-coming-date"></div>
          <div class="coming-soon-text">予約受付は公開日前日より開始予定です</div>
        </div>
        <div class="detail-now-booking" id="detail-now-booking" hidden>
          <div class="sub-tabs" id="detail-date-tabs"></div>
          <div class="detail-theaters-wrap">
            <div class="theaters-grid" id="detail-theaters-grid"></div>
          </div>
          <div class="movie-card-note" id="detail-movie-note" hidden>
            <span class="note-label">補足事項</span>
            <span class="note-text" id="detail-movie-note-text"></span>
          </div>
        </div>
      </div>
    </section>
  </main>`,
}


