import { runAccess } from './access'
import { runAdmin } from './admin'
import { runBooking } from './booking'
import { runCompleted } from './completed'
import { runContact } from './contact'
import { runDetail } from './detail'
import { runHome } from './home'
import { runNews } from './news'
import { runQuestion } from './question'
import { runSchedule } from './schedule'
import { runTheater } from './theater'
import { runWorks } from './works'

export type PageRunner = () => void

export const pageRunners: Record<string, PageRunner | undefined> = {
  "access": runAccess,
  "admin": runAdmin,
  "booking": runBooking,
  "completed": runCompleted,
  "contact": runContact,
  "detail": runDetail,
  "index": runHome,
  "news": runNews,
  "question": runQuestion,
  "schedule": runSchedule,
  "theater": runTheater,
  "works": runWorks,
}
