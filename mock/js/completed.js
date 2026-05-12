document.addEventListener('DOMContentLoaded', function () {
  const wrap = document.querySelector('.complete-wrap');
  const countEl = document.getElementById('count');
  if (!wrap || !countEl) return;

  // フェードイン
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      wrap.classList.add('visible');
    });
  });

  // 5秒カウントダウン後にトップへリダイレクト
  let count = 5;
  const interval = setInterval(function () {
    count--;
    countEl.textContent = count;
    if (count <= 0) {
      clearInterval(interval);
      window.location.href = 'index.html';
    }
  }, 1000);
});
