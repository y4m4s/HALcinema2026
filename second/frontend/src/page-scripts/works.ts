/* eslint-disable */
// @ts-nocheck
import { MOVIES } from './data'

export function runWorks() {
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncateText(text, maxLength) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  const chars = Array.from(normalized);
  if (chars.length <= maxLength) return normalized;
  return chars.slice(0, maxLength).join("").trimEnd() + "……";
}

function getSortedMovies() {
  if (typeof MOVIES === "undefined" || !Array.isArray(MOVIES)) return [];

  return MOVIES.slice().sort((a, b) => {
    const statusOrder = { now: 0, coming: 1 };
    const aStatus = statusOrder[a.status] ?? 2;
    const bStatus = statusOrder[b.status] ?? 2;
    return aStatus - bStatus || a.id - b.id;
  });
}

function getStatusLabel(status) {
  return status === "now" ? "上映中" : "近日公開";
}

function renderFilters(movies, activeFilter) {
  const filters = document.getElementById("works-filters");
  if (!filters) return;

  const counts = getMovieCounts(movies);
  filters.querySelectorAll(".works-filter").forEach((button) => {
    const id = button.dataset.filter || "all";
    button.classList.toggle("active", activeFilter === id);
  });

  Object.keys(counts).forEach((key) => {
    const el = filters.querySelector(`[data-filter-count="${key}"]`);
    if (el) el.textContent = counts[key];
  });
}

function getMovieCounts(movies) {
  return {
    all: movies.length,
    now: movies.filter((movie) => movie.status === "now").length,
    coming: movies.filter((movie) => movie.status === "coming").length
  };
}

function renderMovieCard(movie) {
  const title = escapeHtml(movie.title || "");
  const director = escapeHtml(movie.director || "未定");
  const statusLabel = escapeHtml(getStatusLabel(movie.status));
  const statusClass = movie.status === "now" ? "now" : "coming";
  const rating = escapeHtml(movie.rating || "");
  const duration = movie.duration ? `${movie.duration}分` : "上映時間未定";
  const releaseDate = escapeHtml(movie.releaseDate || "");
  const synopsis = escapeHtml(truncateText(movie.synopsis, 84));
  const poster = movie.image
    ? `<img src="${escapeHtml(movie.image)}" alt="${title}のポスター" class="work-card-poster">`
    : `<div class="work-card-poster-placeholder">NO IMAGE</div>`;
  const genres = Array.isArray(movie.genre) ? movie.genre : [];

  return `
    <a href="detail.html?id=${movie.id}" class="work-card">
      <div class="work-card-media">
        ${poster}
        <span class="work-card-status ${statusClass}">${statusLabel}</span>
      </div>
      <div class="work-card-body">
        <div class="work-card-meta">
          ${rating ? `<span>${rating}</span>` : ""}
          <span>${duration}</span>
          ${releaseDate ? `<span>${releaseDate}</span>` : ""}
        </div>
        <h2 class="work-card-title">${title}</h2>
        <div class="work-card-genres">
          ${genres.map((genre) => `<span>${escapeHtml(genre)}</span>`).join("")}
        </div>
        <p class="work-card-synopsis">${synopsis}</p>
        <div class="work-card-staff">
          <div>
            <span>DIRECTOR</span>
            <strong>${director}</strong>
          </div>
        </div>
      </div>
    </a>
  `;
}

function renderMovies(movies, filter) {
  const movieList = document.getElementById("movieList");
  if (!movieList) return;

  const visibleMovies = filter === "all"
    ? movies
    : movies.filter((movie) => movie.status === filter);

  movieList.innerHTML = visibleMovies.map(renderMovieCard).join("");
}

  const movies = getSortedMovies();
  let activeFilter = "all";

  renderFilters(movies, activeFilter);
  renderMovies(movies, activeFilter);

  const filters = document.getElementById("works-filters");
  if (!filters) return;

  filters.addEventListener("click", function (event) {
    const button = event.target.closest(".works-filter");
    if (!button) return;
    activeFilter = button.dataset.filter || "all";
    renderFilters(movies, activeFilter);
    renderMovies(movies, activeFilter);
  });
}
