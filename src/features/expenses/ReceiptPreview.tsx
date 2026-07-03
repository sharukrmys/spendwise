import { X, Sparkles } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { parseCategoryHint } from '@/core/smsParser'
import type { Category } from '@/core/types'

// Receipt headers that sit above the store name and would otherwise be
// mistaken for the merchant if OCR line order isn't perfectly top-to-bottom.
const RECEIPT_NOISE = /^(RECEIPT|INVOICE|TAX\s*INVOICE|BILL(?:\s*NO)?|GSTIN?|CASH\s*MEMO|CUSTOMER\s*COPY|ORIGINAL|DUPLICATE|THANK\s*YOU|WELCOME\s*TO)\b/i

interface DetectedTextResult {
  rawValue: string
  boundingBox: { y: number }
}

function guessMerchant(results: DetectedTextResult[]): string | undefined {
  // Store name is almost always one of the first few printed lines.
  const sorted = [...results].sort((a, b) => a.boundingBox.y - b.boundingBox.y)
  for (const r of sorted.slice(0, 6)) {
    const line = r.rawValue.trim()
    if (line.length < 3) continue
    if (/^[\d.,\s₹$€£]+$/.test(line)) continue // pure number/currency, not a name
    if (RECEIPT_NOISE.test(line)) continue
    // Title-case all-caps store names ("WALMART" -> "Walmart") so it reads
    // naturally in the notes field; leave mixed-case OCR output untouched.
    if (line === line.toUpperCase()) {
      return line.split(/\s+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
    }
    return line
  }
  return undefined
}

/** Receipt thumbnail + optional on-device OCR to prefill amount, merchant, and category.
 * Only rendered once a receipt image has been attached. */
export function ReceiptPreview({
  receipt, onRemove, currencySymbol, categories, onDetailsExtracted,
}: {
  receipt: string
  onRemove: () => void
  currencySymbol: string
  categories: Category[]
  onDetailsExtracted: (details: { amount?: number; merchant?: string; categoryId?: string }) => void
}) {
  const extractDetails = async () => {
    try {
      const img = new Image()
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = receipt })
      const bitmap = await createImageBitmap(img)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).TextDetector()
      const results: DetectedTextResult[] = await detector.detect(bitmap)
      const text = results.map(r => r.rawValue).join(' ')

      // Look for currency amount patterns: ₹1,234.56 / $12.50 / 1234
      const amountMatch = text.match(/(?:₹|Rs\.?|INR|USD|\$|€|£)?\s*([\d,]+(?:\.\d{1,2})?)/i)
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : undefined
      const validAmount = amount != null && !isNaN(amount) && amount > 0 ? amount : undefined

      const merchant = guessMerchant(results)
      const categoryName = parseCategoryHint(text, merchant)
      const categoryId = categoryName
        ? categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase())?.id
        : undefined

      if (!validAmount && !merchant) {
        toast.error('No details found in receipt')
        return
      }
      onDetailsExtracted({ amount: validAmount, merchant, categoryId })
      const parts = [validAmount ? `${currencySymbol}${validAmount}` : null, merchant].filter(Boolean)
      toast.success(`Extracted: ${parts.join(' · ')}`)
    } catch {
      toast.error('OCR failed — try again')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        <img src={receipt} className="w-14 h-14 rounded-xl object-cover border border-ui" alt="Receipt" />
        <button onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: 'var(--expense)' }}>
          <X size={10} className="text-white" />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-2 mb-1.5">Receipt attached</p>
        {'TextDetector' in window && (
          <button
            type="button"
            onClick={extractDetails}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl tap text-xs font-semibold"
            style={{ background: 'rgba(124,92,252,0.12)', color: 'var(--brand)', border: '1px solid rgba(124,92,252,0.25)' }}
          >
            <Sparkles size={12} /> Extract details
          </button>
        )}
      </div>
    </div>
  )
}
