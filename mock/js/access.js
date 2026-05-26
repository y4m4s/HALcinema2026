document.addEventListener('DOMContentLoaded', function () {
  const grid = document.querySelector('.access-grid');
  if (!grid) return;

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      grid.classList.add('visible');
    });
  });
});
