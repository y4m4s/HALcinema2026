import { useEffect, useRef, useState } from 'react'
import {
  MEMBER_SESSION_CHANGE_EVENT,
  readMemberSession,
  refreshStoredMemberSession,
} from '../page-scripts/member-session'

type HeaderProps = {
  currentPage: string
}

const navLinks = [
  { id: 'works', label: '上映作品一覧', href: '/works' },
  { id: 'schedule', label: '上映スケジュール', href: '/schedule' },
  { id: 'theater', label: '劇場案内', href: '/theater' },
  { id: 'access', label: '交通案内', href: '/access' },
  { id: 'tickets', label: '料金案内', href: '/tickets' },
  { id: 'reservation', label: '予約確認', href: '/reservation' },
]

function getActiveNav(currentPage: string) {
  if (currentPage === 'booking') return 'schedule'
  if (currentPage === 'detail') return 'works'
  return currentPage
}

export function Header({ currentPage }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [memberLoggedIn, setMemberLoggedIn] = useState(() => Boolean(readMemberSession()))
  const toggleRef = useRef<HTMLButtonElement>(null)
  const activeNav = getActiveNav(currentPage)

  useEffect(() => {
    let disposed = false
    const syncMemberSession = () => {
      if (!disposed) setMemberLoggedIn(Boolean(readMemberSession()))
    }

    window.addEventListener(MEMBER_SESSION_CHANGE_EVENT, syncMemberSession)

    if (readMemberSession()?.token) {
      void refreshStoredMemberSession().then(() => syncMemberSession())
    }

    return () => {
      disposed = true
      window.removeEventListener(MEMBER_SESSION_CHANGE_EVENT, syncMemberSession)
    }
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return (
    <header
      className={`site-header${menuOpen ? ' menu-open' : ''}`}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        closeMenu()
        toggleRef.current?.focus()
      }}
    >
      <nav className="nav" aria-label="グローバルナビゲーション">
        <a className="nav-logo" href="/" aria-label="HALシネマ 境界 トップへ" onClick={closeMenu}>
          <img className="nav-logo-img" src="/assets/hal-cinema-kyokai-logo.svg" alt="HALシネマ 境界" />
        </a>
        <button
          ref={toggleRef}
          className="nav-toggle"
          type="button"
          aria-controls="global-nav-links"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="nav-toggle-line" aria-hidden="true" />
          <span className="nav-toggle-line" aria-hidden="true" />
          <span className="nav-toggle-line" aria-hidden="true" />
        </button>
        <div className="nav-links" id="global-nav-links">
          {navLinks.map((link) => {
            const active = link.id === activeNav
            return (
              <a
                key={link.id}
                href={link.href}
                className={`nav-link${active ? ' active' : ''}`}
                data-nav={link.id}
                aria-current={active ? 'page' : undefined}
                onClick={closeMenu}
              >
                <span>{link.label}</span>
              </a>
            )
          })}
          <a
            href="/member"
            className={`nav-link${activeNav === 'member' ? ' active' : ''}${memberLoggedIn ? ' member-logged-in' : ''}`}
            data-nav="member"
            aria-current={activeNav === 'member' ? 'page' : undefined}
            onClick={closeMenu}
          >
            <span>{memberLoggedIn ? 'ログイン中' : '会員の方へ'}</span>
          </a>
        </div>
      </nav>
    </header>
  )
}
