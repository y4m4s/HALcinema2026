/* eslint-disable no-irregular-whitespace */
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
  html: String.raw`<div id="nav-root">
    <header class="site-header">
      <nav class="nav" aria-label="グローバルナビゲーション">
        <a class="nav-logo" href="/" aria-label="HALシネマ 境界 トップへ">
          <img class="nav-logo-img" src="/assets/hal-cinema-kyokai-logo.svg" alt="HALシネマ 境界">
        </a>
        <div class="nav-links">
          <a href="/works" class="nav-link" data-nav="works"><span>上映作品一覧</span></a>
          <a href="/schedule" class="nav-link" data-nav="schedule"><span>上映スケジュール</span></a>
          <a href="/theater" class="nav-link" data-nav="theater"><span>劇場案内</span></a>
          <a href="/access" class="nav-link" data-nav="access"><span>交通案内</span></a>
          <a href="/tickets" class="nav-link" data-nav="tickets"><span>料金案内</span></a>
          <a href="/question" class="nav-link" data-nav="question"><span>よくある質問</span></a>
        </div>
      </nav>
    </header>
  </div>

  <main class="page page-enter" id="detail-main">
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
  </main>

  <div id="footer-root">
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-watermark" aria-hidden="true">HAL CINEMA KYOKAI</div>
        <div class="footer-main">
          <div class="footer-brand">
            <div class="footer-kicker">Horror Theatre</div>
            <div class="footer-logo">
              <img class="footer-logo-img" src="/assets/hal-cinema-kyokai-logo.svg" alt="HALシネマ 境界">
            </div>
            <p class="footer-tagline">
              ホラー・ミステリー・サスペンスを中心に、深夜まで上映する都市型シアター。
            </p>
            <dl class="footer-meta">
              <div>
                <dt>ADDRESS</dt>
                <dd>〒450-0002　愛知県名古屋市中村区名駅4-4-38</dd>
              </div>
              <div>
                <dt>OPEN</dt>
                <dd>9:00 - 翌0:30</dd>
              </div>
            </dl>
          </div>
          <div class="footer-directory">
            <div class="footer-col">
              <div class="footer-col-title">上映情報</div>
              <a href="/works" class="footer-link">上映作品一覧</a>
              <a href="/schedule" class="footer-link">上映スケジュール</a>
              <a href="/" class="footer-link">トップ</a>
            </div>
            <div class="footer-col">
              <div class="footer-col-title">劇場情報</div>
              <a href="/theater" class="footer-link">劇場案内</a>
              <a href="/tickets" class="footer-link">料金案内</a>
              <a href="/access" class="footer-link">交通案内</a>
            </div>
            <div class="footer-col">
              <div class="footer-col-title">サポート</div>
              <a href="/contact" class="footer-link">お問い合わせ</a>
              <a href="/question" class="footer-link">よくある質問</a>
              <a href="/news" class="footer-link">お知らせ</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 HALシネマ 境界. All Rights Reserved.</span>
          <span>HORROR · MYSTERY · SUSPENSE</span>
        </div>
      </div>
    </footer>
  </div>`,
}


