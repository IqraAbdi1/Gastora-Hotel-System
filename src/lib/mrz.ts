// The machine-readable zone of an ID. An identity card and a passport both carry the guest's details
// twice: once printed for a person to read, and once in a fixed-width strip written for a machine.
// Reading the strip is the only honest way to prefill a check-in form, because every field in it is
// protected by a check digit: a misread is caught instead of being saved as a guest's name.
//
// Three layouts exist. A Ugandan national ID is TD1 (three lines of 30), a passport is TD3 (two lines
// of 44), and some older cards and visas are TD2 (two lines of 36). A driving permit carries no strip
// at all and is still typed.
//
// Pure rules only: no React, no DOM, no camera.

export type MrzFormat = 'TD1' | 'TD2' | 'TD3'

export interface MrzField<T> {
  value: T
  /** False when the strip's own check digit disagrees with the characters read. */
  trusted: boolean
}

export interface MrzRead {
  format: MrzFormat
  /** The cleaned lines the fields were taken from, kept so the desk can see what was read. */
  lines: string[]
  surname: string
  givenNames: string
  /** Surname and given names in the order a hotel writes them. */
  fullName: string
  documentNumber: MrzField<string>
  /** Three-letter country code as written in the strip. */
  nationality: string
  /** The nationality in the words a hotel uses, when the code is one we know. */
  nationalityLabel: string
  issuer: string
  dateOfBirth: MrzField<string>
  expiry: MrzField<string>
  sex: 'Female' | 'Male' | 'Other' | ''
  /** False when the final check digit over the whole strip disagrees. */
  wholeStripTrusted: boolean
  /** Every field whose check digit failed, in the hotel's words. */
  doubtful: string[]
}

export type MrzResult = { ok: true; read: MrzRead } | { ok: false; reason: string }

const FILLER = '<'

/** Characters the strip may contain. Anything else is a misread. */
const ALLOWED = /^[A-Z0-9<]+$/

const CHECK_VALUE = (c: string): number => {
  if (c === FILLER) return 0
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55
  return 0
}

/** The standard 7-3-1 check digit used by every field in the strip. */
export function checkDigit(text: string): number {
  const weights = [7, 3, 1]
  let sum = 0
  for (let i = 0; i < text.length; i += 1) sum += CHECK_VALUE(text[i]) * weights[i % 3]
  return sum % 10
}

// The check digit itself can be misread, so a letter standing in for a digit is corrected here too.
const passes = (text: string, digit: string): boolean => {
  const d = digitsOnly(digit ?? '')
  return /^[0-9]$/.test(d) && checkDigit(text) === Number(d)
}

// Letters and digits that a camera mistakes for one another. In a field that can only hold digits the
// letter is wrong, and in a field that can only hold letters the digit is wrong.
const TO_DIGIT: Record<string, string> = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', J: '1', Z: '2', A: '4', S: '5', G: '6', T: '7', B: '8' }
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '4': 'A', '5': 'S', '6': 'G', '8': 'B' }

const digitsOnly = (s: string) => s.replace(/[A-Z]/g, (c) => TO_DIGIT[c] ?? c)
const lettersOnly = (s: string) => s.replace(/[0-9]/g, (c) => TO_LETTER[c] ?? c)

