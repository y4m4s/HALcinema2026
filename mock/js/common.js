function getCurrentPage() {
  const p = location.pathname;
  if (p.includes('works'))    return 'works';
  if (p.includes('schedule')) return 'schedule';
  if (p.includes('theater'))  return 'theater';
  if (p.includes('tickets'))  return 'tickets';
  if (p.includes('news'))     return 'news';
  if (p.includes('contact'))  return 'contact';
  if (p.includes('completed')) return 'contact';
  if (p.includes('detail'))   return 'works';
  return 'home';
}

function getPageMeta() {
  const p = location.pathname;
  if (p.includes('index') || p.endsWith('/')) return null;
  if (p.includes('works')) return { label: '上映作品一覧' };
  if (p.includes('schedule')) return { label: '上映スケジュール' };
  if (p.includes('theater')) return { label: '劇場案内' };
  if (p.includes('tickets')) return { label: '料金案内' };
  if (p.includes('access')) return { label: '交通案内' };
  if (p.includes('question')) return { label: 'よくある質問' };
  if (p.includes('contact')) return { label: 'お問い合わせ' };
  if (p.includes('completed')) return { label: 'お問い合わせ完了', parent: { label: 'お問い合わせ', href: 'contact.html' } };
  if (p.includes('detail-news')) return { label: 'お知らせ詳細', parent: { label: 'お知らせ', href: 'news.html' } };
  if (p.includes('news')) return { label: 'お知らせ' };
  return null;
}

function renderNav() {
  const active = getCurrentPage();
  const root = document.getElementById('nav-root');
  if (!root) return;

  if (!root.querySelector('.site-header')) {
    root.innerHTML = buildNavHtml();
  }

  root.querySelectorAll('.nav-link').forEach(function (link) {
    const isActive = (link.dataset.nav || '') === active;
    link.classList.toggle('active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function buildNavHtml() {
  const links = [
    { id:'home',     label:'トップ',         href:'index.html' },
    { id:'works',    label:'上映作品一覧',   href:'works.html' },
    { id:'schedule', label:'上映スケジュール', href:'schedule.html' },
    { id:'theater',  label:'劇場案内',        href:'theater.html' },
    { id:'tickets',  label:'料金案内',        href:'tickets.html' },
    { id:'contact',  label:'お問い合わせ',    href:'contact.html' },
  ];
  return `
    <header class="site-header">
      <nav class="nav" aria-label="グローバルナビゲーション">
        <a class="nav-logo" href="index.html" aria-label="HAL シネマ トップへ">
          <span class="nav-logo-mark">HAL</span>
          <span class="nav-logo-body">
            <span class="nav-logo-main">シネマ</span>
            <span class="nav-logo-sub">HORROR / MYSTERY / SUSPENSE</span>
          </span>
        </a>
        <div class="nav-links">
          ${links.map(l => `
            <a href="${l.href}" class="nav-link" data-nav="${l.id}">
              <span>${l.label}</span>
            </a>
          `).join('')}
        </div>
      </nav>
    </header>
  `;
}

function renderFooter() {
  const root = document.getElementById('footer-root');
  if (!root || root.querySelector('.footer')) return;

  root.innerHTML = `
    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-watermark" aria-hidden="true">HAL CINEMA</div>
        <div class="footer-main">
          <div class="footer-brand">
            <div class="footer-kicker">Horror Theatre</div>
            <div class="footer-logo"><span>HAL</span>シネマ</div>
            <p class="footer-tagline">
              ホラー・ミステリー・サスペンスを中心に、深夜まで上映する都市型シアター。
            </p>
            <dl class="footer-meta">
              <div>
                <dt>ADDRESS</dt>
                <dd>〒150-0001 東京都渋谷区神宮前1-2-3 HALビル</dd>
              </div>
              <div>
                <dt>OPEN</dt>
                <dd>10:00 - 翌0:00</dd>
              </div>
            </dl>
          </div>
          <div class="footer-directory">
            <div class="footer-col">
              <div class="footer-col-title">上映情報</div>
              <a href="works.html" class="footer-link">上映作品一覧</a>
              <a href="schedule.html" class="footer-link">上映スケジュール</a>
              <a href="index.html" class="footer-link">トップ</a>
            </div>
            <div class="footer-col">
              <div class="footer-col-title">劇場情報</div>
              <a href="theater.html" class="footer-link">劇場案内</a>
              <a href="tickets.html" class="footer-link">料金案内</a>
              <a href="access.html" class="footer-link">交通案内</a>
            </div>
            <div class="footer-col">
              <div class="footer-col-title">サポート</div>
              <a href="contact.html" class="footer-link">お問い合わせ</a>
              <a href="question.html" class="footer-link">よくある質問</a>
              <a href="news.html" class="footer-link">お知らせ</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 HAL シネマ. All Rights Reserved.</span>
          <span>HORROR · MYSTERY · SUSPENSE</span>
        </div>
      </div>
    </footer>
  `;
}

function renderBreadcrumb() {
  const meta = getPageMeta();
  if (!meta) return;
  if (document.querySelector('.breadcrumb')) return;

  const anchor = document.querySelector('.works-hero .section-header') ||
    document.querySelector('.page > .section > .section-header') ||
    document.querySelector('.page .section .section-header');
  if (!anchor || !anchor.parentNode) return;

  const parent = meta.parent
    ? `<li class="breadcrumb__list"><a href="${meta.parent.href}">${meta.parent.label}</a></li>`
    : '';

  const breadcrumb = document.createElement('nav');
  breadcrumb.className = 'breadcrumb-nav';
  breadcrumb.setAttribute('aria-label', 'パンくずリスト');
  breadcrumb.innerHTML = `
    <ol class="breadcrumb">
      <li class="breadcrumb__list"><a href="index.html">トップページ</a></li>
      ${parent}
      <li class="breadcrumb__list" aria-current="page">${meta.label}</li>
    </ol>
  `;
  anchor.parentNode.insertBefore(breadcrumb, anchor);
}

function badge(text, isRating) {
  const c = isRating ? 'var(--red2)' : 'var(--text2)';
  const b = isRating ? 'var(--red2)' : 'var(--border2)';
  return `<span style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;border:1px solid ${b};color:${c};padding:3px 8px;display:inline-block">${text}</span>`;
}

document.addEventListener('DOMContentLoaded', function () {
  renderNav();
  renderBreadcrumb();
  renderFooter();
});
