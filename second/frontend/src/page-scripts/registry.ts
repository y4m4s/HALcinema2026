import { runAccess } from './access'
import { runCompleted } from './completed'
import { runContact } from './contact'
import { runDetail } from './detail'
import { runHome } from './home'
import { runLogin } from './login'
import { runNews } from './news'
import { runQuestion } from './question'
import { runSchedule } from './schedule'
import { runTheater } from './theater'
import { runWorks } from './works'

export type PageRunner = () => void

export const pageRunners: Record<string, PageRunner | undefined> = {
  "access": runAccess,
  "completed": runCompleted,
  "contact": runContact,
  "detail": runDetail,
  "index": runHome,
  "login": runLogin,
  "news": runNews,
  "question": runQuestion,
  "schedule": runSchedule,
  "theater": runTheater,
  "works": runWorks,
}
