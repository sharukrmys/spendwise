import { useState, useRef } from 'react'
import { Moon, Sun, Monitor, Download, Upload, Trash2, ChevronRight, DollarSign, Tag, PlusCircle, RefreshCw, CloudOff, LogOut, CloudDownload, CheckCircle2, AlertCircle, Loader2, Smartphone } from 'lucide-react'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useSettingsStore, applyTheme } from '@/store/useSettingsStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useBudgetStore } from '@/store/useBudgetStore'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useSyncStore } from '@/store/useSyncStore'
import { backupQueries } from '@/db/queries'
import { toast } from '@/components/ui/Toast'
import { CURRENCIES, PAYMENT_METHOD_LABELS } from '@/core/constants'
import { formatCurrency, cn } from '@/core/utils'
import type { AppSettings, PaymentMethod } from '@/core/types'
import { db } from '@/db/schema'
import { format, formatDistanceToNow } from 'date-fns'

// ─── Section Header ───────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold text-3 uppercase tracking-widest px-1 mt-2 mb-1">{children}</p>
}

// ─── Toggle Row ───────────────────────────────────────────────────────
function ToggleRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 px-4">
      <div>
        <p className="text-sm font-medium text-1">{label}</p>
        {sub && <p className="text-xs text-2">{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn('relative w-11 h-6 rounded-full transition-colors tap', value ? 'bg-brand' : 'bg-card3')}
      >
        <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow', value ? 'translate-x-5' : 'translate-x-0')} />
      </button>
    </div>
  )
}

