/* eslint-disable no-irregular-whitespace */

function getCurrentPage() {
  const path = location.pathname
  if (path.includes('works')) return 'works'
  if (path.includes('schedule')) return 'schedule'
  if (path.includes('theater')) return 'theater'
  if (path.includes('access')) return 'access'
  if (path.includes('tickets')) return 'tickets'
  if (path.includes('question')) return 'question'
  if (path.includes('detail')) return 'works'
  return 'home'
}

function getPageMeta() {
  const path = location.pathname
  if (path === '/' || path.includes('index')) return null
  if (path.includes('works')) return { label: '上映作品一覧' }
  if (path.includes('schedule')) return { label: '上映スケジュール' }
  if (path.includes('theater')) return { label: '劇場案内' }
  if (path.includes('tickets')) return { label: '料金案内' }
  if (path.includes('access')) return { label: '交通案内' }
  if (path.includes('question')) return { label: 'よくある質問' }
  if (path.includes('contact')) return { label: 'お問い合わせ' }
  if (path.includes('completed')) {
    return { label: 'お問い合わせ完了', parent: { label: 'お問い合わせ', href: '/contact' } }
  }
  if (path.includes('news')) return { label: 'お知らせ' }
  return null
}

function buildNavHtml() {
  const links = [
    { id: 'works', label: '上映作品一覧', href: '/works' },
    { id: 'schedule', label: '上映スケジュール', href: '/schedule' },
    { id: 'theater', label: '劇場案内', href: '/theater' },
    { id: 'access', label: '交通案内', href: '/access' },
    { id: 'tickets', label: '料金案内', href: '/tickets' },
    { id: 'question', label: 'よくある質問', href: '/question' },
  ]

  return `
    <header class="site-header">
      <nav class="nav" aria-label="グローバルナビゲーション">
        <a class="nav-logo" href="/" aria-label="HALシネマ 境界 トップへ">
          <img class="nav-logo-img" src="/assets/hal-cinema-kyokai-logo.svg" alt="HALシネマ 境界">
        </a>
        <div class="nav-links">
          ${links
            .map(
              (link) => `
            <a href="${link.href}" class="nav-link" data-nav="${link.id}">
              <span>${link.label}</span>
            </a>
          `,
            )
            .join('')}
        </div>
      </nav>
    </header>
  `
}

function renderNav() {
  const active = getCurrentPage()
  const root = document.getElementById('nav-root')
  if (!root) return

  root.innerHTML = buildNavHtml()

  root.querySelectorAll('.nav-link').forEach((link) => {
    const isActive = ((link as HTMLElement).dataset.nav || '') === active
    link.classList.toggle('active', isActive)
    if (isActive) {
      link.setAttribute('aria-current', 'page')
    } else {
      link.removeAttribute('aria-current')
    }
  })
}

function buildFooterHtml() {
  return `
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
  `
}

function renderFooter() {
  const root = document.getElementById('footer-root')
  if (root) root.innerHTML = buildFooterHtml()
}

function renderBreadcrumb() {
  const meta = getPageMeta()
  if (!meta) return
  if (document.querySelector('.breadcrumb')) return

  const anchor =
    document.querySelector('.works-hero .section-header') ||
    document.querySelector('.page > .section > .section-header') ||
    document.querySelector('.page .section .section-header')
  if (!anchor || !anchor.parentNode) return

  const parent =
    'parent' in meta && meta.parent
      ? `<li class="breadcrumb__list"><a href="${meta.parent.href}">${meta.parent.label}</a></li>`
      : ''

  const breadcrumb = document.createElement('nav')
  breadcrumb.className = 'breadcrumb-nav'
  breadcrumb.setAttribute('aria-label', 'パンくずリスト')
  breadcrumb.innerHTML = `
    <ol class="breadcrumb">
      <li class="breadcrumb__list"><a href="/">トップページ</a></li>
      ${parent}
      <li class="breadcrumb__list" aria-current="page">${meta.label}</li>
    </ol>
  `
  anchor.parentNode.insertBefore(breadcrumb, anchor)
}

export function badge(text: string | number, isRating = false) {
  const color = isRating ? 'var(--red2)' : 'var(--text2)'
  const border = isRating ? 'var(--red2)' : 'var(--border2)'
  return `<span style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;border:1px solid ${border};color:${color};padding:3px 8px;display:inline-block">${text}</span>`
}

export function runCommon() {
  renderNav()
  renderBreadcrumb()
  renderFooter()
}

