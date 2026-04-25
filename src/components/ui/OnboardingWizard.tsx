import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useBudgetStore } from '@/store/useBudgetStore'
import { CURRENCIES } from '@/core/constants'

const STEPS = ['welcome', 'currency', 'budget', 'done'] as const
type Step = typeof STEPS[number]

const SUGGESTED_BUDGETS = [10000, 20000, 30000, 50000]

export function OnboardingWizard() {
  const { settings, updateSettings } = useSettingsStore()
  const { addBudget } = useBudgetStore()

  const [step, setStep] = useState<Step>('welcome')
  const [currency, setCurrency] = useState(settings.defaultCurrency)
  const [budget, setBudget] = useState('')
  const [saving, setSaving] = useState(false)

  if (settings.onboardingDone) return null

  const stepIdx = STEPS.indexOf(step)

  const next = () => setStep(STEPS[stepIdx + 1] as Step)

  const finish = async () => {
    setSaving(true)
    updateSettings({ defaultCurrency: currency })
    const amt = parseFloat(budget)
    if (!isNaN(amt) && amt > 0) {
      await addBudget({ categoryId: undefined, amount: amt, currency, period: 'monthly', startDate: Date.now() })
    }
    updateSettings({ onboardingDone: true })
  }

  const sym = CURRENCIES.find(c => c.code === currency)?.symbol ?? currency

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-end"
      style={{ background: 'rgba(10,9,20,0.85)', backdropFilter: 'blur(16px)' }}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl overflow-hidden"
        style={{ background: 'var(--bg-card)', boxShadow: '0 -8px 48px rgba(0,0,0,0.5)' }}
      >
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pt-5 pb-1">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: s === step ? 24 : 6,
                background: i <= stepIdx ? 'var(--brand)' : 'var(--bg-card3)',
              }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.22 }}
            className="px-6 py-6"
          >
            {step === 'welcome' && (
              <div className="flex flex-col items-center text-center gap-4">
                <div className="text-6xl">👋</div>
                <h2 className="text-2xl font-bold text-1">Welcome to SpendWise</h2>
                <p className="text-sm text-2 leading-relaxed max-w-xs">
                  Track your spending, plan purchases, and understand your finances — all offline, all private.
                </p>
                <p className="text-xs text-3">Takes about 30 seconds to set up</p>
                <button onClick={next} className="btn btn-brand w-full py-4 text-base mt-2">
                  Get started <ArrowRight size={18} />
                </button>
              </div>
            )}

            {step === 'currency' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-xl font-bold text-1 mb-1">Your currency</h2>
                  <p className="text-sm text-2">Pick the currency you use most.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                  {CURRENCIES.map(c => (
                    <button
                      key={c.code}
                      onClick={() => setCurrency(c.code)}
                      className="flex items-center gap-2.5 p-3 rounded-2xl tap transition-all text-left"
                      style={currency === c.code
                        ? { background: 'rgba(124,92,252,0.15)', border: '1.5px solid rgba(124,92,252,0.5)' }
                        : { background: 'var(--bg-card2)', border: '1.5px solid var(--border)' }}
                    >
                      <span className="text-lg font-bold" style={{ color: currency === c.code ? 'var(--brand)' : 'var(--text-2)', minWidth: 28 }}>{c.symbol}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-1 truncate">{c.name}</p>
                        <p className="text-[10px] text-3">{c.code}</p>
                      </div>
                      {currency === c.code && <Check size={14} className="ml-auto text-brand shrink-0" />}
                    </button>
                  ))}
                </div>
                <button onClick={next} className="btn btn-brand w-full py-4">
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            )}

            {step === 'budget' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-xl font-bold text-1 mb-1">Monthly budget</h2>
                  <p className="text-sm text-2">Optional — set a spending limit to track progress.</p>
                </div>
                <input
                  type="number"
                  placeholder={`0 ${currency}`}
                  value={budget}
                  onChange={e => setBudget(e.target.value)}
                  className="input text-2xl font-bold text-center"
                  style={{ height: 64 }}
                />
                <div className="flex gap-2 flex-wrap">
                  {SUGGESTED_BUDGETS.map(v => (
                    <button
                      key={v}
                      onClick={() => setBudget(v.toString())}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold tap"
                      style={budget === v.toString()
                        ? { background: 'rgba(124,92,252,0.15)', border: '1.5px solid rgba(124,92,252,0.5)', color: 'var(--brand)' }
                        : { background: 'var(--bg-card2)', border: '1.5px solid var(--border)', color: 'var(--text-2)' }}
                    >
                      {sym}{(v / 1000).toFixed(0)}k
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={finish} className="btn btn-ghost flex-1 py-4 text-sm" disabled={saving}>
                    Skip
                  </button>
                  <button onClick={finish} className="btn btn-brand flex-1 py-4 text-sm" disabled={saving}>
                    {saving ? 'Saving…' : 'Done 🎉'}
                  </button>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="flex flex-col items-center text-center gap-4">
                <div className="text-6xl">🎉</div>
                <h2 className="text-xl font-bold text-1">You're all set!</h2>
                <p className="text-sm text-2">Add your first expense to get started.</p>
                <button onClick={finish} className="btn btn-brand w-full py-4">
                  Start tracking <ArrowRight size={16} />
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
