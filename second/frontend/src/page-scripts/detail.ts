/* eslint-disable */
// @ts-nocheck
import { MOVIES, SCREENS, DATES } from './data'
import { badge } from './common'

export function runDetail() {
const id = parseInt(new URLSearchParams(location.search).get('id'), 10);
  const movie = MOVIES.find(m => m.id === id);
  if (!movie) {
    location.href = 'index.html';
    return;
  }

  const isNow = movie.status === 'now';
  document.title = movie.title + ' | HAL シネマ';

  renderDetail(movie, isNow);
  bindDateTabs(movie);

function renderDetail(movie, isNow) {
  setText('detail-breadcrumb-current', movie.title);
  setText('detail-status', isNow ? 'NOW SHOWING' : 'COMING SOON');
  setText('detail-title', movie.title);
  setText('detail-title-en', movie.titleEn || '');
  setText('detail-synopsis', movie.synopsis || 'あらすじは準備中です。');

  setHidden('detail-title-en', !movie.titleEn);

  renderPoster(movie);
  renderMeta(movie);
  renderStaffAndCast(movie);
  renderFilmInfo(movie);
  renderBooking(movie, isNow);
}

function renderPoster(movie) {
  const poster = document.getElementById('detail-poster');
  if (!poster) return;

  poster.replaceChildren();

  if (!movie.image) {
    const placeholder = document.createElement('div');
    placeholder.className = 'detail-hero-poster-ph';
    poster.appendChild(placeholder);
    return;
  }

  const img = document.createElement('img');
  img.src = movie.image;
  img.alt = movie.title;
  img.className = 'detail-hero-poster';
  poster.appendChild(img);
}

function renderMeta(movie) {
  const meta = document.getElementById('detail-meta');
  if (!meta) return;

  const values = [
    [movie.rating, true],
    [movie.releaseDate],
    [movie.duration ? `${movie.duration}分` : '上映時間未定'],
    ...(movie.genre || []).map(g => [g]),
  ].filter(([value]) => value);

  meta.innerHTML = values.map(([value, isRating]) => badge(value, isRating)).join('');
}

function renderStaffAndCast(movie) {
  const castList = document.getElementById('detail-cast-list');
  if (!castList) return;

  castList.replaceChildren();
  castList.appendChild(createLeadCredit('DIRECTOR', '監督', movie.director || '未定'));

  const cast = movie.cast && movie.cast.length ? movie.cast : ['未定'];
  const castLabel = document.createElement('div');
  castLabel.className = 'detail-cast-group-label';
  castLabel.textContent = 'CAST';
  castList.appendChild(castLabel);

  const castGrid = document.createElement('div');
  castGrid.className = 'detail-cast-grid';

  cast.forEach(name => {
    const item = document.createElement('div');
    item.className = 'detail-cast-person';

    const nameEl = document.createElement('span');
    nameEl.className = 'detail-cast-name';
    nameEl.textContent = name;

    item.appendChild(nameEl);
    castGrid.appendChild(item);
  });

  castList.appendChild(castGrid);
}

function renderFilmInfo(movie) {
  const filmInfo = document.getElementById('detail-film-info');
  if (!filmInfo) return;

  const rows = [
    ['タイトル', movie.titleEn || movie.title],
    ['上映時間', movie.duration ? `${movie.duration}分` : '未定'],
    ['レーティング', movie.rating || '未定'],
    ['公開日', movie.releaseDate || '未定'],
    ['ジャンル', movie.genre && movie.genre.length ? movie.genre.join('・') : '未定'],
  ];

  filmInfo.replaceChildren();
  filmInfo.className = 'detail-film-info-list';
  rows.forEach(([label, value]) => {
    filmInfo.appendChild(createInfoRow(label, value, 'film-info-row', 'film-info-label', 'film-info-value'));
  });
}

function renderBooking(movie, isNow) {
  const comingNotice = document.getElementById('detail-coming-notice');
  const comingDate = document.getElementById('detail-coming-date');
  const nowBooking = document.getElementById('detail-now-booking');
  const dateTabs = document.getElementById('detail-date-tabs');
  const theatersGrid = document.getElementById('detail-theaters-grid');
  const note = document.getElementById('detail-movie-note');
  const noteText = document.getElementById('detail-movie-note-text');

  if (comingNotice) comingNotice.hidden = isNow;
  if (nowBooking) nowBooking.hidden = !isNow;

  if (!isNow) {
    if (comingDate) comingDate.textContent = `${movie.releaseDate || '公開日未定'} 公開予定`;
    return;
  }

  if (dateTabs) dateTabs.innerHTML = buildDateTabs(movie);
  if (theatersGrid) theatersGrid.innerHTML = buildTheaterCols(movie);
  if (note && noteText) {
    note.hidden = !movie.note;
    noteText.textContent = movie.note || '';
  }
}

function buildDateTabs(movie) {
  const dayMap = { '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6 };
  const defaultDate = getDefaultBookingDate(movie);

  const todayLabel = '5/15(金)';
  const dateTabs = DATES.map(d => {
    const m = d.match(/\((.)\)/);
    const isPlaying = m && movie.playingDays && movie.playingDays.includes(dayMap[m[1]]);
    const todayBadge = d === todayLabel ? '<span class="today-badge">TODAY</span>' : '';
    return `<button class="sub-tab${d === defaultDate ? ' active' : ''}${!isPlaying ? ' no-play' : ''}" data-date="${escapeHtml(d)}">${escapeHtml(d)}${todayBadge}</button>`;
  }).join('');

  return dateTabs;
}

function bindDateTabs(movie) {
  const dateTabs = document.getElementById('detail-date-tabs');
  if (!dateTabs) return;

  dateTabs.addEventListener('click', function (e) {
    const btn = e.target.closest('.sub-tab');
    if (!btn || btn.classList.contains('no-play')) return;
    dateTabs.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    refreshBookingLinks(movie, btn.dataset.date);
  });
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
      const statusText = isSoldout ? '販売終了' : slot.status === 'few' ? '△残りわずか' : '◎余裕あり';
      const date = getDefaultBookingDate(movie);
      const slotInner = `
          <div class="time-slot-time">${escapeHtml(slot.start)} 〜 ${escapeHtml(slot.end)}</div>
          <div class="time-slot-status ${statusClass}">${statusText}</div>`;
      if (isSoldout) {
        return `<div class="time-slot soldout">${slotInner}</div>`;
      }
      return `
        <a class="time-slot" href="${escapeHtml(buildBookingHref(movie, sc.screen, slot, date))}" data-booking-link data-screen="${escapeHtml(sc.screen)}" data-start="${escapeHtml(slot.start)}" data-end="${escapeHtml(slot.end)}">
          ${slotInner}
        </a>`;
    }).join('');
    const featureBadges = screen
      ? screen.features.slice(0, 3).map(f => `<span class="feature-badge">${escapeHtml(f)}</span>`).join('')
      : '';
    return `
      <div class="theater-col">
        <div class="theater-col-header">
          <div class="theater-col-left">
            <span class="theater-col-num">スクリーン ${escapeHtml(sc.screen)}</span>
            ${screen ? `<span class="theater-col-meta">${escapeHtml(screen.type)} · ${escapeHtml(screen.seats)}席</span>` : ''}
          </div>
          ${featureBadges ? `<div class="theater-col-features">${featureBadges}</div>` : ''}
        </div>
        <div class="slots-grid${sc.slots.length === 4 ? ' slots-grid--quad' : ''}">${slotsHtml}</div>
      </div>`;
  }).join('');
}

