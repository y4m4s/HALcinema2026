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
      if (m.rating) noteParts.push(m.rating);
      if (m.duration) noteParts.push("上映時間 " + m.duration + "分");
      if (m.releaseDate) noteParts.push("公開 " + m.releaseDate);

      return {
        id: m.id,
        title: m.title || "",
        type: "本編",
        director: m.director || "",
        cast: castText,
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
    const type = escapeHtml(movie.type);
    const director = escapeHtml(movie.director);
    const cast = escapeHtml(movie.cast);
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
        <h2 class="movie-card__title">【 ${title} 】（${type}）</h2>
        <p class="movie-card__director">${director}</p>
        <p class="movie-card__cast">${cast}</p>
        <p class="movie-card__note">${note}</p>
      </div>
    `;

    movieList.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", renderMovies);
