import type { PageDefinition } from '../types'

export const questionPage: PageDefinition = {
  title: "よくある質問 | HAL シネマ",
  bodyClass: "question-page",
  styles: [
  "/css/fonts.css",
  "/css/style.css",
  "/css/question.css"
],
  html: String.raw`<div class="page page-enter">
    <div class="section">
      <nav class="breadcrumb-nav" aria-label="パンくずリスト">
        <ol class="breadcrumb">
          <li class="breadcrumb__list"><a href="/">トップページ</a></li>
          <li class="breadcrumb__list" aria-current="page">よくある質問</li>
        </ol>
      </nav>
      <div class="section-header">
        <h1 class="section-title">よくある質問</h1>
        <span class="section-title-en">FAQ</span>
        <div class="section-line"></div>
      </div>

      <div class="faq-list">

        <div class="faq-item">
          <button class="faq-question" aria-expanded="false">
            <span class="faq-q-label">Q</span>
            <span class="faq-q-text">チケットはどのように予約できますか？</span>
            <span class="faq-icon"></span>
          </button>
          <div class="faq-answer">
            <span class="faq-a-label">A</span>
            <span class="faq-a-text">当サイトのチケット購入ページからオンラインでご予約いただけます。また、劇場窓口でも当日券をお買い求めいただけます。</span>
          </div>
        </div>

        <div class="faq-item">
          <button class="faq-question" aria-expanded="false">
            <span class="faq-q-label">Q</span>
            <span class="faq-q-text">上映中にトイレへ行っても問題ありませんか？</span>
            <span class="faq-icon"></span>
          </button>
          <div class="faq-answer">
            <span class="faq-a-label">A</span>
            <span class="faq-a-text">もちろん途中退席いただけます。ただし、再入場の際はお手元のチケットをスタッフにご提示ください。</span>
          </div>
        </div>

        <div class="faq-item">
          <button class="faq-question" aria-expanded="false">
            <span class="faq-q-label">Q</span>
            <span class="faq-q-text">飲食物の持ち込みは可能ですか？</span>
            <span class="faq-icon"></span>
          </button>
          <div class="faq-answer">
            <span class="faq-a-label">A</span>
            <span class="faq-a-text">外部からの飲食物の持ち込みはご遠慮いただいております。劇場内のコンセッションスタンドにてドリンク・スナック類をお取り扱いしております。</span>
          </div>
        </div>

        <div class="faq-item">
          <button class="faq-question" aria-expanded="false">
            <span class="faq-q-label">Q</span>
            <span class="faq-q-text">駐車場はありますか？</span>
            <span class="faq-icon"></span>
          </button>
          <div class="faq-answer">
            <span class="faq-a-label">A</span>
            <span class="faq-a-text">劇場専用の駐車場はございません。周辺の提携駐車場は、鑑賞券提示で3時間無料でご利用いただけます。公共交通機関でのご来場もお勧めしております。</span>
          </div>
        </div>

      </div>
    </div>
  </div>`,
}


