/* eslint-disable no-irregular-whitespace */
import type { PageDefinition } from '../types'

export const contactPage: PageDefinition = {
  title: "お問い合わせ | HAL シネマ",
  bodyClass: "contact-page",
  styles: [
  "/css/fonts.css",
  "/css/style.css",
  "/css/contact.css"
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
          <li class="breadcrumb__list" aria-current="page">お問い合わせ</li>
        </ol>
      </nav>
      <div class="section-header">
        <h1 class="section-title">お問い合わせ</h1>
        <span class="section-title-en">Contact</span>
        <div class="section-line"></div>
      </div>

      <div id="sent-section" class="contact-sent">
        <div class="contact-sent-label">
          SENT</div>
        <div class="contact-sent-title">送信が完了しました</div>
        <p class="contact-sent-body">お問い合わせありがとうございます。<br>担当者より2〜3営業日以内にご連絡いたします。</p>
        <a href="/" class="btn-primary contact-sent-link">トップに戻る</a>
      </div>

      <div id="form-section" class="contact-grid">
        <form id="contact-form">
          <div class="form-group">
            <label class="form-label">お名前 *</label>
            <input class="form-input" name="name" required placeholder="山田 太郎">
          </div>
          <div class="form-group">
            <label class="form-label">メールアドレス *</label>
            <input class="form-input" type="email" name="email" required placeholder="example@email.com">
          </div>
          <div class="form-group">
            <label class="form-label">お問い合わせ種別</label>
            <select class="form-select" name="category">
              <option value="">選択してください</option>
              <option value="上映情報">上映情報</option>
              <option value="チケット・料金">チケット・料金</option>
              <option value="施設・設備">施設・設備</option>
              <option value="イベント">イベント</option>
              <option value="その他">その他</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">お問い合わせ内容 *</label>
            <textarea class="form-textarea" name="message" required placeholder="お問い合わせ内容をご記入ください"></textarea>
          </div>
          <button type="submit" class="btn-primary contact-submit">送信する</button>
        </form>

        <div class="contact-info">
          <div class="contact-info-title">
            CONTACT INFO</div>
          <div class="contact-info-item">
            <div class="contact-info-label">電話番号</div>
            <div class="contact-info-value">052-XXX-XXXX</div>
          </div>
          <div class="contact-info-item">
            <div class="contact-info-label">受付時間</div>
            <div class="contact-info-value">10:00 〜 22:00<br>（年中無休）</div>
          </div>
          <div class="contact-info-item">
            <div class="contact-info-label">メール</div>
            <div class="contact-info-value">info@hal-cinema.jp</div>
          </div>
          <div class="contact-info-item">
            <div class="contact-info-label">住所</div>
            <div class="contact-info-value">〒450-0002<br>愛知県名古屋市中村区名駅4-4-38</div>
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


