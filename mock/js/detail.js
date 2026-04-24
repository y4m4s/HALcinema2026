document.addEventListener('DOMContentLoaded', function () {
  const id = parseInt(new URLSearchParams(location.search).get('id'));
  const movie = MOVIES.find(m => m.id === id);
  if (!movie) { location.href = 'index.html'; return; }

  document.title = movie.title + ' | HAL シネマ';

  const main = document.getElementById('detail-main');
  const statusLabel = movie.status === 'now' ? 'Now Showing' : 'Coming Soon';

  const schedulesHTML = (movie.schedules && movie.schedules.length > 0) ? `
    <div class="detail-section-title">Today's Schedule — 本日の上映</div>
    ${movie.screens.map(sc => {
      const screen = SCREENS.find(s => s.num === sc);
      return `
        <div class="detail-schedule">
          <div style="font-family:var(--mono);font-size:10px;letter-spacing:.15em;color:var(--accent2);margin-bottom:4px">
            SCREEN ${sc} — ${screen ? screen.type : ''}（${screen ? screen.seats : ''}席）
          </div>
          <div class="schedule-times">
            ${movie.schedules.map(t => `
              <div class="schedule-time">${t[0]} <span style="color:var(--text3);font-size:10px">終 ${t[1]}</span></div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('')}
  ` : '';

  const comingHTML = movie.status === 'coming' ? `
    <div class="detail-schedule" style="text-align:center;padding:32px">
      <div style="font-family:var(--mono);font-size:12px;letter-spacing:.2em;color:var(--accent2)">${movie.releaseDate} 公開予定</div>
      <div style="margin-top:8px;color:var(--text2);font-size:13px">上映スケジュールは後日公開予定</div>
    </div>
  ` : '';

  main.innerHTML = `
    <div class="detail-hero">
      ${movie.image ? `<div class="detail-hero-bg" style="background-image:url('${movie.image}')"></div>` : ''}
      <div class="detail-hero-overlay"></div>
      <div class="detail-hero-content">
        ${movie.image
          ? `<img src="${movie.image}" alt="${movie.title}" class="detail-poster">`
          : `<div class="detail-poster-ph">poster</div>`}
        <div class="detail-info">
          <div style="font-family:var(--mono);font-size:9px;letter-spacing:.2em;color:var(--accent2);margin-bottom:12px;text-transform:uppercase">${statusLabel}</div>
          <h1 class="detail-title">${movie.title}</h1>
          <div class="detail-meta">
            ${badge(movie.rating, true)}
            ${badge(movie.duration + '分')}
            ${movie.genre.map(g => badge(g)).join('')}
            ${movie.releaseDate ? badge(movie.releaseDate + ' 公開') : ''}
          </div>
        </div>
      </div>
    </div>

    <a href="index.html" class="back-btn">← トップに戻る</a>

    <div class="detail-body">
      <div>
        <div class="detail-section-title">Synopsis — あらすじ</div>
        <p class="detail-synopsis">${movie.synopsis}</p>
        ${schedulesHTML}
        ${comingHTML}
      </div>
      <div>
        <div class="detail-section-title">Staff &amp; Cast</div>
        <div class="detail-cast-list">
          <div class="detail-cast-item">
            <span style="color:var(--text3);font-size:11px;font-family:var(--mono)">監督</span>
            <span>${movie.director}</span>
          </div>
          ${movie.cast.map(c => `
            <div class="detail-cast-item">
              <span style="color:var(--text3);font-size:11px;font-family:var(--mono)">出演</span>
              <span>${c}</span>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:32px">
          <div class="detail-section-title">Film Info</div>
          ${[
            ['原題', movie.titleEn],
            ['上映時間', movie.duration + '分'],
            ['レーティング', movie.rating],
            ['公開日', movie.releaseDate],
            ['ジャンル', movie.genre.join('・')],
          ].map(([l, v]) => `
            <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px">
              <span style="color:var(--text3);font-family:var(--mono);font-size:10px;letter-spacing:.08em">${l}</span>
              <span style="color:var(--text);text-align:right">${v}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
});
