import { runAccess } from './access'
import { runBooking } from './booking'
import { runCompleted } from './completed'
import { runContact } from './contact'
import { runDetail } from './detail'
import { runHome } from './home'
import { runMember } from './member'
import { runNews } from './news'
import { runQuestion } from './question'
import { runReservation } from './reservation'
import { runSchedule } from './schedule'
import { runTheater } from './theater'
import { runWorks } from './works'

export type PageCleanup = () => void
export type PageRunner = () => void | PageCleanup

export const pageRunners: Record<string, PageRunner | undefined> = {
  "access": runAccess,
  "booking": runBooking,
  "completed": runCompleted,
  "contact": runContact,
  "detail": runDetail,
  "index": runHome,
  "member": runMember,
  "news": runNews,
  "question": runQuestion,
  "reservation": runReservation,
  "schedule": runSchedule,
  "theater": runTheater,
  "works": runWorks,
}
