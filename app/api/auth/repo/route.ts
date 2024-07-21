import { get, set } from '../../../../lib/session-store'
export const runtime = 'edge'

export async function POST(req: any) {
    // Extract query parameters
    const { owner, repo } = await req.json()
    if (!owner || !repo) {
        return new Response(
            JSON.stringify({ error: 'Owner and repo are required' }),
            {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }

    const accessToken = await get('access_token')
    if (!accessToken) {
        const github_token = process.env.GITHUB_TOKEN

        // Check if the github_token is set
        if (!github_token) {
            return new Response(
                JSON.stringify({ error: 'GitHub token is not set' }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const authResponse = await fetch(
            'https://api.github.com/app/installations',
            {
                headers: {
                    Authorization: `Bearer ${github_token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        )

        if (!authResponse.ok) {
            const errorText = await authResponse.text()
            console.log('Auth response:', errorText)
            return new Response(
                JSON.stringify({ error: 'Failed to fetch authentication token' }),
                {
                    status: authResponse.status,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const installations = await authResponse.json()
        if (installations.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No installations found' }),
                {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const installationId = installations[0].id

        const tokenResponse = await fetch(
            `https://api.github.com/app/installations/${installationId}/access_tokens`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${github_token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        )

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text()
            console.log('Token response:', tokenResponse, errorText)
            return new Response(
                JSON.stringify({ error: 'Failed to fetch access token' }),
                {
                    status: tokenResponse.status,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const tokenData = await tokenResponse.json()
        const accessToken = tokenData.token
        await set('access_token', accessToken)
    } else {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    try {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        )

        if (!response.ok) {
            const errorText = await response.text()
            console.log('Repo response:', response, errorText)
            return new Response(
                JSON.stringify({ error: 'Failed to fetch repository data' }),
                {
                    status: response.status,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        }

        const repoData = await response.json()
        return new Response(JSON.stringify(repoData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error(error)
        return new Response(
            JSON.stringify({ error: 'Internal Server Error' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }
}
