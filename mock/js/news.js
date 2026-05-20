document.addEventListener('DOMContentLoaded', function () {
  const newsItems = Array.isArray(NEWS) ? NEWS : [];
  const list = document.getElementById('news-list');
  if (!list || !newsItems.length) return;

  const params = new URLSearchParams(location.search);
  const requestedId = Number(params.get('id'));
  const initialNews = newsItems.find(news => news.id === requestedId) || newsItems[0];

  list.innerHTML = newsItems.map(news => `
    <a href="news.html?id=${news.id}" class="news-item" data-news-id="${news.id}">
      <div class="news-meta">
        <span class="news-detail-date">${escapeHtml(news.date)}</span>
        <span class="news-tag" data-tag="${escapeHtml(news.tag)}">${escapeHtml(news.tag)}</span>
      </div>
      <span class="news-title">${escapeHtml(news.title)}</span>
    </a>
  `).join('');

  renderNewsDetail(initialNews, false);

  list.addEventListener('click', function (event) {
    const link = event.target.closest('.news-item');
    if (!link) return;

    const news = newsItems.find(item => item.id === Number(link.dataset.newsId));
    if (!news) return;

    event.preventDefault();
    renderNewsDetail(news, true);
  });
});

function renderNewsDetail(news, updateUrl) {
  setText('news-detail-title', news.title);
  setText('news-detail-date', news.date);

  const tag = document.getElementById('news-detail-tag');
  if (tag) {
    tag.textContent = news.tag;
    tag.dataset.tag = news.tag;
  }

  const body = document.getElementById('news-detail-body');
  if (body) {
    const paragraphs = Array.isArray(news.body) && news.body.length
      ? news.body
      : [`${news.title}の詳細情報です。`];
    body.innerHTML = paragraphs.map(text => `<p>${escapeHtml(text)}</p>`).join('');
  }

  document.querySelectorAll('.news-item').forEach(item => {
    item.classList.toggle('active', Number(item.dataset.newsId) === news.id);
  });

  document.title = `${news.title} | HAL シネマ`;
  if (updateUrl) {
    history.pushState(null, '', `news.html?id=${news.id}`);
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
