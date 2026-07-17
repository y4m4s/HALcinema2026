import type { PageDefinition } from '../types'

export const ticketsPage: PageDefinition = {
  title: "料金案内 | HAL シネマ",
  bodyClass: "tickets-page",
  styles: [
  "/css/fonts.css",
  "/css/style.css",
  "/css/tickets.css"
],
  html: String.raw`<div class="page page-enter">
    <div class="section">

      <nav class="breadcrumb-nav" aria-label="パンくずリスト">
        <ol class="breadcrumb">
          <li class="breadcrumb__list"><a href="/">トップページ</a></li>
          <li class="breadcrumb__list" aria-current="page">料金案内</li>
        </ol>
      </nav>
      <div class="section-header">
        <h1 class="section-title">料金案内</h1>
        <span class="section-title-en">Ticket Prices</span>
        <div class="section-line"></div>
      </div>

      <table class="ticket-table">
        <thead>
          <tr>
            <th>区分</th>
            <th>料金</th>
            <th>備考</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>一般</td>
            <td><div class="ticket-price">1,800円</div></td>
            <td><div class="ticket-note">—</div></td>
          </tr>
          <tr>
            <td>大学生・専門学生</td>
            <td><div class="ticket-price">1,600円</div></td>
            <td><div class="ticket-note">学生証提示</div></td>
          </tr>
          <tr>
            <td>中学・高校生</td>
            <td><div class="ticket-price">1,400円</div></td>
            <td><div class="ticket-note">学生証提示</div></td>
          </tr>
          <tr>
            <td>小学生・幼児</td>
            <td><div class="ticket-price">1,000円</div></td>
            <td><div class="ticket-note">—</div></td>
          </tr>
          <tr>
            <td>3D 追加料金</td>
            <td><div class="ticket-price">+400円</div></td>
            <td><div class="ticket-note">対象作品のみ</div></td>
          </tr>
          <tr>
            <td>呪いのサービスデー（毎月13日）</td>
            <td><div class="ticket-price">1,300円</div></td>
            <td><div class="ticket-note">中学生以上</div></td>
          </tr>
        </tbody>
      </table>

      <div class="tickets-note-box">
        <div class="tickets-note-title">
          NOTE — ご注意</div>
        <ul class="tickets-note-list">
          <li class="tickets-note-item"><span class="tickets-note-marker">—</span>チケットのご購入は窓口・公式サイトにて承っています。</li>
          <li class="tickets-note-item"><span class="tickets-note-marker">—</span>R15+・R18+作品は年齢確認のため身分証の提示をお願いする場合があります。</li>
          <li class="tickets-note-item"><span class="tickets-note-marker">—</span>3D上映は対象作品のみです。3Dメガネは無料貸出。</li>
          <li class="tickets-note-item"><span class="tickets-note-marker">—</span>呪いのサービスデー（毎月13日）は、中学生以上の券種が1,300円となります。小学生・幼児は通常料金です。</li>
        </ul>
      </div>

      <div class="section-header tickets-subsection-header">
        <span class="section-title tickets-subsection-title">割引デー・特典</span>
        <div class="section-line"></div>
      </div>
      <div class="coming-grid">
        <div class="coming-card">
          <div class="coming-release">毎月13日</div>
          <div class="coming-title tickets-promo-title">呪いのサービスデー</div>
          <p class="coming-synopsis">中学生以上の券種が1,300円。13日がかかわる恐怖を、割引価格でどうぞ。</p>
        </div>
        <div class="coming-card">
          <div class="coming-release">最終回上映</div>
          <div class="coming-title tickets-promo-title">レイトショー割引</div>
          <p class="coming-synopsis">最終回の上映のみ100円引き。深夜の恐怖、さらにお得に。</p>
        </div>
        <div class="coming-card">
          <div class="coming-release">4名以上</div>
          <div class="coming-title tickets-promo-title">グループ割引</div>
          <p class="coming-synopsis">4名以上のグループご来場で、1名様につき200円引き。怖いときは一緒に。</p>
        </div>
        <!-- <div class="coming-card">
          <div class="coming-release">仮装来場</div>
          <div class="coming-title tickets-promo-title">ホラーコス割</div>
          <p class="coming-synopsis">ホラー系の仮装でご来場のお客様は200円引き。恐怖の世界へ、その姿のままで。</p>
        </div> -->
      </div>
    </div>
  </div>`,
}


