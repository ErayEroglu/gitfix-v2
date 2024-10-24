import { NextResponse } from 'next/server'

let statusMap: Record<string, "in-progress" | "completed"> = {}

// This is the API route that will be called by the client
// to check the status of the request
// It is used to update the logs on the client side
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) {
            return NextResponse.json("in-progress")
        }
        console.log('statusMap[id]:', statusMap[id])
        const status = statusMap[id] || "in-progress"
        return NextResponse.json({ status: `${status}`})
        } catch (error) {
        console.error('Error fetching status:', error)
        return new Response('Internal server error', { status: 500 })
    }
}

// This is the API route that will be called by the server side
// to update the status of the request
// When the task is completed by QStash and the PR is created, the status is updated to 'completed'
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const id = body.id
        const logs = body.logs || []
        if (!id) {
            return new Response('Missing request ID', { status: 400 })
        }
        statusMap[id] = logs.length > 0 ? 'completed' : 'in-progress'
        return new Response(JSON.stringify({ message: 'OK' }), { status: 200 })
    } catch (error) {
        console.error('Error updating status:', error)
        return new Response('Internal server error', { status: 500 })
    }
}

// This is the API route that will be called to clear the logs
// It resets the status of the request to 'in-progress'
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return new Response('Missing request ID', { status: 400 });
        }

        // Reset the status to 'in-progress'
        statusMap[id] = 'in-progress';
    
        return new Response(JSON.stringify({ message: 'Logs cleared and status reset to in-progress' }), { status: 200 });
    } catch (error) {
        console.error('Error clearing logs:', error);
        return new Response('Internal server error', { status: 500 });
    }
}