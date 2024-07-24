import { NextResponse } from 'next/server'
import { Client, openai } from '@upstash/qstash'

const client = new Client({
    token: process.env.QSTASH_TOKEN as string,
})

export async function POST(request: Request) {
    try {
        console.log('Received request to fix markdown files')

        // Parse the JSON request body
        const { owner, repo, auth } = await request.json()

        if (!owner || !repo || !auth) {
            return NextResponse.json(
                { message: 'Missing required fields' },
                { status: 400 }
            )
        }

        // Publish the task to QStash
        const result = await client.publishJSON({
            api: { name: "llm", provider: openai({token : process.env.OPENAI_API_KEY as string}) },
            body: {
                owner,
                repo,
                auth,
            },
            callback: `${process.env.NEXTAUTH_URL}/api/qstash-callback`,
        })

        console.log(result)

        return NextResponse.json(
            { message: 'Task published to QStash successfully'},
            { status: 200 }
        )
    } catch (error) {
        console.error(error)
        return NextResponse.json(
            { message: 'Internal server error', error: (error as any).message },
            { status: 500 }
        )
    }
}
