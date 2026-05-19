document.addEventListener('DOMContentLoaded', function () {
  const comingSynopsisLimit = 110;
  const nowShowingPreviewLimit = 5;
  const featured = MOVIES.find(m => m.isFeature);
  const nowShowing = MOVIES.filter(m => m.status === 'now');
  const nowShowingPreview = nowShowing.slice(0, nowShowingPreviewLimit);
  const coming = MOVIES.filter(m => m.status === 'coming');

  // Hero
  document.getElementById('hero-bg').style.backgroundImage = `url('${featured.image}')`;
  document.getElementById('hero-title').textContent = featured.title;
  document.getElementById('hero-meta').innerHTML =
    badge(featured.rating, true) +
    badge(featured.duration + '分') +
    badge(featured.genre.join(' / ')) +
    badge('監督：' + featured.director);
  document.getElementById('hero-synopsis').textContent = featured.synopsis;
  const heroDetailLink = document.getElementById('hero-detail-link');
  if (heroDetailLink) {
    heroDetailLink.href = `detail.html?id=${featured.id}`;
  }

  // Ticker
  const tickerHTML = [...NEWS, ...NEWS].map(n =>
    `<span class="ticker-item"><span>${n.tag}</span>${n.title}</span>`
  ).join('');
  const inner = document.getElementById('ticker-inner');
  inner.innerHTML = tickerHTML + tickerHTML;

  // Now Showing
  document.getElementById('now-showing-grid').innerHTML = nowShowingPreview.map(m => `
    <a href="detail.html?id=${m.id}" class="movie-card">
      ${m.image
        ? `<img src="${m.image}" alt="${m.title}" class="movie-card-poster">`
        : `<div class="movie-card-poster-placeholder"><span class="ph-label">poster</span></div>`}
      <div class="movie-card-overlay">
        <button class="movie-card-overlay-btn">詳細を見る</button>
      </div>
      <div class="movie-card-body">
        <div class="movie-card-rating">${m.rating}</div>
        <div class="movie-card-title">${m.title}</div>
        <div class="movie-card-meta">
          <span>${m.duration}分</span>
          <span>スクリーン ${m.screens.join('・')}</span>
        </div>
        <div class="movie-card-genres">
          ${m.genre.map(g => `<span class="genre-tag">${g}</span>`).join('')}
        </div>
      </div>
    </a>
  `).join('');

  // Coming Soon
  document.getElementById('coming-grid').innerHTML = coming.map(m => `
    <a href="detail.html?id=${m.id}" class="coming-card">
      <div class="coming-poster-wrap">
        ${m.image
          ? `<img src="${m.image}" alt="${m.title}" class="coming-poster">`
          : `<div class="coming-poster-placeholder">NO IMAGE</div>`}
      </div>
      <div class="coming-body">
        <div class="coming-release">${m.releaseDate} 公開予定</div>
        <div class="coming-title">${m.title}</div>
        <div class="coming-title-en">${m.titleEn}</div>
        <div class="coming-badges">
          ${badge(m.rating, true)}
          ${m.genre.map(g => badge(g)).join('')}
        </div>
        <p class="coming-synopsis">${truncateText(m.synopsis, comingSynopsisLimit)}</p>
      </div>
    </a>
  `).join('');

  const nowShowingMoreLink = document.getElementById('now-showing-more-link');
  const nowShowingMoreCount = document.getElementById('now-showing-more-count');
  if (nowShowingMoreLink && nowShowingMoreCount) {
    const hasMore = nowShowing.length > nowShowingPreviewLimit;
    nowShowingMoreLink.hidden = !hasMore;
    nowShowingMoreCount.textContent = hasMore ? `${nowShowing.length}作品すべて表示` : '';
  }

  // News
  document.getElementById('home-news-list').innerHTML = NEWS.map(n => `
    <div class="news-item">
      <span class="news-date">${n.date}</span>
      <span class="news-tag" data-tag="${n.tag}">${n.tag}</span>
      <span class="news-title">${n.title}</span>
    </div>
  `).join('');
});

function truncateText(text, maxLength) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  const chars = Array.from(normalized);
  if (chars.length <= maxLength) return normalized;
  return chars.slice(0, maxLength).join('').trimEnd() + '……';
}

// Parallax: hero background scrolls slower than page
(function () {
  var bg = document.getElementById('hero-bg');
  if (!bg) return;
  bg.style.transition = 'filter 0.3s';
  window.addEventListener('scroll', function () {
    bg.style.transform = 'translateY(' + Math.round(window.pageYOffset * 0.4) + 'px)';
  }, { passive: true });
}());

// Scroll reveal: fade-in as elements enter viewport
(function () {
  var fullEls = document.querySelectorAll('.feature-item, .news-item, .coming-card');
  var fadeEls = document.querySelectorAll('.movie-card');
  fullEls.forEach(function (el) { el.classList.add('js-reveal-full'); });
  fadeEls.forEach(function (el) { el.classList.add('js-reveal-fade'); });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var siblings = Array.from(entry.target.parentNode.children);
      var delay = (siblings.indexOf(entry.target) % 4) * 80;
      setTimeout(function () { entry.target.classList.add('is-visible'); }, delay);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

  fullEls.forEach(function (el) { observer.observe(el); });
  fadeEls.forEach(function (el) { observer.observe(el); });
}());

// 3D tilt: movie cards rotate toward cursor
(function () {
  document.querySelectorAll('.movie-card').forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = 'translateY(-4px) perspective(800px) rotateX(' + (-y * 8).toFixed(2) + 'deg) rotateY(' + (x * 8).toFixed(2) + 'deg)';
    });
    card.addEventListener('mouseleave', function () {
      card.style.transform = '';
    });
  });
}());