function Row({ icon, label, sub, value, onClick }: { icon?: React.ReactNode; label: string; sub?: string; value?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 py-3 px-4 w-full tap hover:bg-card2 transition-colors text-left">
      {icon && <span className="text-2">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-1">{label}</p>
        {sub && <p className="text-xs text-2">{sub}</p>}
      </div>
      {value && <span className="text-xs text-3">{value}</span>}
      {onClick && <ChevronRight size={15} className="text-3 shrink-0" />}
    </button>
  )
}

export function SettingsPage() {
  const { canInstall, installed, install, iosPrompt, setIosPrompt } = usePwaInstall()
  const { settings, updateSettings } = useSettingsStore()
  const { categories, addCategory, deleteCategory } = useCategoryStore()
  const { budgets, addBudget, deleteBudget } = useBudgetStore()
  const { load: reloadExpenses } = useExpenseStore()
  const {
    enabled: syncEnabled,
    autoSync,
    status: syncStatus,
    lastSyncAt,
    user: syncUser,
    error: syncError,
    connect: connectSync,
    disconnect: disconnectSync,
    syncNow,
    pullAndRestore,
    deleteRemote,
    setAutoSync,
  } = useSyncStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const [budgetModal, setBudgetModal] = useState(false)
  const [categoryModal, setCategoryModal] = useState(false)
  const [_exportLoading, setExportLoading] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [restoreConfirm, setRestoreConfirm] = useState(false)
  const [deleteCloudConfirm, setDeleteCloudConfirm] = useState(false)

  const setTheme = (theme: AppSettings['theme']) => {
    updateSettings({ theme })
    applyTheme(theme)
  }

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const data = await backupQueries.exportAll()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `expenses-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Data exported!')
    } catch { toast.error('Export failed') }
    setExportLoading(false)
  }

  const handleExportCSV = async () => {
    try {
      const { expenses } = await backupQueries.exportAll()
      const rows = [
        ['Date', 'Type', 'Amount', 'Currency', 'Category', 'Payment', 'Notes', 'Recurring'],
        ...expenses.map(e => {
          const cat = categories.find(c => c.id === e.categoryId)
          return [
            format(new Date(e.date), 'yyyy-MM-dd HH:mm'),
            e.type ?? 'expense',
            e.amount.toFixed(2),
            e.currency,
            cat?.name ?? '',
            e.paymentMethod,
            e.notes ?? '',
            e.isRecurring ? 'Yes' : 'No',
          ]
        })
      ]
      const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV exported!')
    } catch { toast.error('CSV export failed') }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement & { value: string }>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data.expenses) throw new Error('Invalid backup file')
      await backupQueries.importAll(data)
      await reloadExpenses()
      toast.success(`Imported ${data.expenses.length} expenses!`)
    } catch { toast.error('Import failed — invalid file') }
    e.target.value = ''
  }

  const handleClearData = async () => {
    await db.expenses.clear()
    await db.groups.clear()
    await db.groupExpenses.clear()
    await db.budgets.clear()
    await db.tags.clear()
    await reloadExpenses()
    toast.success('All data cleared')
    setClearConfirm(false)
  }

  const overallBudget = budgets.find(b => !b.categoryId && b.period === 'monthly')

  return (
    <div className="flex flex-col min-h-full bg-base">
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #2a1860 0%, #16123a 60%)' }} className="px-4 pt-safe pb-5">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(200,195,240,0.6)' }}>App</p>
        <h1 className="text-2xl font-bold" style={{ color: '#f0eeff' }}>Settings</h1>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-1 mt-4 pb-28">

        {/* Appearance */}
        <SectionLabel>Appearance</SectionLabel>
        <Card padding="none">
          <div className="p-4">
            <p className="text-sm font-medium text-1 mb-3">Theme</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'dark', label: 'Dark', icon: <Moon size={16} /> },
                { value: 'light', label: 'Light', icon: <Sun size={16} /> },
                { value: 'system', label: 'System', icon: <Monitor size={16} /> },
              ] as const).map(t => (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-xs font-medium transition-all tap',
                    settings.theme === t.value ? 'grad-brand text-white' : 'bg-card2 text-2'
                  )}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-ui" />
          <ToggleRow label="Compact mode" sub="Denser expense list" value={settings.compactMode} onChange={v => updateSettings({ compactMode: v })} />
          <div className="border-t border-ui" />
          <ToggleRow label="Show cents" sub="Show decimal values" value={settings.showCents} onChange={v => updateSettings({ showCents: v })} />
        </Card>

        {/* Preferences */}
        <SectionLabel>Preferences</SectionLabel>
        <Card padding="none">
          <div className="p-4">
            <Select
              label="Default currency"
              options={CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol} ${c.name} (${c.code})` }))}
              value={settings.defaultCurrency}
              onChange={e => updateSettings({ defaultCurrency: e.target.value })}
            />
          </div>
          <div className="border-t border-ui" />
          <div className="p-4">
            <Select
              label="Default payment method"
              options={Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              value={settings.defaultPaymentMethod}
              onChange={e => updateSettings({ defaultPaymentMethod: e.target.value as PaymentMethod })}
            />
          </div>
          <div className="border-t border-ui" />
          <div className="p-4">
            <Select
              label="Week starts on"
              options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]}
              value={settings.firstDayOfWeek.toString()}
              onChange={e => updateSettings({ firstDayOfWeek: parseInt(e.target.value) as 0 | 1 })}
            />
          </div>
        </Card>

        {/* Budget */}
        <SectionLabel>Budget</SectionLabel>
        <Card padding="none">
          <Row
            icon={<DollarSign size={17} />}
            label="Monthly budget"
            sub={overallBudget ? `${formatCurrency(overallBudget.amount, settings.defaultCurrency)} / month` : 'Not set'}
            value={overallBudget ? 'Edit' : 'Set'}
            onClick={() => setBudgetModal(true)}
          />
        </Card>

        {/* Categories */}
        <SectionLabel>Categories</SectionLabel>
        <Card padding="none">
          <Row icon={<Tag size={17} />} label="Manage categories" sub={`${categories.length} categories`} onClick={() => setCategoryModal(true)} />
        </Card>

        {/* Cloud Sync */}
        <SectionLabel>Cloud Sync</SectionLabel>
        <Card padding="none">
          {syncEnabled ? (
            <>
              {/* Connected user row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {syncUser?.picture ? (
                  <img src={syncUser.picture} alt="" className="w-9 h-9 rounded-full shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-brand/20 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-brand">{syncUser?.name?.[0] ?? 'G'}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-1 truncate">{syncUser?.name ?? 'Google Account'}</p>
                  <p className="text-xs text-2 truncate">{syncUser?.email}</p>
                </div>
                <SyncStatusPill status={syncStatus} />
              </div>

              {syncError && (
                <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-expense/10 px-3 py-2">
                  <AlertCircle size={13} className="text-expense shrink-0" />
                  <p className="text-xs text-expense">{syncError}</p>
                </div>
              )}

              <div className="border-t border-ui" />
              <ToggleRow
                label="Auto-sync"
                sub="Push changes automatically (2 s delay)"
                value={autoSync}
                onChange={setAutoSync}
              />
              <div className="border-t border-ui" />
              <Row
                icon={<RefreshCw size={17} />}
                label="Sync now"
                sub={lastSyncAt ? `Last synced ${formatDistanceToNow(lastSyncAt, { addSuffix: true })}` : 'Never synced'}
                onClick={async () => { await syncNow(); toast.success('Synced to Google Drive') }}
              />
              <div className="border-t border-ui" />
              <Row
                icon={<CloudDownload size={17} />}
                label="Restore from cloud"
                sub="Replace local data with your Drive backup"
                onClick={() => setRestoreConfirm(true)}
              />
              <div className="border-t border-ui" />
              <Row
                icon={<Trash2 size={17} />}
                label="Delete cloud backup"
                sub="Remove the backup file from Google Drive"
                onClick={() => setDeleteCloudConfirm(true)}
              />
              <div className="border-t border-ui" />
              <Row
                icon={<LogOut size={17} />}
                label="Disconnect Google Drive"
                sub="Your local data is kept"
                onClick={() => { disconnectSync(); toast.success('Disconnected') }}
              />
            </>
          ) : (
            <div className="p-4">
              <p className="text-sm text-2 mb-1">Automatically back up your expenses to your own Google Drive.</p>
              <p className="text-xs text-3 mb-4">Data is stored privately in your account — no one else can access it.</p>
              <Button
                fullWidth
                loading={syncStatus === 'syncing'}
                onClick={async () => {
                  try { await connectSync() }
                  catch { /* error shown in store */ }
                }}
              >
                <CloudOff size={15} /> Connect Google Drive
              </Button>
              {syncError && <p className="text-xs text-expense mt-2 text-center">{syncError}</p>}
            </div>
          )}
        </Card>

        {/* Data */}
        <SectionLabel>Data & Backup</SectionLabel>
        <Card padding="none">
          <Row icon={<Download size={17} />} label="Export JSON backup" sub="Full data backup" onClick={handleExport} />
          <div className="border-t border-ui" />
          <Row icon={<Download size={17} />} label="Export as CSV" sub="For spreadsheets" onClick={handleExportCSV} />
          <div className="border-t border-ui" />
          <Row icon={<Upload size={17} />} label="Import backup" sub="Restore from JSON" onClick={() => fileRef.current?.click()} />
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <div className="border-t border-ui" />
          <Row icon={<Trash2 size={17} />} label="Clear local data" sub="Removes data from this browser only" onClick={() => setClearConfirm(true)} />
        </Card>

        {/* Install App */}
        {canInstall && !installed && (
          <button
            onClick={install}
            className="flex items-center gap-3 w-full py-3 px-4 rounded-2xl tap transition-all"
            style={{ background: 'linear-gradient(135deg,rgba(124,92,252,0.15),rgba(168,85,247,0.1))', border: '1px solid rgba(124,92,252,0.3)' }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#7c5cfc,#a855f7)' }}>
              <Smartphone size={17} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold" style={{ color: '#c8c3f0' }}>Install App</p>
              <p className="text-xs" style={{ color: 'rgba(200,195,240,0.5)' }}>Add to Home Screen for offline use</p>
            </div>
          </button>
        )}

        {/* iOS install instructions modal */}
        <Modal open={iosPrompt} onClose={() => setIosPrompt(false)} title="Add to Home Screen" size="sm">
          <div className="p-5 flex flex-col gap-4 pb-6 text-sm text-2">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">1.</span>
                <p>Tap the <strong className="text-1">Share</strong> button <span className="text-base">⬆</span> at the bottom of Safari</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">2.</span>
                <p>Scroll down and tap <strong className="text-1">"Add to Home Screen"</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">3.</span>
                <p>Tap <strong className="text-1">Add</strong> — the app will appear on your home screen</p>
              </div>
            </div>
            <button onClick={() => setIosPrompt(false)} className="btn btn-brand w-full py-3.5 text-sm mt-1">Got it</button>
          </div>
        </Modal>

        {(() => {
          const d = new Date(__BUILD_TIME__)
          const v = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}.${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`
          return (
            <p className="text-center text-xs text-3 mt-4 mb-2">
              SR Expense · <span className="font-mono">{v}</span> · All data stored locally
            </p>
          )
        })()}
      </div>

      {/* Budget Modal */}
      <Modal open={budgetModal} onClose={() => setBudgetModal(false)} title="Monthly Budget" size="sm">
        <BudgetForm
          existing={overallBudget}
          currency={settings.defaultCurrency}
          onSave={async (amount) => {
            if (overallBudget) await deleteBudget(overallBudget.id)
            await addBudget({ categoryId: undefined, amount, currency: settings.defaultCurrency, period: 'monthly', startDate: Date.now() })
            toast.success('Budget saved')
            setBudgetModal(false)
          }}
          onDelete={overallBudget ? async () => { await deleteBudget(overallBudget.id); toast.success('Budget removed'); setBudgetModal(false) } : undefined}
          onClose={() => setBudgetModal(false)}
        />
      </Modal>

      {/* Category Modal */}
      <Modal open={categoryModal} onClose={() => setCategoryModal(false)} title="Categories">
        <CategoryManager categories={categories} onAdd={addCategory} onDelete={deleteCategory} onClose={() => setCategoryModal(false)} />
      </Modal>

      {/* Clear confirm */}
      <Modal open={clearConfirm} onClose={() => setClearConfirm(false)} title="Clear Local Data?" size="sm">
        <div className="p-4">
          <p className="text-sm text-2 mb-4">This removes all expenses, groups, and budgets from <strong>this browser only</strong>. Your Google Drive backup (if any) is not affected.</p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setClearConfirm(false)} className="flex-1">Cancel</Button>
            <Button variant="danger" onClick={handleClearData} className="flex-1">Clear Everything</Button>
          </div>
        </div>
      </Modal>

      {/* Restore from Drive confirm */}
      <Modal open={restoreConfirm} onClose={() => setRestoreConfirm(false)} title="Restore from Google Drive?" size="sm">
        <div className="p-4">
          <p className="text-sm text-2 mb-4">
            This will replace all your local data with the backup stored in Google Drive.
            Your current local data will be lost.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setRestoreConfirm(false)} className="flex-1">Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                setRestoreConfirm(false)
                await pullAndRestore()
                await reloadExpenses()
                toast.success('Restored from Google Drive!')
              }}
              className="flex-1"
            >
              Restore
            </Button>
          </div>
        </div>
      </Modal>
      {/* Delete cloud backup confirm */}
      <Modal open={deleteCloudConfirm} onClose={() => setDeleteCloudConfirm(false)} title="Delete Cloud Backup?" size="sm">
        <div className="p-4">
          <p className="text-sm text-2 mb-4">
            This permanently deletes the backup file from Google Drive.
            Your <strong>local data is not affected</strong>.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setDeleteCloudConfirm(false)} className="flex-1">Cancel</Button>
            <Button
              variant="danger"
              onClick={async () => {
                setDeleteCloudConfirm(false)
                await deleteRemote()
                toast.success('Cloud backup deleted')
              }}
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Sync Status Pill ────────────────────────────────────────────────
function SyncStatusPill({ status }: { status: import('@/store/useSyncStore').SyncStatus }) {
  if (status === 'syncing') return (
    <span className="flex items-center gap-1 text-xs text-brand">
      <Loader2 size={12} className="animate-spin" /> Syncing
    </span>
  )
  if (status === 'success') return (
    <span className="flex items-center gap-1 text-xs text-income">
      <CheckCircle2 size={12} /> Synced
    </span>
  )
  if (status === 'error') return (
    <span className="flex items-center gap-1 text-xs text-expense">
      <AlertCircle size={12} /> Error
    </span>
  )
  return <span className="text-xs text-3">Connected</span>
}

// ─── Budget Form ─────────────────────────────────────────────────────
function BudgetForm({ existing, onSave, onDelete, onClose }: {
  existing?: { amount: number } | undefined
  currency?: string
  onSave: (amount: number) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}) {
  const [amount, setAmount] = useState(existing?.amount.toString() ?? '')
  const [loading, setLoading] = useState(false)

  return (
    <div className="p-4 flex flex-col gap-4 pb-6">
      <input
        type="number"
        placeholder="0"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        className="input text-3xl font-bold text-center"
        style={{ height: 64 }}
      />
      <p className="text-xs text-2 text-center">Set your monthly spending limit. You'll see progress on the dashboard.</p>
      <div className="flex gap-3">
        {onDelete && <Button variant="danger" onClick={onDelete} size="sm">Remove</Button>}
        <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
        <Button loading={loading} onClick={async () => {
          const n = parseFloat(amount)
          if (isNaN(n) || n <= 0) return
          setLoading(true)
          await onSave(n)
        }} className="flex-1">Save</Button>
      </div>
    </div>
  )
}

// ─── Category Manager ────────────────────────────────────────────────
function CategoryManager({ categories, onAdd, onDelete }: {
  categories: import('@/core/types').Category[]
  onAdd: (data: Omit<import('@/core/types').Category, 'id' | 'createdAt'>) => Promise<import('@/core/types').Category>
  onDelete: (id: string) => Promise<void>
  onClose?: () => void
}) {
  const EMOJI_COLORS = ['#7c5cfc', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4', '#ef4444', '#f97316', '#8b5cf6']
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📦')
  const [color, setColor] = useState(EMOJI_COLORS[0])
  const [parentId, setParentId] = useState<string>('')

  const parentCategories = categories.filter(c => !c.parentId)
  const subCategories = categories.filter(c => !!c.parentId)

  return (
    <div className="flex flex-col pb-4">
      {/* Add new */}
      <div className="p-4 border-b border-ui">
        <p className="text-xs font-bold text-3 uppercase tracking-wider mb-3">Add category</p>
        <div className="flex gap-2 mb-2">
          <input placeholder="📦" value={icon} onChange={e => setIcon(e.target.value)} className="input w-14 text-center text-xl" />
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="input flex-1 text-sm" />
        </div>
        {/* Parent selector */}
        <select
          value={parentId}
          onChange={e => setParentId(e.target.value)}
          className="input text-sm w-full mb-2"
        >
          <option value="">Top-level category</option>
          {parentCategories.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.name} (subcategory of)</option>
          ))}
        </select>
        <div className="flex gap-2 mb-3">
          {EMOJI_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn('w-5 h-5 rounded-full tap transition-all', color === c && 'ring-2 ring-offset-1 ring-white')}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <Button fullWidth size="sm" onClick={async () => {
          if (!name.trim()) return
          await onAdd({ name: name.trim(), icon, color, parentId: parentId || undefined, isDefault: false })
          setName(''); setIcon('📦'); setParentId('')
          toast.success(parentId ? 'Subcategory added' : 'Category added')
        }}>
          <PlusCircle size={15} /> Add
        </Button>
      </div>

      {/* List — parent categories with their subcategories */}
      <div>
        {parentCategories.map(cat => {
          const subs = subCategories.filter(s => s.parentId === cat.id)
          return (
            <div key={cat.id}>
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-ui">
                <div className="w-8 h-8 icon-circle text-base shrink-0" style={{ backgroundColor: `${cat.color}20`, borderRadius: '0.75rem' }}>
                  <span>{cat.icon}</span>
                </div>
                <span className="text-sm font-semibold text-1 flex-1">{cat.name}</span>
                {cat.isDefault ? (
                  <span className="text-[10px] text-3 px-1.5 py-0.5 rounded bg-card2">default</span>
                ) : (
                  <button onClick={() => onDelete(cat.id)} className="text-expense tap p-1 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {subs.map(sub => (
                <div key={sub.id} className="flex items-center gap-3 pl-10 pr-4 py-2 border-b border-ui" style={{ background: 'var(--bg-card2)' }}>
                  <div className="w-6 h-6 icon-circle text-sm shrink-0" style={{ backgroundColor: `${sub.color}20`, borderRadius: '0.5rem' }}>
                    <span>{sub.icon}</span>
                  </div>
                  <span className="text-sm text-2 flex-1">{sub.name}</span>
                  <button onClick={() => onDelete(sub.id)} className="text-expense tap p-1 rounded-lg">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
