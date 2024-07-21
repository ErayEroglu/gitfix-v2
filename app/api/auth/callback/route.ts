import type { NextApiRequest, NextApiResponse } from 'next'
import { createSession } from '../../../../lib/session-store'
import getConfig, { codeExchangeWithGitHub } from '../../../../lib/config'

export default async function callback(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { code } = req.query

    if (!code) {
        res.status(400).json({ error: 'No code provided' })
        return
    }

    try {
        await codeExchangeWithGitHub()
        const config = await getConfig()
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${config.access_token}`,
                Accept: 'application/vnd.github.v3+json',
            },
        })

        const userData = await userResponse.json()
        if (!userData) {
            throw new Error('Failed to fetch user data')
        }

        await createSession(userData.id, config.access_token)
        res.redirect(`/dashboard`)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
}
