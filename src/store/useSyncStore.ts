import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  signIn,
  signOut,
  getStoredUser,
  pushToDrive,
  pullFromDrive,
  deleteFromDrive,
  type GoogleUser,
} from '@/services/googleSync'
import { backupQueries } from '@/db/queries'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

interface SyncState {
  enabled: boolean
  autoSync: boolean
  status: SyncStatus
  lastSyncAt: number | null
  user: GoogleUser | null
  error: string | null

  // Actions
  connect: () => Promise<void>
  disconnect: () => void
  syncNow: () => Promise<void>
  pullAndRestore: () => Promise<void>
  setAutoSync: (v: boolean) => void
  deleteRemote: () => Promise<void>
  /**
   * Bidirectional merge sync: pulls cloud data, merges it into local (never
   * replaces), then pushes the merged result back. Safe across multiple
   * devices and login/logout cycles — no data is ever lost.
   */
  smartSync: (reloadExpenses: () => Promise<void>) => Promise<void>
  /** Call after any write — debounces a push by 2 s if autoSync is on. */
  scheduleSync: () => void
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      enabled: false,
      autoSync: true,
      status: 'idle',
      lastSyncAt: null,
      user: getStoredUser(),
      error: null,

      connect: async () => {
        set({ status: 'syncing', error: null })
        try {
          const user = await signIn()
          set({ enabled: true, user, status: 'idle', error: null })
          // Pull from cloud first and merge — ensures a new device gets all old
          // records from Drive without overwriting any unsaved local data.
          const cloud = await pullFromDrive()
          if (cloud) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await backupQueries.mergeAll(cloud as any)
          }
          // Push the merged (or current) state back to cloud
          await get().syncNow()
        } catch (e) {
          set({ status: 'error', error: (e as Error).message })
        }
      },

      disconnect: () => {
        signOut()
        if (_debounceTimer) clearTimeout(_debounceTimer)
        set({ enabled: false, user: null, status: 'idle', error: null, lastSyncAt: null })
      },

      syncNow: async () => {
        if (!get().enabled) return
        set({ status: 'syncing', error: null })
        try {
          const data = await backupQueries.exportAll()
          await pushToDrive(data)
          set({ status: 'success', lastSyncAt: Date.now(), error: null })
        } catch (e) {
          set({ status: 'error', error: (e as Error).message })
        }
      },

      pullAndRestore: async () => {
        if (!get().enabled) return
        set({ status: 'syncing', error: null })
        try {
          const data = await pullFromDrive()
          if (data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await backupQueries.importAll(data as any)
            set({ status: 'success', lastSyncAt: Date.now(), error: null })
          } else {
            set({ status: 'idle', error: 'No backup found in Google Drive.' })
          }
        } catch (e) {
          set({ status: 'error', error: (e as Error).message })
        }
      },

      smartSync: async (reloadExpenses) => {
        if (!get().enabled) return
        set({ status: 'syncing', error: null })
        try {
          const cloud = await pullFromDrive() as { exportedAt?: number } | null

          if (cloud) {
            // Always merge — never replace. This preserves all local offline
            // changes regardless of which side has the newer exportedAt stamp.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await backupQueries.mergeAll(cloud as any)
            await reloadExpenses()
          }

          // Push the merged (or current local) state back so all devices converge
          const data = await backupQueries.exportAll()
          await pushToDrive(data)
          set({ status: 'success', lastSyncAt: Date.now(), error: null })
        } catch (e) {
          set({ status: 'error', error: (e as Error).message })
        }
      },

      deleteRemote: async () => {
        set({ status: 'syncing', error: null })
        try {
          await deleteFromDrive()
          set({ status: 'idle', lastSyncAt: null, error: null })
        } catch (e) {
          set({ status: 'error', error: (e as Error).message })
        }
      },

      setAutoSync: (autoSync) => set({ autoSync }),

      scheduleSync: () => {
        const { enabled, autoSync } = get()
        if (!enabled || !autoSync) return
        if (_debounceTimer) clearTimeout(_debounceTimer)
        _debounceTimer = setTimeout(() => {
          get().syncNow()
        }, 2000)
      },
    }),
    {
      name: 'expense-sync',
      // Only persist flags + timestamp; user comes from localStorage via getStoredUser()
      partialize: (s) => ({
        enabled: s.enabled,
        autoSync: s.autoSync,
        lastSyncAt: s.lastSyncAt,
      }),
    },
  ),
)
