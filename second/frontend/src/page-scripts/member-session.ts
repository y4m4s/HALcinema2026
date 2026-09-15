/* eslint-disable */
// @ts-nocheck

export const MEMBER_SESSION_STORAGE_KEY = 'halcinema-member-session'
export const MEMBER_SESSION_CHANGE_EVENT = 'halcinema:member-session-change'

function notifyMemberSessionChange() {
  window.dispatchEvent(new Event(MEMBER_SESSION_CHANGE_EVENT))
}

export function readMemberSession() {
  try {
    const raw = window.sessionStorage.getItem(MEMBER_SESSION_STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!isValidMemberSession(session)) return null
    return session
  } catch {
    return null
  }
}

export function writeMemberSession(session) {
  try {
    if (!isValidMemberSession(session)) return
    window.sessionStorage.setItem(MEMBER_SESSION_STORAGE_KEY, JSON.stringify(session))
    notifyMemberSessionChange()
  } catch {
    // Session storage can be unavailable in private browsing; the current view still works.
  }
}

export function removeMemberSession() {
  try {
    window.sessionStorage.removeItem(MEMBER_SESSION_STORAGE_KEY)
    notifyMemberSessionChange()
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

export async function refreshStoredMemberSession() {
  const session = readMemberSession()
  if (!session?.token) return null

  try {
    const result = await requestMemberJSON('/api/members/me', {
      headers: getAuthHeaders(session.token),
    })
    if (!result?.member) {
      removeMemberSession()
      return null
    }

    const currentSession = readMemberSession()
    if (currentSession?.token !== session.token) return null

    const refreshed = { member: result.member, token: session.token }
    writeMemberSession(refreshed)
    return refreshed
  } catch {
    removeMemberSession()
    return null
  }
}

export async function logoutStoredMemberSession() {
  const session = readMemberSession()
  removeMemberSession()
  if (!session?.token) return

  try {
    await requestMemberJSON('/api/members/logout', {
      method: 'POST',
      headers: getAuthHeaders(session.token),
    })
  } catch {
    // Local logout should still complete even if the session has already expired.
  }
}

export async function requestJSON(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  const response = await fetch(path, {
    ...options,
    headers,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || '通信に失敗しました。')
  }
  return data
}

export async function requestMemberJSON(path, options = {}) {
  return requestJSON(path, options)
}

export function getAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  }
}

export function getRequestErrorMessage(error) {
  return error instanceof Error ? error.message : '通信に失敗しました。'
}

function isValidMemberSession(session) {
  return Boolean(session?.token && session?.member)
}
