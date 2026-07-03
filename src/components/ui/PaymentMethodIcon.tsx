import { Banknote, CreditCard, Smartphone, Landmark, Bitcoin, Wallet, type LucideIcon } from 'lucide-react'
import type { PaymentMethod } from '@/core/types'

const PAYMENT_METHOD_ICON_COMPONENTS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  upi: Smartphone,
  bank_transfer: Landmark,
  crypto: Bitcoin,
  other: Wallet,
}

export function PaymentMethodIcon({ method, size = 14, className }: { method: PaymentMethod; size?: number; className?: string }) {
  const Icon = PAYMENT_METHOD_ICON_COMPONENTS[method]
  return <Icon size={size} className={className} />
}
