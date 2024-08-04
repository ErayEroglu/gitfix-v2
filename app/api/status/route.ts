import { NextResponse } from 'next/server'

const statusMap: Record<string, "in-progress" | "completed"> = {}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url)
        const id = url.searchParams.get('id')

        if (!id || !statusMap[id]) {
            return NextResponse.json("in-progress")
        }

        return NextResponse.json(statusMap[id])
    } catch (error) {
        console.error('Error fetching status:', error)
        return new Response('Internal server error', { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const id = body.id
        const logs = body.logs || []

        if (!id) {
            return new Response('Missing request ID', { status: 400 })
        }

        if (!statusMap[id]) {
            statusMap[id] = "in-progress"
        }

        statusMap[id] = logs.length > 0 ? 'in-progress' : 'completed'
        return new Response('OK', { status: 200 })
    } catch (error) {
        console.error('Error updating status:', error)
        return new Response('Internal server error', { status: 500 })
    }
}