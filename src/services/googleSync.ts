// ─── Google Drive Sync Service ──────────────────────────────────────────────
// Stores a single JSON backup in the user's Google Drive "App Data Folder".
// Shared groups are stored in regular Drive files (drive.file scope).
//
// OAuth flow: Google Identity Services (GIS) Token Client — the recommended
// approach for SPAs. Loads the GIS script lazily at runtime.
// Scopes: drive.appdata (private backup) + drive.file (shared groups) + profile
//
// Setup: set VITE_GOOGLE_CLIENT_ID in .env.local
// Google Cloud Console: add your app URL to Authorized JavaScript origins only.
// ────────────────────────────────────────────────────────────────────────────

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
// drive.appdata  → private backup folder (invisible in Drive UI)
// drive.file     → create/edit regular Drive files for shared groups
const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
  'openid email profile',
].join(' ')
const BACKUP_FILE_NAME = 'expense-backup.json'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GoogleUser {
  name: string
  email: string
  picture: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (resp: { access_token: string; expires_in: number; error?: string }) => void
            error_callback?: (err: { type: string }) => void
          }): { requestAccessToken(opts?: { prompt?: string }): void }
          revoke(token: string, done: () => void): void
        }
      }
    }
  }
}

// ─── Token Management ────────────────────────────────────────────────────────

const TOKEN_KEY = 'gd_token'
const TOKEN_EXPIRY_KEY = 'gd_token_expiry'
const USER_KEY = 'gd_user'

let _token: string | null = null
let _expiry: number = 0

function isValid(): boolean {
  return !!_token && Date.now() < _expiry - 60_000
}

function storeToken(token: string, expiresIn: number) {
  _token = token
  _expiry = Date.now() + expiresIn * 1000
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(_expiry))
}

function loadCachedToken() {
  if (_token) return
  const t = localStorage.getItem(TOKEN_KEY)
  const exp = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) ?? '0', 10)
  if (t && Date.now() < exp - 60_000) {
    _token = t
    _expiry = exp
  }
}

export function clearToken() {
  _token = null
  _expiry = 0
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
}

// ─── Load GIS lazily ─────────────────────────────────────────────────────────

function loadGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return }
    const existing = document.querySelector('script[src*="accounts.google.com/gsi"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('GIS load failed')))
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(s)
  })
}

// ─── OAuth via GIS Token Client ───────────────────────────────────────────────
// GIS manages the popup internally. After user grants consent, the popup closes
// and GIS delivers the token via postMessage → our `callback` fires.
// `error_callback` with popup_closed can fire WHILE the token postMessage is
// still in-flight, so we ignore it and rely on `callback` + a timeout instead.

function requestNewToken(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    if (!CLIENT_ID) {
      reject(new Error('VITE_GOOGLE_CLIENT_ID is not set in .env.local'))
      return
    }
    try { await loadGIS() } catch (e) { reject(e); return }

    let done = false

    const timeout = setTimeout(() => {
      if (done) return
      done = true
      reject(new Error('Sign-in timed out — please try again.'))
    }, 60_000)

    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (done) return
        done = true
        clearTimeout(timeout)
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? 'Google OAuth failed'))
          return
        }
        storeToken(resp.access_token, resp.expires_in)
        resolve(resp.access_token)
      },
      // Only handle popup_failed_to_open (blocked) — ignore popup_closed
      // since that fires normally when popup closes after successful auth.
      error_callback: (err) => {
        if (err.type === 'popup_failed_to_open') {
          if (done) return
          done = true
          clearTimeout(timeout)
          reject(new Error('Popup was blocked — please allow popups for this site.'))
        }
        // popup_closed: intentionally not rejected here.
        // The token callback fires after popup closes in a successful flow.
        // If it never arrives, the 60s timeout above will catch it.
      },
    })

    client.requestAccessToken({ prompt: 'select_account consent' })
  })
}

// No-op export kept so App.tsx import compiles (redirect flow removed).
export function handleOAuthCallback(): boolean { return false }

async function getToken(): Promise<string> {
  loadCachedToken()
  if (isValid()) return _token!
  return requestNewToken()
}

// ─── Drive REST helpers ──────────────────────────────────────────────────────

