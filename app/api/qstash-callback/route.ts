import { NextRequest, NextResponse } from 'next/server'
import { handleQStashCallback } from '@/lib/qstash-handler' // Assume you have a handler function in this file

export async function POST(request: NextRequest) {
    try {
        const data = await request.json()
        await handleQStashCallback(data)

        return NextResponse.json(
            { message: 'Callback handled successfully' },
            { status: 200 }
        )
    } catch (error) {
        console.error('Error handling callback:', error)
        return NextResponse.json(
            { message: 'Internal server error', error: (error as any).message },
            { status: 500 }
        )
    }
}
