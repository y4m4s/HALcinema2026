/* eslint-disable */
// @ts-nocheck
import { MOVIES, SCREENS, DATES, TODAY_DATE, formatDateLabel, getMovieScreenSchedules, getMovieStatus, isMoviePlayingOn } from './data'
import { datePagerHtml, setupDatePager } from './date-pager'

export function runSchedule() {
const nowShowing = MOVIES.filter(m => getMovieStatus(m) === 'now');
  let disposed = false;
  let fadeTimer = 0;
  let viewMode = 'date';
  let dateIdx = 0;
  let movieIdx = 0;
  let movieDateIdx = 0;
  // 遷移直後の位置合わせを止めるための後片付け関数 (作品指定で開いたときだけ設定される)
  let stopFollowingOnLeave = null;
  // 上映回ごとの予約状況をDBから取得し `作品ID-スクリーン-開始時刻` で引けるようにする。
  // 取得できた回はモックの status を上書きし、失敗時はモック値のまま表示する。
  const availabilityByKey = new Map();
  // 画面離脱時に取得中のリクエストを打ち切る
  const availabilityAbort = new AbortController();

  // 同じ時刻でも日付が違えば別の上映回なので、日付までキーに含める。
  function slotKey(movieId, screen, date, start) {
    return `${movieId}-${screen}-${date}-${start}`;
  }

  function resolveSlotStatus(movie, screen, date, slot) {
    const live = availabilityByKey.get(slotKey(movie.id, screen, date, slot.start));
    return live || slot.status || 'ok';
  }

  function isPlayingDate(movie, date) {
    return isMoviePlayingOn(movie, date);
  }

  function firstPlayingDateIdx(movie) {
    const idx = DATES.findIndex(date => isPlayingDate(movie, date));
    return idx < 0 ? 0 : idx;
  }

  async function loadAvailability() {
    try {
      const res = await fetch('/api/schedules/availability', { signal: availabilityAbort.signal });
      if (!res.ok) return;
      const data = await res.json();
      if (disposed) return;
      if (!Array.isArray(data)) return;
      availabilityByKey.clear();
      data.forEach(function (item) {
        availabilityByKey.set(slotKey(item.movieId, item.screen, item.date, item.start), item.status);
      });
      renderRows();
    } catch (e) {
      /* オフライン等ではモック表示にフォールバック */
    }
  }
  const viewTabs = document.getElementById('view-tabs');
  function onViewTabsClick(e) {
    const btn = e.target.closest('.view-tab');
    if (!btn) return;
    viewMode = btn.dataset.mode;
    document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSubTabs();
    renderHeading();
    fadeRows(renderRows);
  }
  viewTabs.addEventListener('click', onViewTabsClick);

  function render() {
    renderSubTabs();
    renderHeading();
    renderRows();
  }

  function fadeRows(callback) {
    const el = document.getElementById('schedule-rows');
    el.classList.add('rows-hidden');
    if (fadeTimer) window.clearTimeout(fadeTimer);
    fadeTimer = window.setTimeout(function () {
      fadeTimer = 0;
      if (disposed) return;
      callback();
      el.classList.remove('rows-hidden');
    }, 110);
  }

  // 当日のタブに付ける TODAY バッジ (作品詳細ページと同じ)
  function todayBadge(d) {
    return d === TODAY_DATE ? '<span class="today-badge">TODAY</span>' : '';
  }

  function renderSubTabs() {
    const root = document.getElementById('sub-tabs');
    if (viewMode === 'date') {
      root.innerHTML = datePagerHtml('<div class="sub-tabs">' +
        DATES.map((d, i) =>
          `<button class="sub-tab${i === dateIdx ? ' active' : ''}" data-idx="${i}">${formatDateLabel(d)}${todayBadge(d)}</button>`
        ).join('') + '</div>');
      setupDatePager(root.querySelector('[data-date-pager]'));
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
              ${/*
              <div class="movie-tab-body">
                <div class="movie-tab-title">${m.title}</div>
                <div class="movie-tab-meta">${m.rating} · ${m.duration}分</div>
              </div>
              */''}
            </div>`;
        }).join('') + '</div>';
      root.querySelector('.movie-tabs').addEventListener('click', function (e) {
        const card = e.target.closest('.movie-tab-card');
        if (!card) return;
        movieIdx = parseInt(card.dataset.idx);
        movieDateIdx = firstPlayingDateIdx(nowShowing[movieIdx]);
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
      el.innerHTML = `<div class="schedule-heading">${formatDateLabel(DATES[dateIdx])} の上映スケジュール</div>`;
    } else {
      const m = nowShowing[movieIdx];
      // 初期表示などで非上映日が選ばれている場合は最初の上映日に寄せる
      if (!isPlayingDate(m, DATES[movieDateIdx])) movieDateIdx = firstPlayingDateIdx(m);
      el.innerHTML = `
        <div class="schedule-heading">${m.title} の上映スケジュール</div>
        ${datePagerHtml(`<div class="sub-tabs movie-date-tabs" id="movie-date-tabs">
          ${DATES.map((d, i) => {
            const playing = isPlayingDate(m, d);
            return `<button class="sub-tab${i === movieDateIdx ? ' active' : ''}${!playing ? ' no-play' : ''}" data-idx="${i}"${!playing ? ' disabled' : ''}>${formatDateLabel(d)}${todayBadge(d)}</button>`;
          }).join('')}
        </div>`, 'movie-date-pager')}`;
      setupDatePager(el.querySelector('[data-date-pager]'));
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
      // 非上映日の作品を出すと、存在しない上映回への予約リンクができてしまうため除外する。
      const movies = nowShowing.filter(m => isPlayingDate(m, DATES[dateIdx]));
      if (movies.length === 0) {
        el.innerHTML = emptyHtml('上映中の作品がありません', 'NO MOVIES SCHEDULED');
        return;
      }
      el.innerHTML = movies.map((m, i) => renderMovieCard(m, i, DATES[dateIdx])).join('');
    } else {
      const m = nowShowing[movieIdx];
      const isPlaying = isPlayingDate(m, DATES[movieDateIdx]);
      if (!isPlaying) {
        el.innerHTML = emptyHtml('この日は上映がありません', 'NO SCREENINGS ON THIS DATE');
        return;
      }
      el.innerHTML = renderMovieCard(m, 0, DATES[movieDateIdx]);
    }
  }

  function getScreenSchedules(m) {
    return getMovieScreenSchedules(m);
  }

  function renderMovieCard(m, idx, date) {
    const delay = (idx * 0.07).toFixed(2);
    const imgInner = m.image
      ? `<img src="${m.image}" alt="${m.title}">`
      : '<div class="movie-thumb-placeholder">NO IMAGE</div>';
    const imgHtml = `<a href="detail.html?id=${m.id}" class="movie-thumb-link">${imgInner}</a>`;

    const theatersHtml = getScreenSchedules(m).map(function (sc) {
      const slotsHtml = sc.slots.map(function (slot) {
        const status = resolveSlotStatus(m, sc.screen, date, slot);
        const statusClass = status === 'soldout' ? 'soldout' : status === 'few' ? 'few' : 'ok';
        const statusText  = status === 'soldout' ? '販売終了' : status === 'few' ? '△残りわずか' : '◎余裕あり';
        const slotInner = `
            <div class="time-slot-time">${slot.start} 〜 ${slot.end}</div>
            <div class="time-slot-status ${statusClass}">${statusText}</div>`;
        if (statusClass === 'soldout') {
          return `<div class="time-slot soldout">${slotInner}</div>`;
        }
        return `<a class="time-slot" href="${buildBookingHref(m, sc.screen, slot, date)}">${slotInner}</a>`;
      }).join('');
      const screenInfo = SCREENS.find(s => s.num === sc.screen);
      const featureBadges = screenInfo
        ? screenInfo.features.slice(0, 3).map(f => `<span class="feature-badge">${f}</span>`).join('')
        : '';
      return `
        <div class="theater-col">
          <div class="theater-col-header">
            <div class="theater-col-left">
              <span class="theater-col-num">スクリーン ${sc.screen}</span>
              ${screenInfo ? `<span class="theater-col-meta">${screenInfo.type} · ${screenInfo.seats}席</span>` : ''}
            </div>
            ${featureBadges ? `<div class="theater-col-features">${featureBadges}</div>` : ''}
          </div>
          <div class="slots-grid${sc.slots.length === 4 ? ' slots-grid--quad' : ''}">${slotsHtml}</div>
        </div>`;
    }).join('');

    const noteText = m.note || '—';

    // レーティングとジャンルは 760px 以下のカードだけで表示する (CSS 側で出し分け)
    const ratingHtml = m.rating ? `<span class="movie-card-rating">${m.rating}</span>` : '';
    const genres = Array.isArray(m.genre) ? m.genre : [];
    const genresHtml = genres.length
      ? `<div class="movie-card-genres">${genres.map(g => `<span>${g}</span>`).join('')}</div>`
      : '';

    return `
      <div class="movie-card" style="--card-delay: ${delay}s">
        <div class="movie-card-header">
          <div class="movie-card-title-wrap">
            <a href="detail.html?id=${m.id}" class="movie-card-title">${m.title}</a>
            <div class="movie-card-meta">
              ${ratingHtml}
              <span class="movie-card-duration">本編 ${m.duration}分</span>
            </div>
            ${genresHtml}
          </div>
          <div class="movie-card-header-right">
            <a href="detail.html?id=${m.id}" class="btn-ghost schedule-detail-btn">詳細</a>
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

  function buildBookingHref(movie, screen, slot, date) {
    const params = new URLSearchParams({
      movie: String(movie.id),
      date: date,
      screen: String(screen),
      start: slot.start,
      end: slot.end,
    });
    return `/booking?${params.toString()}`;
  }

  // 上映作品一覧の「予約する」から ?view=movie&movie=<作品ID> で開かれたときは、
  // 上映作品毎タブで該当作品を選んだ状態から始める。
  const query = new URLSearchParams(location.search);
  const requestedIdx = nowShowing.findIndex(m => String(m.id) === query.get('movie'));
  if (query.get('view') === 'movie' || requestedIdx >= 0) {
    viewMode = 'movie';
    if (requestedIdx >= 0) {
      movieIdx = requestedIdx;
      movieDateIdx = firstPlayingDateIdx(nowShowing[movieIdx]);
    }
    // 上映日程毎に付いている初期の active を移す
    document.querySelectorAll('.view-tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === 'movie');
    });
  }

  render();

  if (viewMode === 'movie' && requestedIdx >= 0) {
    // 作品カードは横スクロールなので、選んだ作品が画面外だと分かりにくい。中央寄りに出す。
    const tabs = document.querySelector('.movie-tabs');
    const card = tabs && tabs.querySelector('.movie-tab-card.active');
    if (card) tabs.scrollLeft = card.offsetLeft - (tabs.clientWidth - card.offsetWidth) / 2;

    // 「(作品名) の上映スケジュール」を固定ヘッダーの下に出す。
    // 表示演出 (.page-enter) の translateY が残っていると位置がずれるため、演出は行わない。
    const enter = document.querySelector('.page-enter');
    if (enter) enter.classList.remove('page-enter');

    // ヘッダーの高さは CSS 変数ではなく実際の描画結果から取る。
    // ページ用CSSの適用前だと変数が効かず、見出しがヘッダーに隠れるため。
    function scrollToHeading() {
      const heading = document.getElementById('schedule-heading');
      if (!heading) return;
      const header = document.querySelector('.site-header');
      const offset = (header ? header.getBoundingClientRect().height : 0) + 16;
      const top = heading.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    }
    scrollToHeading();

    // 遷移直後はページ用CSS・Webフォント・画像の反映で本文の高さが変わり、
    // 一度決めた位置がずれる。高さの変化を監視して、落ち着くまで合わせ直す。
    // 利用者が自分で操作したら以後は触らない (スクロール位置の比較では、
    // 高さが縮んだときのブラウザ側の補正と区別できないため操作そのものを見る)。
    let userMoved = false;
    function onUserMove() {
      userMoved = true;
      stopFollowing();
    }
    const userEvents = ['wheel', 'touchstart', 'keydown', 'mousedown'];
    userEvents.forEach(function (type) {
      window.addEventListener(type, onUserMove, { passive: true });
    });

    const heightObserver = new ResizeObserver(function () {
      if (!userMoved) scrollToHeading();
    });
    heightObserver.observe(document.body);
    const followTimer = window.setTimeout(stopFollowing, 1500);

    function stopFollowing() {
      heightObserver.disconnect();
      window.clearTimeout(followTimer);
      userEvents.forEach(function (type) {
        window.removeEventListener(type, onUserMove);
      });
    }
    stopFollowingOnLeave = stopFollowing;
  }

  loadAvailability();

  return function cleanupSchedule() {
    disposed = true;
    if (stopFollowingOnLeave) stopFollowingOnLeave();
    availabilityAbort.abort();
    viewTabs.removeEventListener('click', onViewTabsClick);
    if (fadeTimer) window.clearTimeout(fadeTimer);
  };
}
