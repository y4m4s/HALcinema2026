/* eslint-disable */
// @ts-nocheck
export function runAccess() {
const grid = document.querySelector('.access-grid');
  if (!grid) return;

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      grid.classList.add('visible');
    });
  });
}
