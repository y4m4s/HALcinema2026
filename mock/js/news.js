document.addEventListener('DOMContentLoaded', function () {
  const extraNews = [
    {
      id: 6,
      date: '2025.03.15',
      tag: '新作情報',
      title: '「呪縛の家」2025年6月公開決定',
      body: [
        '「呪縛の家」の公開が2025年6月に決定しました。',
        '予告映像や上映スケジュールは、決まり次第お知らせします。'
      ]
    },
    {
      id: 7,
      date: '2025.03.01',
      tag: '新作情報',
      title: '「深淵より」2025年7月公開決定',
      body: [
        '深海を舞台にした新感覚ホラー「深淵より」が2025年7月に公開予定です。',
        '詳細な上映情報は後日公開します。'
      ]
    },
    {
      id: 8,
      date: '2025.02.20',
      tag: 'イベント',
      title: '「カラダ探し」特集上映を開催',
      body: [
        '「カラダ探し」の特集上映を開催します。',
        '監督トークショー付きのスペシャル上映です。'
      ]
    },
    {
      id: 9,
      date: '2025.02.01',
      tag: 'お知らせ',
      title: '公式スマートフォンアプリをリリース',
      body: [
        '公式スマートフォンアプリのリリースにより、オンライン予約機能がより便利になりました。',
        'チケット購入や上映情報の確認にご利用ください。'
      ]
    }
  ];

  const allNews = [
    ...NEWS,
    ...extraNews
  ].map(news => ({
    ...news,
    body: Array.isArray(news.body) ? news.body : [
      `${news.title}の詳細情報です。`
    ]
  }));

  const newsList = document.getElementById('news-list');
  if (!newsList) return;

  newsList.innerHTML = allNews.map(news => `
    <div class="news-item" data-news-id="${news.id}">
      <div class="news-meta">
        <span class="news-detail-date">${news.date}</span>
        <span class="news-tag" data-tag="${news.tag}">${news.tag}</span>
      </div>
      <span class="news-title">${news.title}</span>
    </div>
  `).join('');

  function renderNewsDetail(news) {
    const titleEl = document.querySelector('.news-detail-title');
    const dateEl = document.querySelector('.news-dated');
    const tagEl = document.querySelector('.news-detail-tag');
    const bodyEl = document.querySelector('.news-detail-body');

    if (!titleEl || !dateEl || !bodyEl) return;

    titleEl.textContent = news.title;
    dateEl.textContent = news.date;
    bodyEl.innerHTML = news.body.map(text => `<p>${text}</p>`).join('');

    if (tagEl) {
      tagEl.textContent = news.tag;
      tagEl.dataset.tag = news.tag;
    }
  }
  function renderNewsDetail(news) {
  const titleEl = document.querySelector('.news-detail-title');
  const dateEl = document.querySelector('.news-dated');
  const tagEl = document.querySelector('.news-detail-tag');
  const bodyEl = document.querySelector('.news-detail-body');

  if (!titleEl || !dateEl || !bodyEl) return;

  titleEl.textContent = news.title;
  dateEl.textContent = news.date;
  bodyEl.innerHTML = news.body.map(text => `<p>${text}</p>`).join('');

  if (tagEl) {
    tagEl.textContent = news.tag;
    tagEl.dataset.tag = news.tag;
  }
}

  document.querySelectorAll('.news-item').forEach(item => {
    item.addEventListener('click', () => {
      const newsId = Number(item.dataset.newsId);
      const selectedNews = allNews.find(news => news.id === newsId);

      if (selectedNews) {
        renderNewsDetail(selectedNews);
      }
    
    
    });
  });
  document.querySelectorAll('.news-item').forEach(item => {
  item.addEventListener('click', () => {
    const newsId = Number(item.dataset.newsId);
    const selectedNews = allNews.find(news => news.id === newsId);

    if (selectedNews) {
      renderNewsDetail(selectedNews);
    }
  });
});
});