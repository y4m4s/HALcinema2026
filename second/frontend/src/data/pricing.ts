export const TICKET_PRICES = {
  adult: 1800,
  university: 1600,
  student: 1400,
  child: 1000,
  threeDExtra: 400,
  serviceDay: 1300,
} as const

export const TICKET_TYPES = [
  {
    id: 'adult',
    label: '一般',
    note: '大人',
    guideNote: '',
    price: TICKET_PRICES.adult,
    seats: 1,
    serviceDayEligible: true,
  },
  {
    id: 'university',
    label: '大学生・専門学生',
    note: '学生証提示',
    guideNote: '学生証提示',
    price: TICKET_PRICES.university,
    seats: 1,
    serviceDayEligible: true,
  },
  {
    id: 'student',
    label: '中学・高校生',
    note: '学生証提示',
    guideNote: '学生証提示',
    price: TICKET_PRICES.student,
    seats: 1,
    serviceDayEligible: true,
  },
  {
    id: 'child',
    label: '小学生・幼児',
    note: '3歳以上',
    guideNote: '',
    price: TICKET_PRICES.child,
    seats: 1,
    serviceDayEligible: false,
  },
] as const

export const SERVICE_DAY_PRICE = TICKET_PRICES.serviceDay
export const THREE_D_EXTRA_FEE = TICKET_PRICES.threeDExtra

export const TICKET_PRICE_GUIDE = [
  ...TICKET_TYPES.map((ticket) => ({
    id: ticket.id,
    category: ticket.label,
    price: ticket.price,
    note: ticket.guideNote,
    prefix: '',
  })),
  {
    id: 'three-d-extra',
    category: '3D 追加料金',
    price: THREE_D_EXTRA_FEE,
    note: '対象作品のみ',
    prefix: '+',
  },
  {
    id: 'service-day',
    category: '呪いのサービスデー（毎月13日）',
    price: SERVICE_DAY_PRICE,
    note: '中学生以上',
    prefix: '',
  },
]

export function formatTicketPrice(price: number, prefix = '') {
  return `${prefix}${price.toLocaleString('ja-JP')}円`
}

export function formatTicketPriceWithSymbol(price: number) {
  return `¥${price.toLocaleString('ja-JP')}`
}
