/* eslint-disable no-irregular-whitespace */
import type { PageDefinition } from '../types'

export const accessPage: PageDefinition = {
  title: "交通案内 | HAL シネマ",
  bodyClass: "access-page",
  styles: [
  "/css/fonts.css",
  "/css/style.css",
  "/css/access.css"
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

  <div class="page page-enter">
    <div class="section">
      <nav class="breadcrumb-nav" aria-label="パンくずリスト">
        <ol class="breadcrumb">
          <li class="breadcrumb__list"><a href="/">トップページ</a></li>
          <li class="breadcrumb__list" aria-current="page">交通案内</li>
        </ol>
      </nav>
      <div class="section-header">
        <h1 class="section-title">交通案内</h1>
        <span class="section-title-en">ACCESS</span>
        <div class="section-line"></div>
      </div>

      <div class="access-grid">

        <!-- 左カラム：地図 + 住所 -->
        <div class="access-left">
          <iframe class="access-map" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3261.5385814106535!2d136.883050975227!3d35.168126657990626!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x600376de618547db%3A0x76435e49b7e59323!2zSEFM5ZCN5Y-k5bGL!5e0!3m2!1sja!2sjp!4v1778735073162!5m2!1sja!2sjp" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
          <p class="access-address">〒450-0002　愛知県名古屋市中村区名駅4-4-38</p>
        </div>

        <!-- 右カラム：アクセス情報 -->
        <div class="access-sidebar">

          <div class="access-section">
            <h3 class="access-section-title">公共の交通機関でお越しの方</h3>
            <ul class="access-section-list">
              <li>JR 東海道本線・中央本線「名古屋駅」より徒歩3分</li>
              <li>地下鉄 東山線・桜通線「名古屋駅」より徒歩3分</li>
              <li>名鉄 名古屋本線「名鉄名古屋駅」より徒歩5分</li>
              <li>名古屋駅バスターミナルより「名古屋駅前」バス停 徒歩3分</li>
            </ul>
          </div>

          <div class="access-section">
            <h3 class="access-section-title">お車でお越しの方</h3>
            <ul class="access-section-list">
              <li>ナビの住所設定は「愛知県名古屋市中村区名駅4-4-38」とご設定ください</li>
              <li>専用駐車場はございません。近隣のコインパーキングをご利用ください</li>
            </ul>
          </div>

          <div class="access-section">
            <h3 class="access-section-title">駐車場について</h3>
            <ul class="access-section-list">
              <li>劇場専用の駐車場はございません</li>
              <li>周辺の提携駐車場については窓口スタッフにお尋ねください</li>
              <li>公共交通機関でのご来場をお勧めしております</li>
            </ul>
          </div>

          <div class="access-section">
            <h3 class="access-section-title">お問い合わせ</h3>
            <ul class="access-section-list">
              <li>電話：052-XXX-XXXX（10:00 〜 22:00 年中無休）</li>
              <li>メール：info@hal-cinema.jp</li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  </div>

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


