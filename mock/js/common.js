function getCurrentPage() {
  const p = location.pathname;
  if (p.includes('schedule')) return 'schedule';
  if (p.includes('theater'))  return 'theater';
  if (p.includes('tickets'))  return 'tickets';
  if (p.includes('news'))     return 'news';
  if (p.includes('contact'))  return 'contact';
  if (p.includes('detail'))   return 'detail';
  return 'home';
}

function renderNav() {
  const active = getCurrentPage();
  const links = [
    { id:'home',     label:'トップ',         href:'index.html' },
    { id:'schedule', label:'上映スケジュール', href:'schedule.html' },
    { id:'theater',  label:'劇場案内',        href:'theater.html' },
    { id:'tickets',  label:'料金案内',        href:'tickets.html' },
    { id:'news',     label:'お知らせ',        href:'news.html' },
    { id:'contact',  label:'お問い合わせ',    href:'contact.html' },
  ];
  document.getElementById('nav-root').innerHTML = `
    <nav class="nav">
      <a class="nav-logo" href="index.html">
        <span class="hal">HAL</span>
        <span style="color:#dde4f0">シネマ</span>
        <span class="tag">Horror &amp; Mystery</span>
      </a>
      <div class="nav-links">
        ${links.map(l => `
          <a href="${l.href}" class="nav-link${active === l.id ? ' active' : ''}">${l.label}</a>
        `).join('')}
      </div>
    </nav>
  `;
}

function renderFooter() {
  document.getElementById('footer-root').innerHTML = `
    <footer class="footer">
      <div class="footer-top">
        <div class="footer-brand">
          <div class="footer-logo"><span>HAL</span>シネマ</div>
          <div class="footer-tagline">
            ホラー・ミステリー・サスペンス専門映画館<br>
            〒150-0001 東京都渋谷区神宮前1-2-3 HALビル<br>
            営業時間：10:00 — 翌0:00
          </div>
          <div class="sns-links">
            <span class="sns-link">X / Twitter</span>
            <span class="sns-link">Instagram</span>
            <span class="sns-link">YouTube</span>
          </div>
        </div>
        <div>
          <div class="footer-col-title">上映情報</div>
          <a href="index.html" class="footer-link">上映中</a>
          <a href="index.html" class="footer-link">近日公開</a>
          <a href="schedule.html" class="footer-link">上映スケジュール</a>
        </div>
        <div>
          <div class="footer-col-title">劇場情報</div>
          <a href="theater.html" class="footer-link">劇場案内</a>
          <a href="tickets.html" class="footer-link">料金案内</a>
          <a href="news.html" class="footer-link">お知らせ</a>
        </div>
        <div>
          <div class="footer-col-title">その他</div>
          <a href="contact.html" class="footer-link">お問い合わせ</a>
          <span class="footer-link">プライバシーポリシー</span>
          <span class="footer-link">利用規約</span>
          <span class="footer-link">会社情報</span>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2025 HAL シネマ. All Rights Reserved.</span>
        <span style="color:var(--text3)">HORROR · MYSTERY · SUSPENSE</span>
      </div>
    </footer>
  `;
}

function badge(text, isRating) {
  const c = isRating ? 'var(--red2)' : 'var(--text2)';
  const b = isRating ? 'var(--red2)' : 'var(--border2)';
  return `<span style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;border:1px solid ${b};color:${c};padding:3px 8px;display:inline-block">${text}</span>`;
}

document.addEventListener('DOMContentLoaded', function () {
  renderNav();
  renderFooter();
});
