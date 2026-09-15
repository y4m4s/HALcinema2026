import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import vm from 'node:vm'

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url))

// booking.ts は DOM に依存するため、カード判定に使う定義だけを取り出して vm 上で評価する。
function loadCardValidation() {
  // Windows のチェックアウトでは改行が CRLF になるため、行末の判定前に LF へそろえる。
  const source = readFileSync(path('../src/page-scripts/booking.ts'), 'utf8').replace(/\r\n/g, '\n')
  const pick = (pattern, name) => {
    const match = source.match(pattern)
    assert.ok(match, `booking.ts から ${name} を読み取れませんでした`)
    return match[0]
  }
  const code = [
    pick(/^const CARD_BRANDS = \[[\s\S]*?^\]$/m, 'CARD_BRANDS'),
    pick(/^function getCardBrand\([\s\S]*?^\}$/m, 'getCardBrand'),
    pick(/^function isLuhnValid\([\s\S]*?^\}$/m, 'isLuhnValid'),
    'this.getCardBrand = getCardBrand; this.isLuhnValid = isLuhnValid',
  ].join('\n')
  const sandbox = {}
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox, { filename: 'booking.ts' })
  return sandbox
}

const { getCardBrand, isLuhnValid } = loadCardValidation()

// 先頭4桁を固定し、Luhn 検査を通る16桁のカード番号を作る。
function luhnValidNumber(prefix) {
  const body = prefix.padEnd(15, '0')
  for (let check = 0; check <= 9; check += 1) {
    const candidate = `${body}${check}`
    if (isLuhnValid(candidate)) return candidate
  }
  throw new Error(`Luhn 検査を通る番号を作れませんでした: ${prefix}`)
}

test('カードブランドは Mastercard 2221〜2720 / JCB 3528〜3589 の境界で判定する', () => {
  const cases = [
    ['2220', ''],
    ['2221', 'Mastercard'],
    ['2720', 'Mastercard'],
    ['2721', ''],
    ['5099', ''],
    ['5100', 'Mastercard'],
    ['5599', 'Mastercard'],
    ['5600', ''],
    ['3527', ''],
    ['3528', 'JCB'],
    ['3589', 'JCB'],
    ['3590', ''],
    ['4000', 'VISA'],
  ]
  for (const [prefix, brand] of cases) {
    assert.equal(getCardBrand(luhnValidNumber(prefix)), brand, `${prefix} で始まる番号のブランド`)
  }
})