const trim = (s: string) => s.replace(/</g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Six digits as the strip writes them, turned into a real date. A birth date cannot be in the future,
 * so 48 reads as 1948; an expiry can only be ahead of us, so 31 reads as 2031.
 */
export function mrzDate(six: string, kind: 'birth' | 'expiry'): string {
  const s = digitsOnly(six)
  if (!/^\d{6}$/.test(s)) return ''
  const yy = Number(s.slice(0, 2))
  const mm = Number(s.slice(2, 4))
  const dd = Number(s.slice(4, 6))
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return ''
  const thisYear = new Date().getFullYear() % 100
  const year = kind === 'birth' ? (yy > thisYear ? 1900 + yy : 2000 + yy) : yy >= 70 ? 1900 + yy : 2000 + yy
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(mm)}-${pad(dd)}`
}

const SEX: Record<string, MrzRead['sex']> = { F: 'Female', M: 'Male', X: 'Other', '<': '' }

/** The nationalities a Ugandan hotel sees most, in the words it writes on a register. */
export const NATIONALITY: Record<string, string> = {
  UGA: 'Ugandan', KEN: 'Kenyan', TZA: 'Tanzanian', RWA: 'Rwandan', BDI: 'Burundian', SSD: 'South Sudanese',
  COD: 'Congolese', ETH: 'Ethiopian', SOM: 'Somali', ERI: 'Eritrean', SDN: 'Sudanese', ZAF: 'South African',
  NGA: 'Nigerian', GHA: 'Ghanaian', EGY: 'Egyptian', GBR: 'British', USA: 'American', CAN: 'Canadian',
  IRL: 'Irish', FRA: 'French', DEU: 'German', NLD: 'Dutch', BEL: 'Belgian', ITA: 'Italian', ESP: 'Spanish',
  PRT: 'Portuguese', CHE: 'Swiss', AUT: 'Austrian', SWE: 'Swedish', NOR: 'Norwegian', DNK: 'Danish',
  FIN: 'Finnish', POL: 'Polish', TUR: 'Turkish', RUS: 'Russian', IND: 'Indian', PAK: 'Pakistani',
  BGD: 'Bangladeshi', LKA: 'Sri Lankan', CHN: 'Chinese', JPN: 'Japanese', KOR: 'South Korean',
  ARE: 'Emirati', SAU: 'Saudi', QAT: 'Qatari', ISR: 'Israeli', AUS: 'Australian', NZL: 'New Zealander',
  BRA: 'Brazilian', MEX: 'Mexican', ARG: 'Argentine',
}

export const nationalityLabel = (code: string): string => NATIONALITY[code] ?? code

/** Which of the hotel's ID types a strip belongs to. A card is a national ID; two long lines is a passport. */
export function idTypeFor(read: MrzRead): 'NIN' | 'Passport' {
  if (read.format === 'TD3') return 'Passport'
  return read.issuer === 'UGA' ? 'NIN' : 'Passport'
}

/** Names are written SURNAME<<GIVEN<NAMES and padded with filler. */
function splitNames(field: string): { surname: string; givenNames: string } {
  const [left, right = ''] = field.split('<<')
  return { surname: trim(left), givenNames: trim(right) }
}

const title = (s: string) =>
  s
    .toLowerCase()
    .split(/([ \-'])/)
    .map((p) => (/[a-z]/.test(p) ? p[0].toUpperCase() + p.slice(1) : p))
    .join('')

/** Pull the strip out of whatever the camera read: the right lines, the right length, nothing else. */
export function findMrzLines(text: string): string[] {
  const rows = text
    .toUpperCase()
    .split(/[\r\n]+/)
    .map((l) => l.replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 28 && ALLOWED.test(l))
  // The strip is the only part of a card with filler characters in it, so prefer lines that have them.
  const strip = rows.filter((l) => l.includes(FILLER))
  const use = strip.length >= 2 ? strip : rows
  const widths = [44, 36, 30]
  const near = (l: string) => widths.find((w) => Math.abs(l.length - w) <= 2)
  return use.filter((l) => near(l) !== undefined).map((l) => (near(l) === l.length ? l : l.padEnd(near(l) as number, FILLER).slice(0, near(l) as number)))
}

function readTD3(lines: string[]): MrzResult {
  const [l1, l2] = lines
  const doubtful: string[] = []
  const number = lettersOrDigits(l2.slice(0, 9))
  const numberOk = passes(number, l2[9])
  if (!numberOk) doubtful.push('the ID number')
  const dob = l2.slice(13, 19)
  const dobOk = passes(digitsOnly(dob), l2[19])
  if (!dobOk) doubtful.push('the date of birth')
  const exp = l2.slice(21, 27)
  const expOk = passes(digitsOnly(exp), l2[27])
  if (!expOk) doubtful.push('the expiry date')
  const composite = l2.slice(0, 10) + digitsOnly(l2.slice(13, 19)) + l2[19] + digitsOnly(l2.slice(21, 27)) + l2[27] + l2.slice(28, 43)
  const names = splitNames(l1.slice(5))
  return done({
    format: 'TD3',
    lines,
    names,
    number,
    numberOk,
    dob,
    dobOk,
    exp,
    expOk,
    sex: l2[20],
    nationality: lettersOnly(l2.slice(10, 13)),
    issuer: lettersOnly(l1.slice(2, 5)),
    wholeStripTrusted: passes(composite, l2[43]),
    doubtful,
  })
}

function readTD2(lines: string[]): MrzResult {
  const [l1, l2] = lines
  const doubtful: string[] = []
  const number = lettersOrDigits(l2.slice(0, 9))
  const numberOk = passes(number, l2[9])
  if (!numberOk) doubtful.push('the ID number')
  const dob = l2.slice(13, 19)
  const dobOk = passes(digitsOnly(dob), l2[19])
  if (!dobOk) doubtful.push('the date of birth')
  const exp = l2.slice(21, 27)
  const expOk = passes(digitsOnly(exp), l2[27])
  if (!expOk) doubtful.push('the expiry date')
  const composite = l2.slice(0, 10) + digitsOnly(l2.slice(13, 19)) + l2[19] + digitsOnly(l2.slice(21, 27)) + l2[27] + l2.slice(28, 35)
  return done({
    format: 'TD2',
    lines,
    names: splitNames(l1.slice(5)),
    number,
    numberOk,
    dob,
    dobOk,
    exp,
    expOk,
    sex: l2[20],
    nationality: lettersOnly(l2.slice(10, 13)),
    issuer: lettersOnly(l1.slice(2, 5)),
    wholeStripTrusted: passes(composite, l2[35]),
    doubtful,
  })
}

function readTD1(lines: string[]): MrzResult {
  const [l1, l2, l3] = lines
  const doubtful: string[] = []
  const long = longNumber(l1)
  const number = long.number
  const numberOk = long.trusted
  if (!numberOk) doubtful.push('the ID number')
  const dob = l2.slice(0, 6)
  const dobOk = passes(digitsOnly(dob), l2[6])
  if (!dobOk) doubtful.push('the date of birth')
  const exp = l2.slice(8, 14)
  const expOk = passes(digitsOnly(exp), l2[14])
  if (!expOk) doubtful.push('the expiry date')
  const composite = l1.slice(5) + digitsOnly(l2.slice(0, 6)) + l2[6] + digitsOnly(l2.slice(8, 14)) + l2[14] + l2.slice(18, 29)
  return done({
    format: 'TD1',
    lines,
    names: splitNames(l3),
    number,
    numberOk,
    dob,
    dobOk,
    exp,
    expOk,
    sex: l2[7],
    nationality: lettersOnly(l2.slice(15, 18)),
    issuer: lettersOnly(l1.slice(2, 5)),
    wholeStripTrusted: passes(composite, l2[29]),
    doubtful,
  })
}

/** A document number may hold either, so only obvious nonsense is corrected. */
const lettersOrDigits = (s: string) => s.replace(/[^A-Z0-9<]/g, FILLER)

/**
 * A number longer than the field it sits in. The document number field on a card holds nine characters,
 * and a Ugandan national identification number is fourteen, so the standard keeps the first nine in the
 * field, writes a filler where the check digit belongs, and continues the number in the spare space on
 * the same line with its check digit at the end of it. Read only the field and every long number comes
 * out cut short, which is how an ID number ends up wrong on an invoice.
 */
function longNumber(l1: string): { number: string; trusted: boolean } {
  const head = lettersOrDigits(l1.slice(5, 14))
  const digit = l1[14]
  if (digit !== FILLER) {
    const number = head.replace(/</g, '')
    return { number, trusted: passes(head, digit) }
  }
  const spare = lettersOrDigits(l1.slice(15))
  const run = spare.split(FILLER)[0]
  if (run.length < 2) return { number: head.replace(/</g, ''), trusted: false }
  const tail = run.slice(0, -1)
  const whole = head.replace(/</g, '') + tail
  return { number: whole, trusted: passes(whole, run[run.length - 1]) }
}

function done(p: {
  format: MrzFormat
  lines: string[]
  names: { surname: string; givenNames: string }
  number: string
  numberOk: boolean
  dob: string
  dobOk: boolean
  exp: string
  expOk: boolean
  sex: string
  nationality: string
  issuer: string
  wholeStripTrusted: boolean
  doubtful: string[]
}): MrzResult {
  const surname = title(p.names.surname)
  const givenNames = title(p.names.givenNames)
  if (!surname && !givenNames) return { ok: false, reason: 'No name could be read from the strip. Try again with the card flat and the whole strip in the frame.' }
  return {
    ok: true,
    read: {
      format: p.format,
      lines: p.lines,
      surname,
      givenNames,
      fullName: trim(`${givenNames} ${surname}`),
      documentNumber: { value: trim(p.number).replace(/\s/g, ''), trusted: p.numberOk },
      nationality: p.nationality.replace(/</g, ''),
      nationalityLabel: nationalityLabel(p.nationality.replace(/</g, '')),
      issuer: p.issuer.replace(/</g, ''),
      dateOfBirth: { value: mrzDate(p.dob, 'birth'), trusted: p.dobOk },
      expiry: { value: mrzDate(p.exp, 'expiry'), trusted: p.expOk },
      sex: SEX[p.sex] ?? '',
      wholeStripTrusted: p.wholeStripTrusted,
      doubtful: p.doubtful,
    },
  }
}

/**
 * Read a strip. Give it the lines from the camera, a hand scanner or the desk's own typing: the rules
 * are the same, and so is the honesty about which fields cannot be trusted.
 */
export function parseMrz(input: string | string[]): MrzResult {
  const lines = Array.isArray(input) ? input.map((l) => l.toUpperCase().replace(/[^A-Z0-9<]/g, '')) : findMrzLines(input)
  const sized = lines.filter((l) => l.length >= 28)
  if (sized.length < 2) return { ok: false, reason: 'The strip was not found. Lay the card flat, fill the frame with the lines of letters and numbers, and try again.' }
  const three = sized.filter((l) => l.length >= 28 && l.length <= 32)
  if (three.length >= 3) return readTD1([pad(three[0], 30), pad(three[1], 30), pad(three[2], 30)])
  const long = sized.filter((l) => l.length >= 40)
  if (long.length >= 2) return readTD3([pad(long[0], 44), pad(long[1], 44)])
  const mid = sized.filter((l) => l.length >= 33 && l.length <= 39)
  if (mid.length >= 2) return readTD2([pad(mid[0], 36), pad(mid[1], 36)])
  if (three.length === 2) return { ok: false, reason: 'An identity card has three lines in the strip and only two were read. Include the line with the name.' }
  return { ok: false, reason: 'The lines are not a length the standard uses. A passport has two lines of 44 characters and an identity card three of 30.' }
}

const pad = (l: string, width: number) => l.padEnd(width, FILLER).slice(0, width)

/** A strip written back out, for the record of what was read. */
export const mrzText = (read: MrzRead): string => read.lines.join('\n')
