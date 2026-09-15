import type { PageDefinition } from '../types'

export const schedulePage: PageDefinition = {
  title: "上映スケジュール | HAL シネマ",
  bodyClass: "schedule-page",
  styles: [
  "/css/fonts.css",
  "/css/style.css",
  "/css/schedule.css"
],
  html: String.raw`<div class="page page-enter">
    <div class="section">
      <nav class="breadcrumb-nav" aria-label="パンくずリスト">
        <ol class="breadcrumb">
          <li class="breadcrumb__list"><a href="/">トップページ</a></li>
          <li class="breadcrumb__list" aria-current="page">上映スケジュール</li>
        </ol>
      </nav>
      <div class="section-header">
        <h1 class="section-title">上映スケジュール</h1>
        <span class="section-title-en">Schedule</span>
        <div class="section-line"></div>
      </div>

      <div class="view-tabs" id="view-tabs">
        <button class="view-tab active" data-mode="date">上映日程毎</button>
        <button class="view-tab" data-mode="movie">上映作品毎</button>
      </div>

      <div id="sub-tabs"></div>
      <div id="schedule-heading"></div>
      <div id="schedule-rows"></div>
    </div>
  </div>`,
}


