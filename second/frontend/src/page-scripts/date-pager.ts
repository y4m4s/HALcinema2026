// 日付タブのページ送り。
// 7日分のタブが横スクロールになる幅（schedule.css の @media (max-width: 500px)）では
// 4日ずつ表示し、左右のボタンで前後の4日へ切り替える。
// それより広い幅では CSS 側で包み要素とボタンを無効にし、7日分をそのまま並べる。

const PAGE_SIZE = 4

export function datePagerHtml(tabsHtml: string, extraClass = ''): string {
  const className = extraClass ? `date-pager ${extraClass}` : 'date-pager'
  return `<div class="${className}" data-date-pager>
    <button type="button" class="date-pager-btn" data-date-pager-prev aria-label="前の日付を表示">&larr;</button>
    ${tabsHtml}
    <button type="button" class="date-pager-btn" data-date-pager-next aria-label="次の日付を表示">&rarr;</button>
  </div>`
}

// タブを描き直すたびに呼ぶ。クリック処理は onclick に入れるので、同じ要素に
// 何度呼んでも処理が重複しない。
export function setupDatePager(pager: Element | null): void {
  if (!(pager instanceof HTMLElement)) return
  const tabs = Array.from(pager.querySelectorAll<HTMLElement>('.sub-tab'))
  const prev = pager.querySelector<HTMLButtonElement>('[data-date-pager-prev]')
  const next = pager.querySelector<HTMLButtonElement>('[data-date-pager-next]')
  if (tabs.length === 0 || !prev || !next) return

  const pageCount = Math.ceil(tabs.length / PAGE_SIZE)
  const pageOf = (index: number) => Math.floor(index / PAGE_SIZE)

  // 選択中の日付を含むページから始める。選択が無ければ TODAY を含むページ。
  const activeIndex = tabs.findIndex((tab) => tab.classList.contains('active'))
  const todayIndex = tabs.findIndex((tab) => tab.querySelector('.today-badge'))
  let page = pageOf(Math.max(0, activeIndex >= 0 ? activeIndex : todayIndex))

  // TODAY の無いページだけタブが低くならないよう、CSS で TODAY バッジ1行分の高さを確保する目印
  pager.classList.toggle('has-today', todayIndex >= 0)
  tabs.forEach((tab, index) => tab.classList.toggle('is-today', index === todayIndex))

  const apply = () => {
    tabs.forEach((tab, index) => tab.classList.toggle('is-off-page', pageOf(index) !== page))
    prev.disabled = page === 0
    next.disabled = page >= pageCount - 1
  }

  const move = (delta: number, pressed: HTMLButtonElement, other: HTMLButtonElement) => {
    const target = page + delta
    if (target < 0 || target >= pageCount) return
    page = target
    apply()
    // 押したボタンが端で無効になったら、キーボード操作が途切れないよう反対側へ移す
    if (pressed.disabled) other.focus()
  }

  pager.onclick = (event) => {
    const target = event.target instanceof Element ? event.target : null
    if (!target) return
    if (target.closest('[data-date-pager-prev]')) {
      move(-1, prev, next)
      return
    }
    if (target.closest('[data-date-pager-next]')) {
      move(1, next, prev)
      return
    }
    // 広い幅でページ外の日付を選んだあとに幅が狭くなっても、選択中の日付が見えるようにする
    const tab = target.closest<HTMLElement>('.sub-tab')
    if (tab && tabs.includes(tab)) {
      page = pageOf(tabs.indexOf(tab))
      apply()
    }
  }

  apply()
}
