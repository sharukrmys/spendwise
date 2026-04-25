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

        if (patch.theme || patch.accentColor) {
          applyTheme(settings.theme, settings.accentColor)
        }
      },

      resetSettings: () => {
        set({ settings: DEFAULT_SETTINGS })
        saveSettings(DEFAULT_SETTINGS).catch(console.error)
        applyTheme(DEFAULT_SETTINGS.theme, DEFAULT_SETTINGS.accentColor)
      },
    }),
    {
      name: 'expense-settings',
      // Only persist to localStorage for instant load, DB is source of truth
      partialize: (state) => ({ settings: state.settings }),
    }
  )
)

const PRESET_CLASSES = ['light', 'theme-amoled', 'theme-midnight', 'theme-forest', 'theme-rose']

export function applyTheme(theme: AppSettings['theme'], accentColor?: string) {
  // Remove all theme classes first
  document.documentElement.classList.remove(...PRESET_CLASSES)

  if (theme === 'light') {
    document.documentElement.classList.add('light')
  } else if (theme === 'amoled') {
    document.documentElement.classList.add('theme-amoled')
  } else if (theme === 'midnight') {
    document.documentElement.classList.add('theme-midnight')
  } else if (theme === 'forest') {
    document.documentElement.classList.add('theme-forest')
  } else if (theme === 'rose') {
    document.documentElement.classList.add('theme-rose')
  } else if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (!isDark) document.documentElement.classList.add('light')
  }
  // 'dark' = default, no class needed

  if (accentColor) {
    document.documentElement.style.setProperty('--brand', accentColor)
  }
}
