document.addEventListener('DOMContentLoaded', function () {
  const nowShowing = MOVIES.filter(m => m.status === 'now');
  let dateIdx = 0;
  let query = '';

  // Date tabs
  document.getElementById('date-tabs').innerHTML = DATES.map((d, i) =>
    `<button class="schedule-tab${i === 0 ? ' active' : ''}" data-idx="${i}">${d}</button>`
  ).join('');

  document.getElementById('date-tabs').addEventListener('click', function (e) {
    const btn = e.target.closest('.schedule-tab');
    if (!btn) return;
    dateIdx = parseInt(btn.dataset.idx);
    document.querySelectorAll('.schedule-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderRows();
  });

  // Search
  document.getElementById('schedule-search').addEventListener('input', function (e) {
    query = e.target.value;
    renderRows();
  });

  function renderRows() {
    const filtered = nowShowing.filter(m =>
      query === '' || m.title.includes(query) || m.genre.some(g => g.includes(query))
    );
    const container = document.getElementById('schedule-rows');
    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text3);font-family:var(--mono);font-size:12px;letter-spacing:.15em">該当する作品が見つかりません</div>`;
      return;
    }
    container.innerHTML = filtered.map(m => `
      <div class="schedule-row">
        <div>
          <div class="schedule-movie-title">${m.title}</div>
          <div class="schedule-movie-meta">
            <span>${m.rating}</span>
            <span>${m.duration}分</span>
            <span>${m.genre.join('・')}</span>
          </div>
        </div>
        <div>
          ${m.screens.map(sc => `
            <div style="margin-bottom:12px">
              <div style="font-family:var(--mono);font-size:9px;letter-spacing:.15em;color:var(--text3);margin-bottom:6px">SCREEN ${sc}</div>
              <div class="schedule-slots">
                ${m.schedules.map(t => `
                  <div class="schedule-slot">${t[0]}<span style="color:var(--text3);font-size:10px;margin-left:6px">〜${t[1]}</span></div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
        <div>
          <a href="detail.html?id=${m.id}" class="btn-ghost" style="font-size:12px;padding:8px 16px;white-space:nowrap">詳細</a>
        </div>
      </div>
    `).join('');
  }

  renderRows();
});
