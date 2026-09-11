function parseDateOnly(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function todayDateOnly() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function validScreenNumbers(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((screen) => Number.isInteger(screen) && screen > 0))]
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// 上映日は YYYY-MM-DD で保持し、表示用のラベルはここで組み立てる。
export function formatDateLabel(value) {
  const date = parseDateOnly(value)
  if (!date) return String(value || '')
  return `${date.getMonth() + 1}/${date.getDate()}(${WEEKDAY_LABELS[date.getDay()]})`
}

export function getDateWeekday(value) {
  const date = parseDateOnly(value)
  return date ? date.getDay() : -1
}

export function isMoviePlayingOn(movie, value) {
  if (!Array.isArray(movie?.playingDays)) return true
  const weekday = getDateWeekday(value)
  return weekday >= 0 && movie.playingDays.includes(weekday)
}

// 毎月13日は「呪いのサービスデー」。
export function isCurseServiceDay(value) {
  const date = parseDateOnly(value)
  return date ? date.getDate() === 13 : false
}

export function getMovieStatus(movie, today = todayDateOnly()) {
  const screeningStartDate = parseDateOnly(movie?.screeningStartDate)
  if (!screeningStartDate) return 'now'
  return screeningStartDate > today ? 'coming' : 'now'
}

export function formatScreeningStartDate(movie) {
  const value = String(movie?.screeningStartDate || '')
  return value ? value.replaceAll('-', '.') : ''
}

export function getMovieScreens(movie) {
  const screens = validScreenNumbers(movie?.screens)
  if (screens.length) return screens

  return validScreenNumbers(
    Array.isArray(movie?.screenSchedules)
      ? movie.screenSchedules.map((schedule) => schedule?.screen)
      : [],
  )
}

export function getMovieScreenSchedules(movie) {
  if (Array.isArray(movie?.screenSchedules) && movie.screenSchedules.length) {
    return movie.screenSchedules
      .filter((schedule) => Number.isInteger(schedule?.screen) && schedule.screen > 0)
      .map((schedule) => ({
        ...schedule,
        slots: Array.isArray(schedule.slots) ? schedule.slots : [],
      }))
  }

  const screens = validScreenNumbers(movie?.screens)
  const slots = Array.isArray(movie?.schedules)
    ? movie.schedules
        .filter((schedule) => Array.isArray(schedule) && schedule.length >= 2)
        .map(([start, end]) => ({ start, end, status: 'ok' }))
    : []

  if (!screens.length || !slots.length) return []
  return screens.map((screen) => ({ screen, slots: slots.map((slot) => ({ ...slot })) }))
}
