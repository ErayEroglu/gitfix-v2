import { NextResponse } from 'next/server'

let statusData: 'completed' | 'in-progress' = 'in-progress'

export async function GET(request: Request) {
    try {
        // Return the current status and logs
        return NextResponse.json(statusData)
    } catch (error) {
        console.error('Error fetching status:', error)
        return new Response('Internal server error', { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const logs = body.logs || []
        statusData = logs.length > 0 ? 'in-progress' : 'completed'
        return new Response('OK', { status: 200 })
    } catch (error) {
        console.error('Error updating status:', error)
        return new Response('Internal server error', { status: 500 })
    }
}
