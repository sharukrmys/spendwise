import type { PaymentMethod } from './types'

export interface ParsedSMS {
  amount?: number
  type?: 'expense' | 'income'
  merchant?: string
  paymentMethod?: PaymentMethod
  categoryHint?: string        // loose category name for the caller to fuzzy-match
  confidence: 'high' | 'medium' | 'low'
}

// ─── Amount ─────────────────────────────────────────────────────────────────

const AMOUNT_PATTERNS = [
  // "INR 1,250.00" / "INR1250"
  /(?:INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/i,
  // "₹ 1,250.00"
  /₹\s*([\d,]+(?:\.\d{1,2})?)/,
  // "1,250.00 INR" (amount before unit)
  /([\d,]+(?:\.\d{1,2})?)\s*INR/i,
  // Bare number after debit/credit keywords (last resort)
  /(?:debited?|credited?|spent|paid|withdrawn|received)\s+(?:(?:INR|Rs\.?|₹)\s*)?([\d,]+(?:\.\d{1,2})?)/i,
]

function parseAmount(text: string): number | undefined {
  for (const re of AMOUNT_PATTERNS) {
    const m = text.match(re)
    if (m) {
      const cleaned = m[1].replace(/,/g, '')
      const val = parseFloat(cleaned)
      if (!isNaN(val) && val > 0) return val
    }
  }
  return undefined
}

// ─── Transaction type ────────────────────────────────────────────────────────

const DEBIT_WORDS = /\b(debit(?:ed)?|spent|withdrawn|withdrawal|paid|purchase|charged|deducted|utilized)\b/i
const CREDIT_WORDS = /\b(credit(?:ed)?|received|deposited|added|refund(?:ed)?|reversed|cashback)\b/i

function parseType(text: string): 'expense' | 'income' | undefined {
  const hasDebit  = DEBIT_WORDS.test(text)
  const hasCredit = CREDIT_WORDS.test(text)
  if (hasDebit && !hasCredit) return 'expense'
  if (hasCredit && !hasDebit) return 'income'
  // Both or neither — prefer debit for bank alerts
  if (hasDebit) return 'expense'
  return undefined
}

// ─── Merchant ────────────────────────────────────────────────────────────────

/**
 * Try these patterns in order, pick first match, then clean it up.
 */
const MERCHANT_PATTERNS = [
  // "at MERCHANT NAME" — most common for card/POS
  /\bat\s+([A-Z][A-Z0-9\s\-&.'/]{1,40}?)(?:\s+on\s|\s+\d|\.|,|$)/i,
  // "to VPA xyz@okaxis" — UPI payee VPA
  /\bto\s+(?:VPA\s+)?([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)/i,
  // "to UPI ID xyz@..."
  /\bUPI\s+ID\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+)/i,
  // "to MERCHANT NAME" (debit — not ATM)
  /\bto\s+([A-Z][A-Z0-9\s\-&.'/]{2,40}?)(?:\s+on\s|\s+via\s|\s*\.|,|$)/i,
  // "from MERCHANT" (credit)
  /\bfrom\s+(?!A\/c|AC|account|your)([A-Z][A-Z0-9\s\-&.'/]{2,40}?)(?:\s+on\s|\s*\.|,|$)/i,
  // "Info: MERCHANT" — some banks prefix info
  /\bInfo:\s*([A-Z][A-Z0-9\s\-&.'/]{2,40}?)(?:\s*[-–]|\.|,|$)/i,
]

// Words that look like merchants but are actually bank/transaction jargon
const NOISE_WORDS = new Set([
  'BANK', 'BRANCH', 'ACCOUNT', 'ACCOUNT NO', 'AVAIL', 'BALANCE', 'BAL',
  'CARD', 'REF', 'TXN', 'TRANSACTION', 'TRANSFER', 'PAYMENT', 'MOBILE',
  'NET BANKING', 'NETBANKING', 'INTERNET', 'YOUR', 'THE', 'A/C', 'AC NO',
  'UPI', 'NEFT', 'IMPS', 'RTGS', 'ATM', 'POS', 'CASH',
])

function cleanMerchant(raw: string): string {
  return raw
    .replace(/[.!?,;:]+$/, '')          // trailing punctuation
    .replace(/\s{2,}/g, ' ')            // collapse spaces
    .trim()
}

function parseMerchant(text: string): string | undefined {
  for (const re of MERCHANT_PATTERNS) {
    const m = text.match(re)
    if (m) {
      const candidate = cleanMerchant(m[1])
      const upper = candidate.toUpperCase()
      if (candidate.length >= 2 && !NOISE_WORDS.has(upper)) {
        return candidate
      }
    }
  }
  return undefined
}

// ─── Payment method ──────────────────────────────────────────────────────────

function parsePaymentMethod(text: string): PaymentMethod {
  const t = text.toUpperCase()
  if (/\bATM\b/.test(t)) return 'cash'
  if (/\bUPI\b|@[A-Z0-9]+\.(OK|YBL|ICICI|AXIS|SBI|HDFC|PAYTM|AIRTEL)\b/i.test(t)) return 'upi'
  if (/\b(NEFT|RTGS|IMPS)\b/.test(t)) return 'bank_transfer'
  if (/\b(CREDIT CARD|DEBIT CARD|CARD NO|CARD ENDING|CARD XX)\b/i.test(t)) return 'card'
  // If VPA pattern (@something) appears, it's likely UPI
  if (/@[a-z0-9]+/i.test(t)) return 'upi'
  return 'other'
}

// ─── Category hint ───────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/\b(ZOMATO|SWIGGY|DOMINOS?|MCDONALD|PIZZA|DUNZO|BLINKIT|ZEPTO|BIGBASKET|GROFER|DINEOUT|RESTAURANT|CAFE|HOTEL|FOOD)\b/i, 'Food & Dining'],
  [/\b(UBER|OLA|RAPIDO|REDBUS|IRCTC|RAILWAY|METRO|AUTO|TAXI|FLIGHT|AIRLINE|INDIGO|SPICEJET|MAKE MY TRIP|CLEARTRIP)\b/i, 'Transport'],
  [/\b(AMAZON|FLIPKART|MYNTRA|MEESHO|NYKAA|AJIO|SHOPSY|SNAPDEAL|RELIANCE DIGITAL|CROMA|VIJAY SALES)\b/i, 'Shopping'],
  [/\b(NETFLIX|SPOTIFY|PRIME VIDEO|HOTSTAR|DISNEY|YOUTUBE|APPLE|GOOGLE PLAY|PLAYSTATION|XBOX|GAANA|JIO SAAVN)\b/i, 'Subscriptions'],
  [/\b(CINEMA|MOVIE|PVR|INOX|BOOKMYSHOW|THEATRE|CONCERT|EVENT)\b/i, 'Entertainment'],
  [/\b(HOSPITAL|CLINIC|PHARMACY|MEDICAL|MEDICINE|DOCTOR|APOLLO|FORTIS|MAX HEALTH|MANIPAL|LAB|DIAGNOSTIC|HEALTHKART)\b/i, 'Health'],
  [/\b(ELECTRICITY|MSEB|BESCOM|KSEB|BSES|TATA POWER|WATER|GAS|POSTPAID|BROADBAND|WIFI|JIOFIBER|AIRTEL|BSNL|TRAI)\b/i, 'Utilities'],
  [/\b(SCHOOL|COLLEGE|UNIVERSITY|COURSE|UDEMY|COURSERA|BYJU|UNACADEMY|TUITION|FEES|EXAM)\b/i, 'Education'],
  [/\b(SALARY|STIPEND|FREELANCE|PAYROLL|WAGES)\b/i, 'Investments'],   // income category
  [/\b(RENT|MAINTENANCE|SOCIETY|HOUSING|FLAT|PG|ROOM)\b/i, 'Housing'],
  [/\b(TRAVEL|HOTEL|BOOKING|AIRBNB|OYO|GOIBIBO|HOLIDAY|TRIP)\b/i, 'Travel'],
  [/\b(GYM|FITNESS|CULT|HEALTHIFY|SALON|SPA|PERSONAL CARE|GROOMING)\b/i, 'Personal Care'],
  [/\b(ATM|CASH WITHDRAWAL|WITHDRAWAL)\b/i, 'Other'],
]

function parseCategoryHint(text: string, merchant?: string): string | undefined {
  const combined = [text, merchant ?? ''].join(' ')
  for (const [re, cat] of CATEGORY_KEYWORDS) {
    if (re.test(combined)) return cat
  }
  return undefined
}

// ─── Confidence scoring ──────────────────────────────────────────────────────

function scoreConfidence(result: Omit<ParsedSMS, 'confidence'>): ParsedSMS['confidence'] {
  let score = 0
  if (result.amount)        score += 3
  if (result.type)          score += 2
  if (result.merchant)      score += 2
  if (result.paymentMethod && result.paymentMethod !== 'other') score += 1
  if (result.categoryHint)  score += 1
  if (score >= 7)  return 'high'
  if (score >= 4)  return 'medium'
  return 'low'
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function parseSMS(text: string): ParsedSMS {
  // Normalise: collapse newlines, trim
  const t = text.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ').trim()

  const amount        = parseAmount(t)
  const type          = parseType(t)
  const merchant      = parseMerchant(t)
  const paymentMethod = parsePaymentMethod(t)
  const categoryHint  = parseCategoryHint(t, merchant)

  const partial = { amount, type, merchant, paymentMethod, categoryHint }
  return { ...partial, confidence: scoreConfidence(partial) }
}

/**
 * Format the parsed merchant into a user-friendly notes string.
 * Prefers VPA short-form (e.g. "zomato@icici" → "Zomato").
 */
export function merchantToNotes(merchant: string): string {
  // If it's a VPA (contains @), use the part before @ and title-case it
  if (merchant.includes('@')) {
    const name = merchant.split('@')[0].replace(/[._-]/g, ' ')
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
  }
  // Title-case the merchant name
  return merchant
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}
