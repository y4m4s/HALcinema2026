/* eslint-disable */
// @ts-nocheck
export function runAccess() {
const grid = document.querySelector('.access-grid');
  if (!grid) return;

  let innerFrame = 0;
  const outerFrame = requestAnimationFrame(function () {
    innerFrame = requestAnimationFrame(function () {
      grid.classList.add('visible');
    });
  });

  return function cleanupAccess() {
    cancelAnimationFrame(outerFrame);
    if (innerFrame) cancelAnimationFrame(innerFrame);
  };
}
