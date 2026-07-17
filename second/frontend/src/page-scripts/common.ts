function getPageMeta() {
  const path = location.pathname
  if (path === '/' || path.includes('index')) return null
  if (path.includes('works')) return { label: '上映作品一覧' }
  if (path.includes('schedule')) return { label: '上映スケジュール' }
  if (path.includes('booking')) {
    return { label: '座席予約', parent: { label: '上映スケジュール', href: '/schedule' } }
  }
  if (path.includes('theater')) return { label: '劇場案内' }
  if (path.includes('tickets')) return { label: '料金案内' }
  if (path.includes('access')) return { label: '交通案内' }
  if (path.includes('question')) return { label: 'よくある質問' }
  if (path.includes('reservation')) return { label: '予約確認' }
  if (path.includes('member')) return { label: '会員の方へ' }
  if (path.includes('contact')) return { label: 'お問い合わせ' }
  if (path.includes('completed')) {
    return { label: 'お問い合わせ完了', parent: { label: 'お問い合わせ', href: '/contact' } }
  }
  if (path.includes('news')) return { label: 'お知らせ' }
  return null
}

export function renderBreadcrumb() {
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
