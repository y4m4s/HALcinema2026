/* ===========================================================
   上映中一覧化ページ（work.html）用スクリプト
   - data.js の MOVIES から status === "now" の作品のみを抽出
   - 各作品カードを動的に生成して #movieList に追加
   =========================================================== */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMovieList() {
  if (typeof MOVIES === "undefined" || !Array.isArray(MOVIES)) return [];

  return MOVIES
    .filter((m) => m.status === "now")
    .map((m) => {
      const castText = Array.isArray(m.cast) ? m.cast.join("、") : (m.cast || "");
      const noteParts = [];
      if (m.duration) noteParts.push("上映時間 " + m.duration + "分");
      if (m.releaseDate) noteParts.push("上映期間 " + m.releaseDate + "〜");

      return {
        id: m.id,
        title: m.title || "",
        director: m.director || "",
        cast: castText,
        rating: m.rating || "",
        note: noteParts.join(" / "),
        imageUrl: m.image || ""
      };
    });
}

function renderMovies() {
  const movieList = document.getElementById("movieList");
  if (!movieList) return;

  const movies = buildMovieList();

  movies.forEach((movie) => {
    const card = document.createElement("article");
    card.className = "movie-card";

    const title = escapeHtml(movie.title);
    const director = escapeHtml(movie.director);
    const cast = escapeHtml(movie.cast);
    const rating = escapeHtml(movie.rating);
    const note = escapeHtml(movie.note);
    const imageUrl = movie.imageUrl ? escapeHtml(movie.imageUrl) : "";

    card.innerHTML = `
      <div class="movie-card__image">
        ${
          imageUrl
            ? `<img src="${imageUrl}" alt="${title}のポスター">`
            : `<div class="movie-card__placeholder">No Image</div>`
        }
      </div>

      <div class="movie-card__content">
        <h2 class="movie-card__title">【 ${title} 】</h2>
        <p class="movie-card__field"><span class="movie-card__label">監督</span><span class="movie-card__value">${director}</span></p>
        <p class="movie-card__field movie-card__field--cast"><span class="movie-card__label">キャスト</span><span class="movie-card__value">${cast}</span></p>
        <p class="movie-card__field"><span class="movie-card__label">レイティング</span><span class="movie-card__value">${rating}</span></p>
        <p class="movie-card__field movie-card__field--note">
          <span class="movie-card__label">備考</span>
          <span class="movie-card__value">${note}</span>
          <a class="movie-card__detail-btn" href="#">詳細</a>
        </p>
      </div>
    `;

    movieList.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", renderMovies);
