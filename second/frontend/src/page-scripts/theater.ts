/* eslint-disable */
// @ts-nocheck
export function runTheater() {
// ===== スクリーン詳細モーダル =====
  var modal = document.querySelector('.screen-modal');
  if (!modal) return;

  var card = modal.querySelector('.screen-modal-card');
  var elImg = modal.querySelector('.screen-modal-image img');
  var elNumber = modal.querySelector('#screen-modal-number');
  var elBadges = modal.querySelector('#screen-modal-badges');
  var elName = modal.querySelector('#screen-modal-name');
  var elNameEn = modal.querySelector('#screen-modal-name-en');
  var elContent = modal.querySelector('#screen-modal-content');

  function populate(sourceCard) {
    var img = sourceCard.querySelector('.card-image img');
    if (img) {
      elImg.src = img.getAttribute('src') || '';
      elImg.alt = img.getAttribute('alt') || '';
    }
    var num = sourceCard.querySelector('.card-number');
    elNumber.textContent = num ? num.textContent : '';
    var badges = sourceCard.querySelector('.card-badges');
    elBadges.innerHTML = badges ? badges.innerHTML : '';
    var name = sourceCard.querySelector('.card-name');
    elName.textContent = name ? name.textContent : '';
    var nameEn = sourceCard.querySelector('.card-name-en');
    elNameEn.textContent = nameEn ? nameEn.textContent : '';
    var details = sourceCard.querySelector('.card-details');
    elContent.innerHTML = details ? details.innerHTML : '';
  }

  function positionOnCard(sourceCard) {
    var rect = sourceCard.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var margin = 16;
    var popW = card.offsetWidth || 360;
    var popH = card.offsetHeight || 400;

    var left = rect.left + (rect.width - popW) / 2;
    left = Math.max(margin, Math.min(left, vw - popW - margin));

    var top = rect.top;
    if (top + popH > vh - margin) top = vh - popH - margin;
    if (top < margin) top = margin;

    card.style.left = left + 'px';
    card.style.top = top + 'px';
  }

  function open(sourceCard) {
    populate(sourceCard);
    modal.hidden = false;
    card.scrollTop = 0;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    requestAnimationFrame(function () {
      card.scrollTop = 0;
      positionOnCard(sourceCard);
    });
  }

  function close() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  document.querySelectorAll('.screen-card .card-cta').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var c = btn.closest('.screen-card');
      if (c) open(c);
    });
  });

  modal.querySelectorAll('[data-modal-close]').forEach(function (el) {
    el.addEventListener('click', close);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
}
