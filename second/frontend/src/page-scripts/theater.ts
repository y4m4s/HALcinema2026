/* eslint-disable */
// @ts-nocheck
import { initImageModal } from './image-modal';

export function runTheater() {
// ===== 画像拡大モーダル (スクリーンカードは詳細モーダルを開くため、上映技術は対象外) =====
  var cleanupImageModal = initImageModal('.about-img, .lab-visual');

// ===== スクリーン詳細モーダル (表示位置は CSS で画面中央に固定) =====
  var modal = document.querySelector('.screen-modal');
  if (!modal) return cleanupImageModal;

  var card = modal.querySelector('.screen-modal-card');
  var elImg = modal.querySelector('.screen-modal-image img');
  var elNumber = modal.querySelector('#screen-modal-number');
  var elBadges = modal.querySelector('#screen-modal-badges');
  var elName = modal.querySelector('#screen-modal-name');
  var elNameEn = modal.querySelector('#screen-modal-name-en');
  var elContent = modal.querySelector('#screen-modal-content');
  var activeButton = null;

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

  function open(sourceCard) {
    if (activeButton) activeButton.setAttribute('aria-expanded', 'false');
    activeButton = sourceCard.querySelector('.card-cta');
    if (activeButton) activeButton.setAttribute('aria-expanded', 'true');
    populate(sourceCard);
    modal.hidden = false;
    card.scrollTop = 0;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function close() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (activeButton) activeButton.setAttribute('aria-expanded', 'false');
    activeButton = null;
  }

  var screenCards = Array.from(document.querySelectorAll('.screen-card'));
  function onScreenCardClick(e) {
    e.preventDefault();
    open(e.currentTarget);
  }
  screenCards.forEach(function (screenCard) {
    screenCard.addEventListener('click', onScreenCardClick);
  });

  var closeButtons = Array.from(modal.querySelectorAll('[data-modal-close]'));
  closeButtons.forEach(function (el) {
    el.addEventListener('click', close);
  });

  function onDocumentKeyDown(e) {
    if (e.key === 'Escape' && !modal.hidden) close();
  }
  document.addEventListener('keydown', onDocumentKeyDown);

  return function cleanupTheater() {
    screenCards.forEach(function (screenCard) {
      screenCard.removeEventListener('click', onScreenCardClick);
    });
    closeButtons.forEach(function (el) {
      el.removeEventListener('click', close);
    });
    document.removeEventListener('keydown', onDocumentKeyDown);
    close();
    cleanupImageModal();
  };
}
