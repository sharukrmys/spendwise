// ─── Google Drive Sync Service ──────────────────────────────────────────────
// Stores a single JSON backup in the user's Google Drive "App Data Folder".
// Shared groups are stored in regular Drive files, accessed via drive.file
// scope + Google Picker — see note below.
//
// OAuth flow: Google Identity Services (GIS) Token Client — the recommended
// approach for SPAs. Loads the GIS script lazily at runtime.
// Scopes: drive.appdata (private backup) + drive.file (shared groups) + profile
//
// Why drive.file + Picker instead of full `drive` scope: `drive.file` only
// grants an app access to files the SAME account created or explicitly
// opened — it does not extend to other accounts, even with "anyone with the
// link" permission set. The full `drive` scope would fix that, but it's a
// Google "sensitive scope" that triggers the scary "Google hasn't verified
// this app" warning and a 100-user cap until formally verified. Google's
// sanctioned alternative is: share the file with each member's specific
// email (so it's visible to them), then have them "open" it once via Google
// Picker — that single open grants this app per-file drive.file access to
// it, permanently, without ever requesting the sensitive scope.
//
// Setup: set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY in .env.local
// Google Cloud Console: add your app URL to Authorized JavaScript origins,
// and enable the Google Picker API for the API key.
// ────────────────────────────────────────────────────────────────────────────

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined
// drive.appdata → private personal-backup folder (invisible in Drive UI, per-account only)
// drive.file    → per-file access to shared group files — see note above for how
//                 other members get access without the sensitive full `drive` scope
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

interface PickerDocument {
  id: string
  name: string
}

interface PickerResponse {
  action: string
  docs?: PickerDocument[]
}

interface PickerView {
  setOwnedByMe(v: boolean): PickerView
  setIncludeFolders(v: boolean): PickerView
  setMimeTypes(v: string): PickerView
}

interface PickerInstance {
  setVisible(v: boolean): void
}

interface PickerBuilder {
  addView(view: PickerView): PickerBuilder
  setOAuthToken(token: string): PickerBuilder
  setDeveloperKey(key: string): PickerBuilder
  setCallback(cb: (data: PickerResponse) => void): PickerBuilder
  setTitle(title: string): PickerBuilder
  build(): PickerInstance
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
      picker: {
        ViewId: { DOCS: string }
        Action: { PICKED: string; CANCEL: string }
        DocsView: new (viewId?: string) => PickerView
        PickerBuilder: new () => PickerBuilder
      }
    }
    gapi?: {
      load(mod: string, cb: () => void): void
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

// ─── Load Google Picker lazily ────────────────────────────────────────────────

let _pickerReady: Promise<void> | null = null
function loadPicker(): Promise<void> {
  if (_pickerReady) return _pickerReady
  _pickerReady = new Promise((resolve, reject) => {
    const loadPickerModule = () => window.gapi!.load('picker', () => resolve())
    if (window.gapi?.load) { loadPickerModule(); return }
    const existing = document.querySelector('script[src*="apis.google.com/js/api.js"]')
    if (existing) {
      existing.addEventListener('load', loadPickerModule)
      existing.addEventListener('error', () => reject(new Error('Failed to load Google API script')))
      return
    }
    const s = document.createElement('script')
    s.src = 'https://apis.google.com/js/api.js'
    s.async = true
    s.onload = loadPickerModule
    s.onerror = () => reject(new Error('Failed to load Google API script'))
    document.head.appendChild(s)
  })
  return _pickerReady
}

// ─── OAuth via GIS Token Client ───────────────────────────────────────────────
// GIS manages the popup internally. After user grants consent, the popup closes
// and GIS delivers the token via postMessage → our `callback` fires.
// `error_callback` with popup_closed can fire WHILE the token postMessage is
// still in-flight, so we ignore it and rely on `callback` + a timeout instead.

// prompt='' → silent re-auth using existing Google session (no popup if already consented)
// prompt='select_account consent' → explicit sign-in with account picker + consent screen
function requestNewToken(prompt = ''): Promise<string> {
  return new Promise(async (resolve, reject) => {
    if (!CLIENT_ID) {
      reject(new Error('VITE_GOOGLE_CLIENT_ID is not set in .env.local'))
      return
    }
    try { await loadGIS() } catch (e) { reject(e); return }

    let done = false

    // Silent refresh resolves quickly; explicit sign-in can take longer
    const timeoutMs = prompt === '' ? 10_000 : 60_000
    const timeout = setTimeout(() => {
      if (done) return
      done = true
      reject(new Error(prompt === '' ? 'silent_refresh_failed' : 'Sign-in timed out — please try again.'))
    }, timeoutMs)

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
      error_callback: (err) => {
        if (err.type === 'popup_failed_to_open') {
          if (done) return
          done = true
          clearTimeout(timeout)
          reject(new Error('Popup was blocked — please allow popups for this site.'))
        }
      },
    })

    client.requestAccessToken({ prompt })
  })
}

// No-op export kept so App.tsx import compiles (redirect flow removed).
export function handleOAuthCallback(): boolean { return false }

