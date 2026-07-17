/* eslint-disable */
// @ts-nocheck
export function runCompleted() {
  const previousScrollRestoration = 'scrollRestoration' in history ? history.scrollRestoration : null;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

window.scrollTo(0, 0);

  window.scrollTo(0, 0);

  const wrap = document.querySelector('.complete-wrap');
  const countEl = document.getElementById('count');
  if (!wrap || !countEl) {
    return function cleanupCompletedWithoutView() {
      if (previousScrollRestoration) history.scrollRestoration = previousScrollRestoration;
    };
  }

  // フェードイン
  let innerFrame = 0;
  const outerFrame = requestAnimationFrame(function () {
    innerFrame = requestAnimationFrame(function () {
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

  return function cleanupCompleted() {
    cancelAnimationFrame(outerFrame);
    if (innerFrame) cancelAnimationFrame(innerFrame);
    window.clearInterval(interval);
    if (previousScrollRestoration) history.scrollRestoration = previousScrollRestoration;
  };
}