function getDefaultBookingDate(movie) {
  const dayMap = { '日': 0, '月': 1, '火': 2, '水': 3, '木': 4, '金': 5, '土': 6 };
  const todayLabel = '5/15(金)';
  const todayIsPlaying = movie.playingDays && DATES.find(d => {
    const m = d.match(/\((.)\)/);
    return d === todayLabel && m && movie.playingDays.includes(dayMap[m[1]]);
  });

  if (todayIsPlaying) return todayLabel;

  return DATES.find(d => {
    const m = d.match(/\((.)\)/);
    return !movie.playingDays || (m && movie.playingDays.includes(dayMap[m[1]]));
  }) || DATES[0];
}

function refreshBookingLinks(movie, date) {
  document.querySelectorAll('[data-booking-link]').forEach(link => {
    const slot = { start: link.dataset.start, end: link.dataset.end };
    link.setAttribute('href', buildBookingHref(movie, link.dataset.screen, slot, date || getDefaultBookingDate(movie)));
  });
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

function createInfoRow(label, value, rowClass, labelClass, valueClass) {
  const row = document.createElement('div');
  row.className = rowClass;

  const labelEl = document.createElement('span');
  labelEl.className = labelClass;
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = valueClass;
  valueEl.textContent = value;

  row.append(labelEl, valueEl);
  return row;
}

function createLeadCredit(label, role, name) {
  const block = document.createElement('div');
  block.className = 'detail-credit-lead';

  const labelEl = document.createElement('span');
  labelEl.className = 'detail-credit-label';
  labelEl.textContent = label;

  const roleEl = document.createElement('span');
  roleEl.className = 'detail-credit-role';
  roleEl.textContent = role;

  const nameEl = document.createElement('strong');
  nameEl.className = 'detail-credit-name';
  nameEl.textContent = name;

  block.append(labelEl, roleEl, nameEl);
  return block;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setHidden(id, hidden) {
  const el = document.getElementById(id);
  if (el) el.hidden = hidden;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
}
