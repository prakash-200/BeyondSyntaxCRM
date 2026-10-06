import type { AuthSession } from '@/types'

/**
 * Token storage strategy (frontend demo):
 *  - access token is kept in memory and mirrored to web storage so a page
 *    refresh keeps the session ("Remember me" → localStorage, otherwise
 *    sessionStorage).
 *
 * For production with ASP.NET Core prefer an HttpOnly, Secure, SameSite=Strict
 * cookie for the refresh token (set by the API) and keep only the short-lived
 * access token in memory. If cookie auth is used, add CSRF protection
 * (anti-forgery token header) to state-changing requests.
 */
const KEY = 'tms.session'

let memory: AuthSession | null = null

function read(storage: Storage): AuthSession | null {
  try {
    const raw = storage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    return null
  }
}

export const tokenStore = {
  get(): AuthSession | null {
    if (memory) return memory
    memory = read(localStorage) ?? read(sessionStorage)
    return memory
  },
  set(session: AuthSession, remember: boolean) {
    memory = session
    try {
      const target = remember ? localStorage : sessionStorage
      const other = remember ? sessionStorage : localStorage
      other.removeItem(KEY)
      target.setItem(KEY, JSON.stringify(session))
    } catch {
      /* storage unavailable — memory only */
    }
  },
  /** Replace tokens after a refresh while keeping the original storage choice. */
  update(session: AuthSession) {
    const remembered = !!read(localStorage)
    this.set(session, remembered)
  },
  clear() {
    memory = null
    try {
      localStorage.removeItem(KEY)
      sessionStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  },
}
