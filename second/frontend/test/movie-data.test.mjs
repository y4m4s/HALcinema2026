import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatScreeningStartDate,
  getMovieScreens,
  getMovieScreenSchedules,
  getMovieStatus,
} from '../src/page-scripts/movie-data.js'

test('上映開始日を過ぎると上映中になる', () => {
  const movie = { screeningStartDate: '2026-08-15' }
  assert.equal(getMovieStatus(movie, new Date(2026, 7, 14)), 'coming')
  assert.equal(getMovieStatus(movie, new Date(2026, 7, 15)), 'now')
  assert.equal(getMovieStatus(movie, new Date(2027, 0, 1)), 'now')
})

test('上映情報が未登録でも安全な空配列を返す', () => {
  assert.deepEqual(getMovieScreens({}), [])
  assert.deepEqual(getMovieScreenSchedules({}), [])
})

test('screenSchedules からスクリーン番号を補完する', () => {
  const movie = {
    screenSchedules: [
      { screen: 2, slots: [{ start: '10:00', end: '12:00', status: 'ok' }] },
      { screen: 7 },
    ],
  }
  assert.deepEqual(getMovieScreens(movie), [2, 7])
  assert.deepEqual(getMovieScreenSchedules(movie)[1].slots, [])
})

test('旧形式の screens と schedules から上映スケジュールを補完する', () => {
  const schedules = getMovieScreenSchedules({
    screens: [1, 3],
    schedules: [['10:00', '12:00']],
  })
  assert.equal(schedules.length, 2)
  assert.deepEqual(schedules[0], {
    screen: 1,
    slots: [{ start: '10:00', end: '12:00', status: 'ok' }],
  })
})

test('上映開始日を表示用に整形する', () => {
  assert.equal(formatScreeningStartDate({ screeningStartDate: '2026-08-15' }), '2026.08.15')
  assert.equal(formatScreeningStartDate({}), '')
})
