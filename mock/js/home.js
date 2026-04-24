document.addEventListener('DOMContentLoaded', function () {
  const featured = MOVIES.find(m => m.isFeature);
  const nowShowing = MOVIES.filter(m => m.status === 'now');
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
  document.getElementById('hero-cta').innerHTML = `
    <a href="detail.html?id=${featured.id}" class="btn-primary">作品詳細・上映時刻</a>
    <a href="schedule.html" class="btn-ghost">スケジュール一覧</a>
  `;

  // Ticker
  const tickerHTML = [...NEWS, ...NEWS].map(n =>
    `<span class="ticker-item"><span>${n.tag}</span>${n.title}</span>`
  ).join('');
  const inner = document.getElementById('ticker-inner');
  inner.innerHTML = tickerHTML + tickerHTML;

  // Now Showing
  document.getElementById('now-showing-grid').innerHTML = nowShowing.map(m => `
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
      <div class="coming-release">${m.releaseDate} 公開予定</div>
      <div class="coming-title">${m.title}</div>
      <div class="coming-title-en">${m.titleEn}</div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        ${badge(m.rating, true)}
        ${m.genre.map(g => badge(g)).join('')}
      </div>
      <p class="coming-synopsis">${m.synopsis}</p>
    </a>
  `).join('');

  // News
  document.getElementById('home-news-list').innerHTML = NEWS.map(n => `
    <div class="news-item">
      <span class="news-date">${n.date}</span>
      <span class="news-tag">${n.tag}</span>
      <span class="news-title">${n.title}</span>
    </div>
  `).join('');
});
