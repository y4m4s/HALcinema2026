import type { PageDefinition } from '../types'

export const completedPage: PageDefinition = {
  title: "お問い合わせ完了 | HAL シネマ",
  bodyClass: "completed-page",
  styles: [
  "/css/fonts.css",
  "/css/style.css",
  "/css/completed.css"
],
  html: String.raw`<div class="page page-enter">
    <div class="section">
      <nav class="breadcrumb-nav" aria-label="パンくずリスト">
        <ol class="breadcrumb">
          <li class="breadcrumb__list"><a href="/">トップページ</a></li>
          <li class="breadcrumb__list"><a href="/contact">お問い合わせ</a></li>
          <li class="breadcrumb__list" aria-current="page">お問い合わせ完了</li>
        </ol>
      </nav>
      <div class="complete-wrap">
        <span class="material-icons complete-check">check_circle</span>
        <div class="complete-label">COMPLETE</div>
        <h1 class="complete-title">お問い合わせを<br>受け付けました</h1>
        <div class="complete-divider"></div>
        <p class="complete-body">
          お問い合わせいただきありがとうございます。<br>
          担当者より2〜3営業日以内にご連絡いたします。
        </p>
        <p class="complete-count"><span id="count">5</span>秒後にトップページへ移動します</p>
        <a href="/" class="btn-primary complete-back">トップページに戻る</a>
      </div>
    </div>
  </div>`,
}


