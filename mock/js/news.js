document.addEventListener('DOMContentLoaded', function () {
  const allNews = [
    ...NEWS,
    { id:6, date:'2025.03.15', tag:'新作情報', title:'「呪縛の家」2025年6月公開決定。予告映像も近日解禁予定' },
    { id:7, date:'2025.03.01', tag:'新作情報', title:'「深淵より」2025年7月公開決定。深海を舞台にした新感覚ホラー' },
    { id:8, date:'2025.02.20', tag:'イベント', title:'「カラダ探し」特集上映 — 監督トークショー付きスペシャル上映' },
    { id:9, date:'2025.02.01', tag:'お知らせ', title:'公式スマートフォンアプリのリリースに伴い、オンライン予約機能が大幅強化' },
  ];
  document.getElementById('news-list').innerHTML = allNews.map(n => `
    <div class="news-item">
      <span class="news-date">${n.date}</span>
      <span class="news-tag">${n.tag}</span>
      <span class="news-title">${n.title}</span>
    </div>
  `).join('');
});
