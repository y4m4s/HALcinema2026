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
        <div class="schedule-heading">【 ${m.title} 】の上映スケジュール</div>
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

  function renderRows() {
    const el = document.getElementById('schedule-rows');
    if (viewMode === 'date') {
      const movies = nowShowing.slice();
      if (movies.length === 0) {
        el.innerHTML = '<div class="schedule-empty">該当する作品が見つかりません</div>';
        return;
      }
      el.innerHTML = movies.map(renderMovieCard).join('');
    } else {
      const m = nowShowing[movieIdx];
      const isPlaying = !m.playingDays || m.playingDays.includes(movieDateIdx);
      if (!isPlaying) {
        el.innerHTML = '<div class="schedule-empty">この日は上映がありません</div>';
        return;
      }
      el.innerHTML = renderMovieCard(m);
    }
  }

  function getScreenSchedules(m) {
    if (m.screenSchedules && m.screenSchedules.length > 0) return m.screenSchedules;
    return m.screens.map(sc => ({
      screen: sc,
      slots: m.schedules.map(function (s) { return { start: s[0], end: s[1], status: 'ok' }; })
    }));
  }

  function renderMovieCard(m) {
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
          <div class="slots-grid">${slotsHtml}</div>
        </div>`;
    }).join('');

    const noteText = m.note || '—';

    return `
      <div class="movie-card">
        <div class="movie-card-header">
          <div class="movie-card-title-wrap">
            <a href="detail.html?id=${m.id}" class="movie-card-title">【 ${m.title} 】</a>
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
