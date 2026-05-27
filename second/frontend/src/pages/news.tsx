 
import type { PageDefinition } from '../types'

export const newsPage: PageDefinition = {
  title: "お知らせ | HAL シネマ",
  bodyClass: "news-page",
  styles: [
  "/css/fonts.css",
  "/css/style.css",
  "/css/news.css"
],
  html: String.raw`<div id="nav-root"></div>

  <div class="page page-enter">
    <div class="section">
      <div class="section-header">
        <h1 class="section-title">お知らせ</h1>
        <span class="section-title-en">News Detail</span>
        <div class="section-line"></div>
      </div>

      <div class="news-detail-container">
        <article class="news-detail-main">
          <div class="news-detail-heading">
            <div class="news-detail-meta">
              <h2 class="news-detail-title" id="news-detail-title"></h2>
              <div class="news-detail-info">
                <span class="news-tag news-detail-tag" id="news-detail-tag"></span>
                <time class="news-dated" id="news-detail-date"></time>
              </div>
            </div>
          </div>

          <div class="news-detail-body" id="news-detail-body"></div>
        </article>

        <aside class="news-list-sidebar" aria-label="お知らせ一覧">
          <div class="news-list-scroll-area">
            <div class="news-list" id="news-list"></div>
          </div>
        </aside>
      </div>
    </div>
  </div>

  <div id="footer-root"></div>`,
}


