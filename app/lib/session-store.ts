import 'server-only'
import { cookies } from 'next/headers'
import { kv } from '@vercel/kv'

type SessionId = string

export function getSessionId(): SessionId | undefined {
    const cookieStore = cookies()
    return cookieStore.get('session-id')?.value
}

export function deleteSession(namespace: string = ''): void {
    const cookieStore = cookies()
    const sessionId = getSessionId()
    if (sessionId) {
        cookieStore.delete(`session-${namespace}-id`)
    }
}

function setSessionId(sessionId: SessionId): void {
    const cookieStore = cookies()
    cookieStore.set('session-id', sessionId)
}

export function getSessionIdAndCreateIfMissing(): SessionId {
    const sessionId = getSessionId()
    if (!sessionId) {
        const newSessionId = crypto.randomUUID()
        setSessionId(newSessionId)
        return newSessionId
    }
    return sessionId
}

export async function createSession(
    userId: string,
    accessToken: string,
    namespace: string = ''
): Promise<SessionId> {
    const sessionId = getSessionIdAndCreateIfMissing()
    try {
        await kv.hset(`session-${namespace}-${sessionId}`, {
            userId,
            accessToken,
        })
        return sessionId
    } catch (error) {
        console.error('Failed to set data in KV store:', error)
        throw error
    }
}

export async function get(
    key: string,
    namespace: string = ''
): Promise<string | null> {
    const sessionId = getSessionId()
    if (!sessionId) {
        return null
    }
    try {
        return await kv.hget(`session-${namespace}-${sessionId}`, key)
    } catch (error) {
        console.error('Failed to get data from KV store:', error)
        return null
    }
}

export async function set(
    key: string,
    value: string,
    namespace: string = ''
): Promise<boolean> {
    const sessionId = getSessionIdAndCreateIfMissing()
    try {
        await kv.hset(`session-${namespace}-${sessionId}`, { [key]: value })
        return true
    } catch (error) {
        console.error('Failed to set data in KV store:', error)
        return false
    }
}
