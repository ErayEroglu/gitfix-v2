import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    try {
        const body = await request.json()
        const logs = body.logs || []
        const status = logs.length > 0 ? 'in-progress' : 'completed'
        return NextResponse.json({ status, logs })
    } catch (error) {
        console.error('Error fetching status:', error)
        return new Response('Internal server error', { status: 500 })
    }
}
