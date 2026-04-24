document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('screen-grid').innerHTML = SCREENS.map(s => `
    <div class="screen-card">
      <div class="screen-num">SCREEN — ${String(s.num).padStart(2, '0')}</div>
      <div class="screen-type">${s.type}</div>
      <div class="screen-seats">${s.seats}<span>席</span></div>
      <div class="screen-features">
        ${s.features.map(f => `<div class="screen-feature">${f}</div>`).join('')}
      </div>
    </div>
  `).join('');
});
