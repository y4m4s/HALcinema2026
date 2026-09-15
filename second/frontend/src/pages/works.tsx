import type { PageDefinition } from '../types'

export const worksPage: PageDefinition = {
  title: "上映作品一覧 | HAL シネマ",
  bodyClass: "works-body",
  styles: [
  "/css/fonts.css",
  "/css/style.css",
  "/css/works.css"
],
  html: String.raw`<main class="works-page page-enter">
    <section class="works-hero">
      <nav class="breadcrumb-nav" aria-label="パンくずリスト">
        <ol class="breadcrumb">
          <li class="breadcrumb__list"><a href="/">トップページ</a></li>
          <li class="breadcrumb__list" aria-current="page">上映作品一覧</li>
        </ol>
      </nav>
      <div class="section-header">
        <h1 class="section-title">上映作品一覧</h1>
        <span class="section-title-en">All Movies</span>
        <div class="section-line"></div>
      </div>
    </section>

    <section class="works-list-section">
      <div class="works-toolbar" id="works-filters">
        <button class="works-filter active" type="button" data-filter="all">
          <span class="works-filter-count" data-filter-count="all">0</span>
          <span class="works-filter-name">すべて</span>
          <span class="works-filter-en">TOTAL</span>
        </button>
        <button class="works-filter" type="button" data-filter="now">
          <span class="works-filter-count" data-filter-count="now">0</span>
          <span class="works-filter-name">上映中</span>
          <span class="works-filter-en">NOW SHOWING</span>
        </button>
        <button class="works-filter" type="button" data-filter="coming">
          <span class="works-filter-count" data-filter-count="coming">0</span>
          <span class="works-filter-name">近日公開</span>
          <span class="works-filter-en">COMING SOON</span>
        </button>
      </div>
      <div class="works-grid" id="movieList"></div>
    </section>
  </main>`,
}


