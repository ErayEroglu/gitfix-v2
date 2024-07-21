import { deleteSession, get } from '../../../lib/session-store'
import getConfig from '../../../lib/config'
import gitfix from '../../../lib/gitfix'
import { NextResponse } from 'next/server'

type Params = {
    owner: string
    repo: string
}

export async function GET(request: Request, context: { params: Params }) {
    const encoder = new TextEncoder()
    const { owner, repo } = context.params
    let gitfixConfig

    try {
        gitfixConfig = await getConfig()
    } catch (e) {
        deleteSession()
        return NextResponse.json(
            { message: (e as Error).message },
            {
                status: 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Access-Control-Allow-Credentials': 'true',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods':
                        'GET,OPTIONS,PATCH,DELETE,POST,PUT',
                    'Access-Control-Allow-Headers':
                        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
                },
            }
        )
    }

    const customReadable = new ReadableStream({
        async start(controller) {
            for await (let chunk of gitfix(owner, repo, false, gitfixConfig)) {
                const chunkData = encoder.encode(JSON.stringify(chunk))
                controller.enqueue(chunkData)
            }
            controller.close()
        },
    })

    return new Response(customReadable, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
            'Access-Control-Allow-Headers':
                'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
        },
    })
}