async function driveGet(path: string): Promise<Response> {
  const token = await getToken()
  const res = await fetch(`${DRIVE_API}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    clearToken()
    throw new Error('Google session expired — please reconnect.')
  }
  return res
}

async function driveUpload(
  method: 'POST' | 'PATCH',
  _path: string,
  body: string,
  fileId?: string,
): Promise<void> {
  const token = await getToken()

  if (fileId) {
    // Simple media upload to update existing file
    const res = await fetch(`${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    })
    if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`)
    return
  }

  // Multipart upload to create new file in appDataFolder
  const boundary = '-------ExpenseManagerBoundary'
  const metadata = JSON.stringify({ name: BACKUP_FILE_NAME, parents: ['appDataFolder'] })
  const multipart = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}`,
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}`,
    `\r\n--${boundary}--`,
  ].join('')

  const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body: multipart,
  })
  if (!res.ok) throw new Error(`Drive create failed: ${res.status}`)
}

// ─── Find the backup file in appDataFolder ───────────────────────────────────

async function findBackupFileId(): Promise<string | null> {
  const res = await driveGet(
    `files?spaces=appDataFolder&q=name%3D'${BACKUP_FILE_NAME}'&fields=files(id)`,
  )
  if (!res.ok) return null
  const data = await res.json()
  return (data.files as { id: string }[])?.[0]?.id ?? null
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Trigger OAuth popup, return signed-in user. */
export async function signIn(): Promise<GoogleUser> {
  const token = await requestNewToken()
  const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!infoRes.ok) throw new Error('Failed to fetch Google profile')
  const info = await infoRes.json()
  const user: GoogleUser = { name: info.name, email: info.email, picture: info.picture }
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}

/** Revoke token and clear all stored credentials. */
export function signOut(): void {
  if (_token) {
    // Fire-and-forget revocation — don't block UI on network call
    fetch(`https://oauth2.googleapis.com/revoke?token=${_token}`, { method: 'POST' }).catch(() => {})
  }
  clearToken()
  localStorage.removeItem(USER_KEY)
}

/** Return previously saved user profile (no network call). */
export function getStoredUser(): GoogleUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as GoogleUser) : null
  } catch {
    return null
  }
}

/** Push full backup JSON to Google Drive appDataFolder. */
export async function pushToDrive(data: unknown): Promise<void> {
  const body = JSON.stringify(data)
  const existingId = await findBackupFileId()
  await driveUpload(existingId ? 'PATCH' : 'POST', 'files', body, existingId ?? undefined)
}

/** Pull the latest backup JSON from Google Drive, or null if none exists. */
export async function pullFromDrive(): Promise<unknown | null> {
  const fileId = await findBackupFileId()
  if (!fileId) return null
  const res = await driveGet(`files/${fileId}?alt=media`)
  if (!res.ok) return null
  return res.json()
}

// ─── Shared Group Drive Files ────────────────────────────────────────────────
// Each shared group is a regular Drive file (not appDataFolder) with
// "anyone with link can write" permission. The file ID is the invite/share code.
// Any member who has signed in to their own Google account can read & write it.

/** Create a new shared group file in the user's Drive. Returns the file ID (= share code). */
export async function createSharedGroupFile(groupId: string, data: unknown): Promise<string> {
  const token = await getToken()
  const boundary = '-------SRGroupBoundary'
  const metadata = JSON.stringify({ name: `sr-group-${groupId}.json` })
  const body = JSON.stringify(data)
  const multipart = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}`,
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}`,
    `\r\n--${boundary}--`,
  ].join('')

  const createRes = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body: multipart,
  })
  if (!createRes.ok) {
    if (createRes.status === 403) {
      // The cached token predates the drive.file scope. Force fresh consent.
      clearToken()
      throw new Error('Drive permission upgrade required. Please disconnect and reconnect Google Drive in Settings, then try again.')
    }
    throw new Error(`Failed to create shared group file: ${createRes.status}`)
  }
  const file = await createRes.json()
  const fileId: string = file.id

  // Grant write access to anyone with the link
  const permRes = await fetch(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'writer', type: 'anyone' }),
  })
  if (!permRes.ok) throw new Error(`Failed to set shared group permissions: ${permRes.status}`)

  return fileId
}

/** Read a shared group file. Requires the caller to be signed in to any Google account. */
export async function readSharedGroupFile(fileId: string): Promise<unknown | null> {
  const token = await getToken()
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

/** Overwrite a shared group file with new data. */
export async function writeSharedGroupFile(fileId: string, data: unknown): Promise<void> {
  const token = await getToken()
  const res = await fetch(`${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Failed to update shared group file: ${res.status}`)
}

/** Delete a shared group Drive file (owner only). */
export async function deleteSharedGroupFile(fileId: string): Promise<void> {
  const token = await getToken()
  await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

/** Permanently delete the backup file from Google Drive. */
export async function deleteFromDrive(): Promise<void> {
  const fileId = await findBackupFileId()
  if (!fileId) return
  const token = await getToken()
  const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) { clearToken(); throw new Error('Google session expired.') }
  // 204 No Content = success; 404 = already gone — both are fine
}
