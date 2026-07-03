import { useEffect, useRef, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/core/utils'
import { toast } from '@/components/ui/Toast'
import logoSrc from '@/assets/SR.png'

export interface RecapData {
  monthLabel: string
  total: number
  currency: string
  showCents: boolean
  transactionCount: number
  topCategory?: { name: string; amount: number; icon?: string }
  savingsRate: number | null
}

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1350

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function drawRecap(canvas: HTMLCanvasElement, data: RecapData) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT)
  bg.addColorStop(0, '#2a1860')
  bg.addColorStop(0.5, '#160f38')
  bg.addColorStop(1, '#0a0914')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // Decorative glow circles
  ctx.fillStyle = 'rgba(124,92,252,0.18)'
  ctx.beginPath(); ctx.arc(CARD_WIDTH - 60, 120, 260, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(168,85,247,0.12)'
  ctx.beginPath(); ctx.arc(40, CARD_HEIGHT - 120, 300, 0, Math.PI * 2); ctx.fill()

  // Header: logo + month
  try {
    const logo = await loadImage(logoSrc)
    ctx.drawImage(logo, 64, 64, 72, 72)
  } catch { /* logo failed to load — card still works without it */ }
  ctx.fillStyle = 'rgba(240,238,255,0.55)'
  ctx.font = '600 30px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(data.monthLabel.toUpperCase(), CARD_WIDTH - 64, 108)
  ctx.textAlign = 'left'

  // Hero total
  ctx.fillStyle = 'rgba(200,195,240,0.6)'
  ctx.font = '600 34px system-ui, -apple-system, sans-serif'
  ctx.fillText('Total spent', 64, 300)
  ctx.fillStyle = '#f0eeff'
  ctx.font = '800 108px system-ui, -apple-system, sans-serif'
  const totalText = formatCurrency(data.total, data.currency, data.showCents)
  // Shrink the font if the formatted total would overflow the card width
  let totalFontSize = 108
  ctx.font = `800 ${totalFontSize}px system-ui, -apple-system, sans-serif`
  while (ctx.measureText(totalText).width > CARD_WIDTH - 128 && totalFontSize > 56) {
    totalFontSize -= 6
    ctx.font = `800 ${totalFontSize}px system-ui, -apple-system, sans-serif`
  }
  ctx.fillText(totalText, 64, 420)

  // Stat rows
  const stats: { label: string; value: string }[] = [
    { label: 'Transactions logged', value: String(data.transactionCount) },
  ]
  if (data.topCategory) {
    stats.push({
      label: 'Top category',
      value: `${data.topCategory.icon ? data.topCategory.icon + ' ' : ''}${data.topCategory.name} · ${formatCurrency(data.topCategory.amount, data.currency, false)}`,
    })
  }
  if (data.savingsRate != null) {
    stats.push({ label: 'Savings rate', value: `${data.savingsRate.toFixed(0)}%` })
  }

  let y = 560
  for (const stat of stats) {
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(64, y); ctx.lineTo(CARD_WIDTH - 64, y); ctx.stroke()
    ctx.fillStyle = 'rgba(200,195,240,0.55)'
    ctx.font = '600 28px system-ui, -apple-system, sans-serif'
    ctx.fillText(stat.label, 64, y + 56)
    ctx.fillStyle = '#f0eeff'
    ctx.font = '700 40px system-ui, -apple-system, sans-serif'
    ctx.fillText(stat.value, 64, y + 106)
    y += 160
  }

  // Footer tagline — doubles as an organic brand mention when the card is shared
  ctx.fillStyle = 'rgba(200,195,240,0.4)'
  ctx.font = '600 26px system-ui, -apple-system, sans-serif'
  ctx.fillText('Tracked privately with SpendWise · offline-first', 64, CARD_HEIGHT - 64)
}

export function RecapCard({ open, onClose, data }: { open: boolean; onClose: () => void; data: RecapData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [busy, setBusy] = useState<'share' | 'download' | null>(null)

  useEffect(() => {
    if (open && canvasRef.current) drawRecap(canvasRef.current, data)
  }, [open, data])

  const getBlob = (): Promise<Blob | null> =>
    new Promise(resolve => canvasRef.current?.toBlob(resolve, 'image/png'))

  const handleShare = async () => {
    setBusy('share')
    try {
      const blob = await getBlob()
      if (!blob) throw new Error('render failed')
      const file = new File([blob], `spendwise-recap-${data.monthLabel.replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My spending recap', text: `My ${data.monthLabel} spending recap` })
      } else {
        downloadBlob(blob, file.name)
      }
    } catch (e) {
      // AbortError fires when the user cancels the native share sheet — not a real failure
      if ((e as Error).name !== 'AbortError') toast.error('Could not share recap')
    } finally {
      setBusy(null)
    }
  }

  const handleDownload = async () => {
    setBusy('download')
    try {
      const blob = await getBlob()
      if (!blob) throw new Error('render failed')
      downloadBlob(blob, `spendwise-recap-${data.monthLabel.replace(/\s+/g, '-').toLowerCase()}.png`)
      toast.success('Recap saved')
    } catch {
      toast.error('Could not save recap')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Share Recap" size="sm">
      <div className="p-4 flex flex-col gap-4 pb-6">
        <div className="rounded-2xl overflow-hidden border border-ui">
          <canvas ref={canvasRef} className="w-full h-auto block" style={{ aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}` }} />
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={handleDownload} loading={busy === 'download'} className="flex-1">
            <Download size={15} /> Save
          </Button>
          <Button onClick={handleShare} loading={busy === 'share'} className="flex-1">
            <Share2 size={15} /> Share
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
