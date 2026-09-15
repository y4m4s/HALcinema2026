import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import vm from 'node:vm'

import {
  formatDateLabel,
  getDateWeekday,
  isCurseServiceDay,
  isMoviePlayingOn,
} from '../src/page-scripts/movie-data.js'

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url))

// data.ts は型注釈を含まない素のオブジェクト定義なので、tmdb/fetch-tmdb-data.js と
// 同じやり方で vm 上で評価して MOVIES / DATES を取り出す。
function loadMockData() {
  const source = readFileSync(path('../src/page-scripts/data.ts'), 'utf8')
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/^export \{[\s\S]*?\} from '[^']*'/m, '')
    .replace(/^export const /gm, 'var ')
  const sandbox = {
    // NEWS の本文組み立てにだけ使われる。金額の検証は pricing.ts から直接読む。
    SERVICE_DAY_PRICE: 0,
    THREE_D_EXTRA_FEE: 0,
    formatTicketPrice: () => '',
  }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: 'data.ts' })
  return { MOVIES: sandbox.MOVIES, DATES: sandbox.DATES, SCREENS: sandbox.SCREENS, TODAY_DATE: sandbox.TODAY_DATE }
}

function loadSeed() {
  return readFileSync(path('../../db/seed.sql'), 'utf8')
}

// seed.sql の _schedule_templates に並ぶ上映回テンプレートを読み出す。
function seedScheduleTemplates(seed) {
  const block = seed.slice(
    seed.indexOf('INSERT INTO _schedule_templates'),
    seed.indexOf('CREATE TEMP TABLE _schedule_dates'),
  )
  const rows = [...block.matchAll(
    /\('(M\d+)',\s*'(SCR\d+)',\s*'(\d\d:\d\d)',\s*'(\d\d:\d\d)',\s*'(\d+)',\s*'(\w+)'\)/g,
  )]
  return rows.map(([, movie, screen, start, end, days, status]) => ({
    movie, screen, start, end, days, status,
  }))
}

function mockScheduleTemplates(movies) {
  const rows = []
  for (const movie of movies) {
    if (!Array.isArray(movie.screenSchedules) || movie.screenSchedules.length === 0) continue
    const days = Array.isArray(movie.playingDays) ? [...movie.playingDays].sort().join('') : '0123456'
    for (const schedule of movie.screenSchedules) {
      for (const slot of schedule.slots || []) {
        rows.push({
          movie: `M${String(movie.id).padStart(3, '0')}`,
          screen: `SCR${String(schedule.screen).padStart(3, '0')}`,
          start: slot.start,
          end: slot.end,
          days,
          status: slot.status || 'ok',
        })
      }
    }
  }
  return rows
}

const sortRows = (rows) =>
  [...rows].sort((a, b) =>
    a.movie.localeCompare(b.movie) || a.screen.localeCompare(b.screen) || a.start.localeCompare(b.start),
  )

test('上映日ラベルを YYYY-MM-DD から組み立てる', () => {
  assert.equal(formatDateLabel('2026-05-12'), '5/12(火)')
  assert.equal(formatDateLabel('2026-05-17'), '5/17(日)')
  assert.equal(getDateWeekday('2026-05-12'), 2)
  assert.equal(getDateWeekday(''), -1)
})

test('上映曜日の判定は日付から行う', () => {
  const movie = { playingDays: [2, 3] }
  assert.equal(isMoviePlayingOn(movie, '2026-05-12'), true) // 火
  assert.equal(isMoviePlayingOn(movie, '2026-05-14'), false) // 木
  // playingDays が未設定の作品は全日上映として扱う。
  assert.equal(isMoviePlayingOn({}, '2026-05-14'), true)
})

test('サービスデーは13日だけで、日付以外の文字列では成立しない', () => {
  assert.equal(isCurseServiceDay('2026-05-13'), true)
  assert.equal(isCurseServiceDay('2026-05-12'), false)
  assert.equal(isCurseServiceDay('-13'), false)
  assert.equal(isCurseServiceDay('5/12(火) 13:00'), false)
})

test('DATES は YYYY-MM-DD の連続した1週間で、TODAY_DATE を含む', () => {
  const { DATES, TODAY_DATE } = loadMockData()
  assert.equal(DATES.length, 7)
  for (const date of DATES) assert.match(date, /^\d{4}-\d{2}-\d{2}$/)
  const pad = (value) => String(value).padStart(2, '0')
  for (let i = 1; i < DATES.length; i++) {
    const previous = new Date(`${DATES[i - 1]}T00:00:00`)
    previous.setDate(previous.getDate() + 1)
    const nextDate = `${previous.getFullYear()}-${pad(previous.getMonth() + 1)}-${pad(previous.getDate())}`
    assert.equal(DATES[i], nextDate)
  }
  // 上映週は当日から始まる。schedule / detail の日付タブは先頭が TODAY になる。
  assert.equal(DATES[0], TODAY_DATE)
})

