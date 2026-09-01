export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-watermark" aria-hidden="true">HAL CINEMA KYOKAI</div>
        <div className="footer-main">
          <div className="footer-brand">
            <div className="footer-kicker">Horror Theatre</div>
            <div className="footer-logo">
              <img className="footer-logo-img" src="/assets/hal-cinema-kyokai-logo.svg" alt="HALシネマ 境界" />
            </div>
            <p className="footer-tagline">
              ホラー・ミステリー・サスペンスを中心に、深夜まで上映する都市型シアター。
            </p>
            <dl className="footer-meta">
              <div><dt>ADDRESS</dt><dd>〒450-0002 愛知県名古屋市中村区名駅4-4-38</dd></div>
              <div><dt>OPEN</dt><dd>9:00 - 翌0:30</dd></div>
            </dl>
          </div>
          <div className="footer-directory">
            <div className="footer-col">
              <div className="footer-col-title">上映情報</div>
              <a href="/works" className="footer-link">上映作品一覧</a>
              <a href="/schedule" className="footer-link">上映スケジュール</a>
              <a href="/" className="footer-link">トップ</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">劇場情報</div>
              <a href="/theater" className="footer-link">劇場案内</a>
              <a href="/tickets" className="footer-link">料金案内</a>
              <a href="/access" className="footer-link">交通案内</a>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">サポート</div>
              <a href="/contact" className="footer-link">お問い合わせ</a>
              <a href="/question" className="footer-link">よくある質問</a>
              <a href="/news" className="footer-link">お知らせ</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 HALシネマ 境界. All Rights Reserved.</span>
          <span>HORROR · MYSTERY · SUSPENSE</span>
        </div>
      </div>
    </footer>
  )
}
