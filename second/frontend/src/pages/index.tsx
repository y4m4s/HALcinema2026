/* eslint-disable no-irregular-whitespace */
import type { PageDefinition } from '../types'

export const homePage: PageDefinition = {
  title: "HAL シネマ | ホラー・ミステリー・サスペンス専門映画館",
  bodyClass: "home-page",
  styles: [
  "/css/fonts.css",
  "/css/style.css",
  "/css/home.css"
],
  html: String.raw`<div class="page page-enter">

    <!-- HERO -->
    <div class="hero">
      <div class="hero-bg hero-bg-a" id="hero-bg-a"></div>
      <div class="hero-bg hero-bg-b" id="hero-bg-b"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <div class="hero-tag">Now Showing — Feature</div>
        <h1 class="hero-title" id="hero-title"></h1>
        <div class="hero-meta" id="hero-meta"></div>
        <p class="hero-synopsis" id="hero-synopsis"></p>
        <div class="hero-cta" id="hero-cta">
          <a href="/detail" class="btn-primary" id="hero-detail-link">作品詳細・上映時刻</a>
          <a href="/schedule" class="btn-ghost">スケジュール一覧</a>
        </div>
      </div>
      <div class="hero-scroll">
        <div class="hero-scroll-line"></div>
        <span>Scroll</span>
      </div>
    </div>

    <!-- TICKER -->
    <div class="ticker">
      <div class="ticker-inner" id="ticker-inner"></div>
    </div>

    <!-- NOW SHOWING -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">上映中</h2>
        <span class="section-title-en">Now Showing</span>
        <div class="section-line"></div>
      </div>
      <div class="movies-grid" id="now-showing-grid"></div>
      <div class="home-more-wrap" id="now-showing-more">
        <a href="/works" class="home-more-link" id="now-showing-more-link" hidden>
          もっと見る<span id="now-showing-more-count"></span>
        </a>
      </div>
    </div>

    <!-- COMING SOON -->
    <div class="section home-section-flush">
      <div class="section-header">
        <h2 class="section-title">近日公開</h2>
        <span class="section-title-en">Coming Soon</span>
        <div class="section-line"></div>
      </div>
      <div class="coming-grid" id="coming-grid"></div>
    </div>

    <!-- FEATURES -->
    <div class="section home-section-flush">
      <div class="section-header">
        <h2 class="section-title">HALシネマについて</h2>
        <span class="section-title-en">About</span>
        <div class="section-line"></div>
      </div>
      <div class="features-grid">
        <div class="feature-item">
          <div class="feature-num">— 01</div>
          <div class="feature-title">専門特化のキュレーション</div>
          <p class="feature-body">国内ホラー・ミステリー・サスペンスに特化した映画館。希少な旧作上映や監督特集なども定期開催。恐怖と謎解きを愛するすべての人のための空間です。</p>
        </div>
        <div class="feature-item">
          <div class="feature-num">— 02</div>
          <div class="feature-title">8スクリーン・1050席</div>
          <p class="feature-body">大スクリーン3室(各200席)・中スクリーン2室(各120席)・小スクリーン3室(各70席)。最新ドルビーアトモス対応スクリーンを完備。</p>
        </div>
        <div class="feature-item">
          <div class="feature-num">— 03</div>
          <div class="feature-title">極上の没入体験</div>
          <p class="feature-body">スクリーン7・8はリニューアルし最新の4Kレーザープロジェクター&amp;ドルビーアトモスを導入。恐怖をより深く、より鮮明に体感できます。</p>
        </div>
      </div>
    </div>

    <!-- ACCESS -->
    <div class="section home-section-flush">
      <div class="section-header">
        <h2 class="section-title">アクセス</h2>
        <span class="section-title-en">Access</span>
        <div class="section-line"></div>
      </div>
      <div class="access-grid">
        <div class="access-info">
          <div class="access-row">
            <span class="access-label">住所</span>
            <span class="access-value">〒450-0002　愛知県名古屋市中村区名駅4-4-38</span>
          </div>
          <div class="access-row">
            <span class="access-label">最寄り駅</span>
            <span class="access-value">JR 東海道本線・中央本線「名古屋駅」より徒歩3分<br>地下鉄 東山線・桜通線「名古屋駅」より徒歩3分<br>名鉄 名古屋本線「名鉄名古屋駅」より徒歩5分</span>
          </div>
          <div class="access-row">
            <span class="access-label">電話</span>
            <span class="access-value">052-XXX-XXXX（10:00〜22:00）</span>
          </div>
          <div class="access-row">
            <span class="access-label">駐車場</span>
            <span class="access-value">専用駐車場なし（提携駐車場は鑑賞券提示で3時間無料）</span>
          </div>
          <div class="access-row">
            <span class="access-label">営業時間</span>
            <span class="access-value">9:00 〜 翌0:30（年中無休）</span>
          </div>
        </div>
        <iframe class="access-map" title="HALシネマ 境界 周辺地図" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3261.5385814106535!2d136.883050975227!3d35.168126657990626!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x600376de618547db%3A0x76435e49b7e59323!2zSEFM5ZCN5Y-k5bGL!5e0!3m2!1sja!2sjp!4v1778735073162!5m2!1sja!2sjp" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      </div>
    </div>

    <!-- NEWS -->
    <div class="section home-section-flush">
      <div class="section-header">
        <h2 class="section-title">お知らせ</h2>
        <span class="section-title-en">News</span>
        <div class="section-line"></div>
      </div>
      <div class="news-list" id="home-news-list"></div>
    </div>

  </div>`,
}


