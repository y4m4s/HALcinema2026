import { forwardRef, type PropsWithChildren } from 'react'
import { Footer } from './Footer'
import { Header } from './Header'

type LayoutProps = PropsWithChildren<{
  currentPage: string
}>

export const Layout = forwardRef<HTMLDivElement, LayoutProps>(function Layout(
  { children, currentPage },
  ref,
) {
  return (
    <div className="app-root" ref={ref}>
      <Header currentPage={currentPage} />
      {children}
      <Footer />
    </div>
  )
})