async function getToken(): Promise<string> {
  loadCachedToken()
  if (isValid()) return _token!
  // Try silent re-auth first (no popup if user still has an active Google session)
  try {
    return await requestNewToken('')
  } catch (e) {
    // Silent failed (session truly expired / revoked) → fall through to explicit sign-in
    if ((e as Error).message !== 'silent_refresh_failed') throw e
    return requestNewToken('select_account')
  }
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
  const token = await requestNewToken('select_account consent')
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
// Each shared group is a regular Drive file (not appDataFolder), named after
// the group so it's recognizable in Google Picker. The file ID is the
// invite/share code. Two access mechanisms layer on top of each other:
//  1. Named-email `writer` permission for each member with an email set —
//     makes the file show up under that member's "Shared with me".
//  2. "Anyone with the link: writer" as a fallback, so the raw Drive link
//     always works even for members without an email on file.
// Neither alone is enough for a DIFFERENT Google account to read/write the
// file via our drive.file-scoped API calls — the member must also "open" the
// file once via `pickSharedGroupFile` (Google Picker), which is what
// actually grants this app per-file drive.file access to it going forward.

/** Grant a specific Google account write access to a shared group file. Best-effort. */
export async function grantMemberAccess(fileId: string, email: string): Promise<void> {
  const token = await getToken()
  const res = await fetch(`${DRIVE_API}/files/${fileId}/permissions?sendNotificationEmail=false`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: email }),
  })
  if (!res.ok) throw new Error(`Failed to grant access to ${email}: ${res.status}`)
}

/** Create a new shared group file in the user's Drive. Returns the file ID (= share code). */
export async function createSharedGroupFile(
  groupId: string,
  groupName: string,
  data: unknown,
  memberEmails: string[] = [],
): Promise<string> {
  const token = await getToken()
  const boundary = '-------SRGroupBoundary'
  const metadata = JSON.stringify({ name: `SR Expense Group — ${groupName} (${groupId.slice(0, 6)}).json` })
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
    if (createRes.status === 401) {
      clearToken()
      throw new Error('Google session expired — please reconnect Google Drive and try again.')
    }
    throw new Error(`Failed to create shared group file: ${createRes.status}`)
  }
  const file = await createRes.json()
  const fileId: string = file.id

  // Fallback: anyone with the raw link can still write (doesn't by itself grant
  // this app drive.file access for other accounts — see note above).
  const permRes = await fetch(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'writer', type: 'anyone' }),
  })
  if (!permRes.ok) throw new Error(`Failed to set shared group permissions: ${permRes.status}`)

  // Named-email grants — best-effort per member, so one bad email doesn't fail the whole share.
  await Promise.all(
    memberEmails.map((email) => grantMemberAccess(fileId, email).catch((e) => console.error(e))),
  )

  return fileId
}

/**
 * Opens Google Picker so the user can "open" a file shared with them, which
 * grants this app per-file drive.file access to it — required before this
 * app's own API calls (readSharedGroupFile / writeSharedGroupFile) can reach
 * a file it didn't create, regardless of the file's sharing permissions.
 * Resolves true only if the user picked the file matching `expectedFileId`,
 * false if they cancelled or picked something else.
 */
export async function pickSharedGroupFile(expectedFileId: string): Promise<boolean> {
  if (!API_KEY) throw new Error('VITE_GOOGLE_API_KEY is not set — Google Picker needs an API key. See .env.example.')
  const token = await getToken()
  await loadPicker()

  return new Promise((resolve, reject) => {
    try {
      const view = new window.google!.picker.DocsView(window.google!.picker.ViewId.DOCS)
        .setOwnedByMe(false)
        .setIncludeFolders(false)
        .setMimeTypes('application/json')

      const picker = new window.google!.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(API_KEY!)
        .setTitle('Select the shared group file')
        .setCallback((data) => {
          if (data.action === window.google!.picker.Action.PICKED) {
            resolve(data.docs?.[0]?.id === expectedFileId)
          } else if (data.action === window.google!.picker.Action.CANCEL) {
            resolve(false)
          }
        })
        .build()
      picker.setVisible(true)
    } catch (e) {
      reject(e)
    }
  })
}

/** Read a shared group file. The caller must have already opened it via `pickSharedGroupFile` (or created it). */
export async function readSharedGroupFile(fileId: string): Promise<unknown | null> {
  const token = await getToken()
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    clearToken()
    throw new Error('Google session expired — please reconnect Google Drive and try again.')
  }
  if (res.status === 403 || res.status === 404) {
    // Drive returns 404 (not 403) when this account has zero access grant to the
    // file at all — expected until the member has opened it once via Picker.
    throw new Error('Could not open that shared group yet. Select it in the picker dialog to grant access, then try again. If it never shows up, ask the owner to add your Google email to the group and re-share.')
  }
  if (!res.ok) {
    throw new Error(`Could not reach Google Drive (error ${res.status}). Check your connection and try again.`)
  }
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
  if (res.status === 401) {
    clearToken()
    throw new Error('Google session expired — please reconnect Google Drive and try again.')
  }
  if (res.status === 403 || res.status === 404) {
    throw new Error('Could not sync this shared group — this device may have lost access. Open the group\'s invite code again to re-grant access via the picker.')
  }
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
