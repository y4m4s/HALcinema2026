import { accessPage } from './access'
import { bookingPage } from './booking'
import { completedPage } from './completed'
import { contactPage } from './contact'
import { detailPage } from './detail'
import { homePage } from './index'
import { newsPage } from './news'
import { questionPage } from './question'
import { schedulePage } from './schedule'
import { theaterPage } from './theater'
import { ticketsPage } from './tickets'
import { worksPage } from './works'
import type { PageDefinition } from '../types'

export const pages: Record<string, PageDefinition> = {
  "access": accessPage,
  "booking": bookingPage,
  "completed": completedPage,
  "contact": contactPage,
  "detail": detailPage,
  "index": homePage,
  "news": newsPage,
  "question": questionPage,
  "schedule": schedulePage,
  "theater": theaterPage,
  "tickets": ticketsPage,
  "works": worksPage,
}
