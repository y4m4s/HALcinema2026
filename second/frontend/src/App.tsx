import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { runCommon } from './page-scripts/common'
import { pageRunners } from './page-scripts/registry'
import { pages } from './pages/registry'
import './App.css'

type RouteState = {
  key: string
  search: string
}

function routeKeyFromPath(pathname: string) {
  const cleaned = pathname.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\.html$/, '')
  if (!cleaned || cleaned === 'index') return 'index'
  return cleaned
}

function getRouteState(): RouteState {
  return {
    key: routeKeyFromPath(window.location.pathname),
    search: window.location.search,
  }
}

function routeForHref(href: string) {
  if (!href || href.startsWith('#')) return href
  if (/^(https?:|mailto:|tel:|data:|blob:|\/assets\/|\/css\/)/i.test(href)) return href
  if (href.startsWith('assets/')) return `/${href}`
  if (href.startsWith('css/') || href.startsWith('js/')) return `/${href}`

  const match = href.match(/^([^?#]+)\.html([?#].*)?$/)
  if (!match) return href

  const page = match[1] === 'index' ? '' : match[1]
  return `/${page}${match[2] || ''}`
}

function rewriteDom(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[src]').forEach((el) => {
    const value = el.getAttribute('src')
    if (value) el.setAttribute('src', routeForHref(value))
  })

  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    const value = anchor.getAttribute('href')
    if (value) anchor.setAttribute('href', routeForHref(value))
  })
}

function installStyles(styles: string[]) {
  document.querySelectorAll('link[data-page-style="true"]').forEach((node) => node.remove())

  styles
    .filter((href) => !href.endsWith('/fonts.css') && !href.endsWith('/style.css'))
    .forEach((href) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      link.dataset.pageStyle = 'true'
      document.head.appendChild(link)
    })
}

function App() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [route, setRoute] = useState<RouteState>(() => getRouteState())
  const page = pages[route.key] ?? pages.index

  useEffect(() => {
    const onPopState = () => setRoute(getRouteState())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return

      const nextUrl = new URL(anchor.href, window.location.href)
      if (nextUrl.origin !== window.location.origin) return

      event.preventDefault()
      window.history.pushState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
      setRoute(getRouteState())
      window.scrollTo(0, 0)
    }

    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    document.title = page.title
    document.body.className = page.bodyClass
    installStyles(page.styles)

    root.innerHTML = page.html

    rewriteDom(root)
    runCommon()
    rewriteDom(root)
    pageRunners[route.key]?.()
    rewriteDom(root)
  }, [page, route.key, route.search])

  return <div className="app-root" ref={rootRef} />
}

export default App

