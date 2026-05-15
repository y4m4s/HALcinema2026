document.addEventListener('DOMContentLoaded', function () {
  const id = parseInt(new URLSearchParams(location.search).get('id'));
  const movie = MOVIES.find(m => m.id === id);
  if (!movie) { location.href = 'index.html'; return; }

  document.title = movie.title + ' | HAL シネマ';

  const main = document.getElementById('detail-main');
  const isNow = movie.status === 'now';

  main.innerHTML = `
    <a href="index.html" class="back-btn">← トップに戻る</a>
    ${buildHero(movie, isNow)}
    ${buildInfoSection(movie)}
    ${buildBooking(movie, isNow)}
  `;

  const dateTabs = document.getElementById('detail-date-tabs');
  if (dateTabs) {
    dateTabs.addEventListener('click', function (e) {
      const btn = e.target.closest('.sub-tab');
      if (!btn || btn.classList.contains('no-play')) return;
      dateTabs.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
    });
  }
});

function buildHero(movie, isNow) {
  const posterHtml = movie.image
    ? `<img src="${movie.image}" alt="${movie.title}" class="detail-hero-poster">`
    : `<div class="detail-hero-poster-ph"></div>`;

  return `
    <div class="detail-hero-wrap">
      <div class="detail-hero">
        ${movie.image ? `<div class="detail-hero-bg" style="background-image:url('${movie.image}')"></div>` : ''}
        <div class="detail-hero-overlay"></div>
        <div class="detail-hero-inner">
          <div class="detail-hero-text">
            <div class="detail-status-label">${isNow ? 'NOW SHOWING' : 'COMING SOON'}</div>
            <h1 class="detail-title">${movie.title}</h1>
            ${movie.titleEn ? `<div class="detail-title-en">${movie.titleEn}</div>` : ''}
            <div class="detail-meta">
              ${badge(movie.rating, true)}
              ${badge(movie.duration + '分')}
              ${movie.genre.map(g => badge(g)).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="detail-hero-poster-wrap">${posterHtml}</div>
    </div>
  `;
}

function buildBooking(movie, isNow) {
  if (!isNow) {
    return `
      <div class="detail-booking">
        <div class="booking-section-label">Ticket — チケット予約</div>
        <div class="coming-soon-notice">
          <div class="coming-soon-date">${movie.releaseDate} 公開予定</div>
          <div class="coming-soon-text">予約受付は公開日前日より開始予定です</div>
        </div>
      </div>
    `;
  }

  const dayMap = { '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6 };
  const todayStr = '5/15(金)';
  const defaultDate = (movie.playingDays && DATES.find(d => {
    const m = d.match(/\((.)\)/);
    return d === todayStr && m && movie.playingDays.includes(dayMap[m[1]]);
  })) ? todayStr : DATES.find(d => {
    const m = d.match(/\((.)\)/);
    return m && movie.playingDays && movie.playingDays.includes(dayMap[m[1]]);
  }) || DATES[0];

  const todayLabel = '5/15(金)';
  const dateTabs = DATES.map(d => {
    const m = d.match(/\((.)\)/);
    const isPlaying = m && movie.playingDays && movie.playingDays.includes(dayMap[m[1]]);
    const todayBadge = d === todayLabel ? '<span class="today-badge">TODAY</span>' : '';
    return `<button class="sub-tab${d === defaultDate ? ' active' : ''}${!isPlaying ? ' no-play' : ''}" data-date="${d}">${d}${todayBadge}</button>`;
  }).join('');

  return `
    <div class="detail-booking">
      <div class="booking-section-label">Ticket — チケット予約</div>
      <div class="sub-tabs" id="detail-date-tabs">${dateTabs}</div>
      <div class="detail-theaters-wrap">
        <div class="theaters-grid">
          ${buildTheaterCols(movie)}
        </div>
      </div>
      ${movie.note ? `
        <div class="movie-card-note">
          <span class="note-label">補足事項</span>
          <span class="note-text">${movie.note}</span>
        </div>
      ` : ''}
    </div>
  `;
}

function buildTheaterCols(movie) {
  if (!movie.screenSchedules || !movie.screenSchedules.length) {
    return '<div style="color:var(--text3);font-size:13px;padding:20px">本日の上映スケジュールはありません</div>';
  }
  return movie.screenSchedules.map(sc => {
    const screen = SCREENS.find(s => s.num === sc.screen);
    const slotsHtml = sc.slots.map(slot => {
      const isSoldout = slot.status === 'soldout';
      const statusClass = isSoldout ? 'soldout' : slot.status === 'few' ? 'few' : 'ok';
      const statusText  = isSoldout ? '販売終了' : slot.status === 'few' ? '△残りわずか' : '◎余裕あり';
      return `
        <div class="time-slot${isSoldout ? ' soldout' : ''}" ${!isSoldout ? "onclick=\"alert('チケット予約システムへ移動します')\"" : ''}>
          <div class="time-slot-time">${slot.start} 〜 ${slot.end}</div>
          <div class="time-slot-status ${statusClass}">${statusText}</div>
        </div>`;
    }).join('');
    const featureBadges = screen
      ? screen.features.slice(0, 3).map(f => `<span class="feature-badge">${f}</span>`).join('')
      : '';
    return `
      <div class="theater-col">
        <div class="theater-col-header">
          <div class="theater-col-left">
            <span class="theater-col-num">スクリーン ${sc.screen}</span>
            ${screen ? `<span class="theater-col-meta">${screen.type} · ${screen.seats}席</span>` : ''}
          </div>
          ${featureBadges ? `<div class="theater-col-features">${featureBadges}</div>` : ''}
        </div>
        <div class="slots-grid${sc.slots.length === 4 ? ' slots-grid--quad' : ''}">${slotsHtml}</div>
      </div>`;
  }).join('');
}

function buildInfoSection(movie) {
  return `
    <div class="detail-info-section">
      <div class="detail-synopsis-wrap">
        <div class="detail-section-title">Synopsis — あらすじ</div>
        <p class="detail-synopsis">${movie.synopsis}</p>
      </div>
      <div class="detail-sub-grid">
        <div>
          <div class="detail-section-title">Staff &amp; Cast</div>
          <div class="detail-cast-list">
            <div class="detail-cast-item director">
              <span class="cast-role">監督</span>
              <span class="cast-name">${movie.director}</span>
            </div>
            ${movie.cast.map(c => `
              <div class="detail-cast-item">
                <span class="cast-role">出演</span>
                <span class="cast-name">${c}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div>
          <div class="detail-section-title">Film Info</div>
          ${[
            ['原題', movie.titleEn],
            ['上映時間', movie.duration + '分'],
            ['レーティング', movie.rating],
            ['公開日', movie.releaseDate],
            ['ジャンル', movie.genre.join('・')],
          ].map(([l, v]) => `
            <div class="film-info-row">
              <span class="film-info-label">${l}</span>
              <span class="film-info-value">${v}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}
