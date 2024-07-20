import type { NextApiRequest, NextApiResponse } from 'next'

export default function login(req: NextApiRequest, res: NextApiResponse) {
    const client_id = process.env.GITHUB_CLIENT_ID
    const redirect_uri = process.env.GITHUB_REDIRECT_URI
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&scope=repo,user`

    res.redirect(githubAuthUrl)
}
