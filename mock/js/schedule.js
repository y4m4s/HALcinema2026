document.addEventListener('DOMContentLoaded', function () {
  const nowShowing = MOVIES.filter(m => m.status === 'now');
  let viewMode = 'date';
  let dateIdx = 0;
  let movieIdx = 0;
  let movieDateIdx = 0;
  document.getElementById('view-tabs').addEventListener('click', function (e) {
    const btn = e.target.closest('.view-tab');
    if (!btn) return;
    viewMode = btn.dataset.mode;
    document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSubTabs();
    renderHeading();
    fadeRows(renderRows);
  });

  function render() {
    renderSubTabs();
    renderHeading();
    renderRows();
  }

  function fadeRows(callback) {
    const el = document.getElementById('schedule-rows');
    el.classList.add('rows-hidden');
    setTimeout(function () {
      callback();
      el.classList.remove('rows-hidden');
    }, 110);
  }

  function renderSubTabs() {
    const root = document.getElementById('sub-tabs');
    if (viewMode === 'date') {
      root.innerHTML = '<div class="sub-tabs">' +
        DATES.map((d, i) =>
          `<button class="sub-tab${i === dateIdx ? ' active' : ''}" data-idx="${i}">${d}</button>`
        ).join('') + '</div>';
      root.querySelector('.sub-tabs').addEventListener('click', function (e) {
        const btn = e.target.closest('.sub-tab');
        if (!btn) return;
        dateIdx = parseInt(btn.dataset.idx);
        root.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderHeading();
        fadeRows(renderRows);
      });
    } else {
      root.innerHTML = '<div class="movie-tabs">' +
        nowShowing.map((m, i) => {
          const poster = m.image
            ? `<img class="movie-tab-poster" src="${m.image}" alt="${m.title}">`
            : `<div class="movie-tab-poster-ph">${m.titleEn ? m.titleEn.slice(0, 6) : 'NO IMG'}</div>`;
          return `
            <div class="movie-tab-card${i === movieIdx ? ' active' : ''}" data-idx="${i}">
              ${poster}
              <div class="movie-tab-body">
                <div class="movie-tab-title">${m.title}</div>
                <div class="movie-tab-meta">${m.rating} · ${m.duration}分</div>
              </div>
            </div>`;
        }).join('') + '</div>';
      root.querySelector('.movie-tabs').addEventListener('click', function (e) {
        const card = e.target.closest('.movie-tab-card');
        if (!card) return;
        movieIdx = parseInt(card.dataset.idx);
        movieDateIdx = 0;
        root.querySelectorAll('.movie-tab-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        renderHeading();
        fadeRows(renderRows);
      });
    }
  }

  function renderHeading() {
    const el = document.getElementById('schedule-heading');
    if (viewMode === 'date') {
      el.innerHTML = `<div class="schedule-heading">${DATES[dateIdx]} の上映スケジュール</div>`;
    } else {
      const m = nowShowing[movieIdx];
      el.innerHTML = `
        <div class="schedule-heading">${m.title} の上映スケジュール</div>
        <div class="sub-tabs movie-date-tabs" id="movie-date-tabs">
          ${DATES.map((d, i) => {
            const playing = !m.playingDays || m.playingDays.includes(i);
            return `<button class="sub-tab${i === movieDateIdx ? ' active' : ''}${!playing ? ' no-play' : ''}" data-idx="${i}">${d}</button>`;
          }).join('')}
        </div>`;
      document.getElementById('movie-date-tabs').addEventListener('click', function (e) {
        const btn = e.target.closest('.sub-tab');
        if (!btn) return;
        movieDateIdx = parseInt(btn.dataset.idx);
        document.querySelectorAll('#movie-date-tabs .sub-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fadeRows(renderRows);
      });
    }
  }

  function emptyHtml(message, sub) {
    return `
      <div class="schedule-empty">
        <svg class="schedule-empty-icon" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6" y="13" width="24" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M30 18 L38 14 L38 30 L30 26 Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="18" cy="22" r="4.5" stroke="currentColor" stroke-width="1.5"/>
          <line x1="6" y1="8" x2="30" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 3"/>
        </svg>
        <div class="schedule-empty-text">${message}</div>
        <div class="schedule-empty-sub">${sub}</div>
      </div>`;
  }

  function renderRows() {
    const el = document.getElementById('schedule-rows');
    if (viewMode === 'date') {
      const movies = nowShowing.slice();
      if (movies.length === 0) {
        el.innerHTML = emptyHtml('上映中の作品がありません', 'NO MOVIES SCHEDULED');
        return;
      }
      el.innerHTML = movies.map((m, i) => renderMovieCard(m, i)).join('');
    } else {
      const m = nowShowing[movieIdx];
      const isPlaying = !m.playingDays || m.playingDays.includes(movieDateIdx);
      if (!isPlaying) {
        el.innerHTML = emptyHtml('この日は上映がありません', 'NO SCREENINGS ON THIS DATE');
        return;
      }
      el.innerHTML = renderMovieCard(m, 0);
    }
  }

  function getScreenSchedules(m) {
    if (m.screenSchedules && m.screenSchedules.length > 0) return m.screenSchedules;
    return m.screens.map(sc => ({
      screen: sc,
      slots: m.schedules.map(function (s) { return { start: s[0], end: s[1], status: 'ok' }; })
    }));
  }

  function renderMovieCard(m, idx) {
    const delay = (idx * 0.07).toFixed(2);
    const imgInner = m.image
      ? `<img src="${m.image}" alt="${m.title}">`
      : '<div class="movie-thumb-placeholder">NO IMAGE</div>';
    const imgHtml = `<a href="detail.html?id=${m.id}" class="movie-thumb-link">${imgInner}</a>`;

    const theatersHtml = getScreenSchedules(m).map(function (sc) {
      const slotsHtml = sc.slots.map(function (slot) {
        const statusClass = slot.status === 'soldout' ? 'soldout' : slot.status === 'few' ? 'few' : 'ok';
        const statusText  = slot.status === 'soldout' ? '販売終了' : slot.status === 'few' ? '△残りわずか' : '◎余裕あり';
        return `
          <div class="time-slot${statusClass === 'soldout' ? ' soldout' : ''}">
            <div class="time-slot-time">${slot.start} 〜 ${slot.end}</div>
            <div class="time-slot-status ${statusClass}">${statusText}</div>
          </div>`;
      }).join('');
      const screenInfo = SCREENS.find(s => s.num === sc.screen);
      return `
        <div class="theater-col">
          <div class="theater-col-header">
            <span class="theater-col-num">スクリーン ${sc.screen}</span>
            ${screenInfo ? `<span class="theater-col-meta">${screenInfo.type} · ${screenInfo.seats}席</span>` : ''}
          </div>
          <div class="slots-grid${sc.slots.length === 4 ? ' slots-grid--quad' : ''}">${slotsHtml}</div>
        </div>`;
    }).join('');

    const noteText = m.note || '—';

    return `
      <div class="movie-card" style="--card-delay: ${delay}s">
        <div class="movie-card-header">
          <div class="movie-card-title-wrap">
            <a href="detail.html?id=${m.id}" class="movie-card-title">${m.title}</a>
            <span class="movie-card-duration">本編 ${m.duration}分</span>
          </div>
          <div class="movie-card-header-right">
            <a href="detail.html?id=${m.id}" class="btn-ghost" style="font-size:11px;padding:6px 12px">詳細</a>
          </div>
        </div>
        <div class="movie-card-body">
          <div class="movie-thumb">${imgHtml}</div>
          <div class="theaters-grid">${theatersHtml}</div>
        </div>
        <div class="movie-card-note">
          <span class="note-label">補足事項</span>
          <span class="note-text">${noteText}</span>
        </div>
      </div>`;
  }

  render();
});
