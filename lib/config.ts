import { get, set, getSessionId } from './session-store'

function getCurrentTime() {
    return new Date().getTime() / 1000
}

function generateConfigFromEnvironment(): any {
    return {
        files_per_run: process.env.FILES_PER_RUN,
        access_token: process.env.GITHUB_TOKEN,
        upstash_redis_url: process.env.UPSTASH_REDIS_URL,
        upstash_redis_token: process.env.UPSTASH_REDIS_TOKEN,
        openai_key: process.env.OPENAI_KEY,
        kv_url: process.env.KV_REST_API_URL,
        kv_token: process.env.KV_REST_API_TOKEN,
        client_id: process.env.GITHUB_APP_CLIENT_ID,
        github_auth: process.env.AUTH_WITH_GITHUB_APP,
        app_slug: 'upstash-gitfix',
    }
}

export async function codeExchangeWithGitHub() {
    const code = (await getSessionId()) as string
    const params = {
        code: code,
        client_id: process.env.GITHUB_APP_CLIENT_ID as string,
        client_secret: process.env.GITHUB_APP_CLIENT_SECRET as string,
    }
    const query = new URLSearchParams(params).toString()
    const res = await fetch(
        `https://github.com/login/oauth/access_token/?${query}`,
        {
            method: 'POST',
            headers: { accept: 'application/json' },
        }
    )
    const authResponse = await res.json()
    if (res.status !== 200 || authResponse.error) {
        throw new Error('Failed to authenticate with GitHub API')
    }
    Object.keys(authResponse).forEach((key) => {
        set(key, authResponse[key])
    })
    set('token_created', Math.floor(getCurrentTime()).toString())
}

async function refreshToken() {
    const params = {
        refresh_token: (await get('refresh_token')) as string,
        client_id: process.env.GITHUB_APP_CLIENT_ID as string,
        client_secret: process.env.GITHUB_APP_CLIENT_SECRET as string,
        grant_type: 'refresh_token',
    }
    const query = new URLSearchParams(params).toString()
    const res = await fetch(
        `https://github.com/login/oauth/access_token/?${query}`,
        {
            method: 'POST',
            headers: { accept: 'application/json' },
        }
    )
    if (res.status !== 200) {
        throw new Error('Failed to authenticate with GitHub API')
    }
    const authResponse = await res.json()
    Object.keys(authResponse).forEach((key) => {
        set(key, authResponse[key])
    })
    set('token_created', Math.floor(getCurrentTime()).toString())
}

export default async function getConfig() {
    const gitfixConfig = generateConfigFromEnvironment()

    if (process.env.AUTH_WITH_GITHUB_APP) {
        if (!(await getSessionId())) {
            throw new Error('Broken session, please log in again')
        }
        if (await get('access_token')) {
            const expiresIn = parseInt((await get('expires_in')) as string)
            const refreshTokenExpiresIn = parseInt(
                (await get('refresh_token_expires_in')) as string
            )
            const created = parseInt((await get('token_created')) as string)
            if (getCurrentTime() > refreshTokenExpiresIn + created) {
                throw new Error('Refresh token expired')
            }
            if (getCurrentTime() > expiresIn + created) {
                await refreshToken()
            }
        } else {
            await codeExchangeWithGitHub()
        }
        gitfixConfig['access_token'] = (await get('access_token')) as string
    }

    return gitfixConfig
}
