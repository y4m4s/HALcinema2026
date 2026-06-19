import type { PageDefinition } from '../types'

export const adminPage: PageDefinition = {
  title: "管理画面 | HAL シネマ",
  bodyClass: "admin-page",
  styles: [
    "/css/fonts.css",
    "/css/style.css",
    "/css/admin.css",
  ],
  html: String.raw`<div class="admin-shell">
    <div class="admin-header">
      <h1 class="admin-title">管理画面</h1>
      <span class="admin-title-en">Admin</span>
    </div>

    <section id="admin-login" class="admin-card admin-login">
      <h2 class="admin-card-title">ログイン</h2>
      <form id="admin-login-form">
        <div class="admin-field">
          <label for="admin-username">ユーザー名<span class="req">*</span></label>
          <input id="admin-username" class="admin-input" name="username" autocomplete="username" required>
        </div>
        <div class="admin-field" style="margin-top:16px;">
          <label for="admin-password">パスワード<span class="req">*</span></label>
          <input id="admin-password" class="admin-input" name="password" type="password" autocomplete="current-password" required>
        </div>
        <div class="admin-actions">
          <button type="submit" class="admin-btn">ログイン</button>
        </div>
        <p id="admin-login-message" class="admin-message"></p>
      </form>
    </section>

    <div id="admin-app" class="admin-hidden">
      <section class="admin-card">
        <h2 class="admin-card-title">映画を追加</h2>
        <form id="admin-movie-form">
          <div class="admin-grid">
            <div class="admin-field admin-field-full">
              <label for="movie-title">タイトル<span class="req">*</span></label>
              <input id="movie-title" class="admin-input" name="title" required placeholder="冷たい熱帯魚">
            </div>
            <div class="admin-field">
              <label for="movie-title-kana">タイトル（かな）</label>
              <input id="movie-title-kana" class="admin-input" name="titleKana" placeholder="つめたいねったいぎょ">
            </div>
            <div class="admin-field">
              <label for="movie-title-en">英語タイトル</label>
              <input id="movie-title-en" class="admin-input" name="titleEn">
            </div>
            <div class="admin-field">
              <label for="movie-duration">上映時間（分）<span class="req">*</span></label>
              <input id="movie-duration" class="admin-input" name="durationMin" type="number" min="1" required placeholder="120">
            </div>
            <div class="admin-field">
              <label for="movie-rating">レーティング</label>
              <select id="movie-rating" class="admin-select" name="rating">
                <option value="">選択してください</option>
                <option value="G">G</option>
                <option value="PG12">PG12</option>
                <option value="R15+">R15+</option>
                <option value="R18+">R18+</option>
              </select>
            </div>
            <div class="admin-field">
              <label for="movie-genre">ジャンル</label>
              <input id="movie-genre" class="admin-input" name="genre" placeholder="ホラー,スリラー">
            </div>
            <div class="admin-field">
              <label for="movie-language">言語</label>
              <input id="movie-language" class="admin-input" name="language" placeholder="日本語">
            </div>
            <div class="admin-field">
              <label for="movie-director">監督</label>
              <input id="movie-director" class="admin-input" name="director" placeholder="園子温">
            </div>
            <div class="admin-field">
              <label for="movie-actor">主演</label>
              <input id="movie-actor" class="admin-input" name="mainActor" placeholder="吹越満">
            </div>
            <div class="admin-field admin-field-full">
              <label for="movie-poster">ポスター画像URL</label>
              <input id="movie-poster" class="admin-input" name="posterUrl" placeholder="https://...">
            </div>
            <div class="admin-field admin-field-full">
              <label for="movie-tagline">キャッチコピー</label>
              <input id="movie-tagline" class="admin-input" name="tagline">
            </div>
            <div class="admin-field admin-field-full">
              <label for="movie-synopsis">あらすじ</label>
              <textarea id="movie-synopsis" class="admin-textarea" name="synopsis"></textarea>
            </div>
          </div>
          <div class="admin-actions">
            <button type="submit" class="admin-btn">登録する</button>
            <button type="button" id="admin-logout" class="admin-btn admin-btn-ghost">ログアウト</button>
          </div>
          <p id="admin-movie-message" class="admin-message"></p>
        </form>
      </section>

      <section class="admin-card">
        <h2 class="admin-card-title">登録済みの映画</h2>
        <div id="admin-movie-list"></div>
      </section>
    </div>
  </div>`,
}