test('上映週に呪いのサービスデー (13日) が含まれる', () => {
  const { DATES } = loadMockData()
  const serviceDays = DATES.filter((date) => isCurseServiceDay(date))
  assert.equal(serviceDays.length, 1, `上映週にサービスデーが1日だけ含まれること: ${DATES.join(', ')}`)
})

test('seed.sql の上映週は DATES と一致する', () => {
  const { DATES } = loadMockData()
  const seed = loadSeed()
  const first = seed.match(/VALUES \('(\d{4}-\d{2}-\d{2})'\)/)
  const last = seed.match(/WHERE show_date < '(\d{4}-\d{2}-\d{2})'/)
  assert.ok(first && last, 'seed.sql から上映週を読み取れない')
  assert.equal(first[1], DATES[0])
  assert.equal(last[1], DATES[DATES.length - 1])
})

test('seed.sql の上映回テンプレートは data.ts の screenSchedules と一致する', () => {
  const { MOVIES } = loadMockData()
  const seed = loadSeed()
  const expected = sortRows(mockScheduleTemplates(MOVIES))
  const actual = sortRows(seedScheduleTemplates(seed))
  assert.ok(expected.length > 0)
  assert.deepEqual(actual, expected)
})

test('同一スクリーンで時間帯が重なる上映回はない', () => {
  const { MOVIES } = loadMockData()
  const toMinutes = (clock) => {
    const [hour, minute] = clock.split(':').map(Number)
    return hour * 60 + minute
  }
  const slots = []
  for (const movie of MOVIES) {
    for (const schedule of movie.screenSchedules || []) {
      for (const slot of schedule.slots || []) {
        const start = toMinutes(slot.start)
        let end = toMinutes(slot.end)
        if (end <= start) end += 24 * 60 // 日跨ぎの回
        slots.push({
          id: movie.id,
          title: movie.title,
          screen: schedule.screen,
          start,
          end,
          days: Array.isArray(movie.playingDays) ? movie.playingDays : [0, 1, 2, 3, 4, 5, 6],
        })
      }
    }
  }
  const conflicts = []
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]
      const b = slots[j]
      if (a.id === b.id || a.screen !== b.screen) continue
      if (!a.days.some((day) => b.days.includes(day))) continue
      if (a.start < b.end && b.start < a.end) conflicts.push(`SCR${a.screen}: ${a.title} x ${b.title}`)
    }
  }
  assert.deepEqual(conflicts, [], `同一スクリーンの上映が重複している: ${conflicts.join(' / ')}`)
})

test('券種とスクリーンの料金は pricing.ts と seed.sql で一致する', () => {
  const pricing = readFileSync(path('../src/data/pricing.ts'), 'utf8')
  const seed = loadSeed()
  const pricingValue = (key) => {
    const match = pricing.match(new RegExp(`${key}:\\s*(\\d+)`))
    assert.ok(match, `pricing.ts に ${key} がない`)
    return Number(match[1])
  }
  const ticketRow = (code) => {
    const match = seed.match(new RegExp(`\\(\\d+, '${code}',[^)]*?(\\d+), (\\d+|NULL), \\d+, \\d+, \\d+\\)`))
    assert.ok(match, `seed.sql に ${code} の ticket_types がない`)
    return { price: Number(match[1]), serviceDay: match[2] === 'NULL' ? null : Number(match[2]) }
  }

  const serviceDay = pricingValue('serviceDay')
  for (const code of ['adult', 'university', 'student']) {
    const row = ticketRow(code)
    assert.equal(row.price, pricingValue(code), `${code} の通常価格が一致しない`)
    assert.equal(row.serviceDay, serviceDay, `${code} のサービスデー価格が一致しない`)
  }
  // 小学生・幼児はサービスデーの対象外。
  const child = ticketRow('child')
  assert.equal(child.price, pricingValue('child'))
  assert.equal(child.serviceDay, null)

  const surcharge = seed.match(/\('SCRT001', '大スクリーン',\s*(\d+)\)/)
  assert.ok(surcharge, 'seed.sql に screen_types の追加料金がない')
  assert.equal(Number(surcharge[1]), pricingValue('threeDExtra'))
})
