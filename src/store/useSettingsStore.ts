import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings } from '@/core/types'
import { DEFAULT_SETTINGS } from '@/core/constants'
import { saveSettings } from '@/db/schema'

interface SettingsState {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
  resetSettings: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,

      updateSettings: (patch) => {
        const settings = { ...get().settings, ...patch }
        set({ settings })
        saveSettings(settings).catch(console.error)

        // Apply theme immediately
        if (patch.theme) applyTheme(patch.theme)
      },

      resetSettings: () => {
        set({ settings: DEFAULT_SETTINGS })
        saveSettings(DEFAULT_SETTINGS).catch(console.error)
        applyTheme(DEFAULT_SETTINGS.theme)
      },
    }),
    {
      name: 'expense-settings',
      // Only persist to localStorage for instant load, DB is source of truth
      partialize: (state) => ({ settings: state.settings }),
    }
  )
)

export function applyTheme(theme: AppSettings['theme']) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('light', !isDark)
}
