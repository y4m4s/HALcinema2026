document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('contact-form');
  const formSection = document.getElementById('form-section');
  const sentSection = document.getElementById('sent-section');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formSection.style.display = 'none';
    sentSection.style.display = 'block';
  });
});
