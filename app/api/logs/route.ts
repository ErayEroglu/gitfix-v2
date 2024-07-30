import { NextResponse } from 'next/server';
import { clients, registerClient } from '@/app/api/logs/clients';

export async function GET(request: Request) {
    const { readable, writable } = new TransformStream();

    // Get the writer from the writable stream
    const writer = writable.getWriter();

    // Register the client for broadcasting
    registerClient(writer);

    // Example: Sending initial message
    writer.write(`data: Connection established. Logs will be streamed.\n\n`);

    // Clean up when the client disconnects
    request.signal.addEventListener('abort', () => {
        const index = clients.indexOf(writer);
        if (index !== -1) {
            clients.splice(index, 1);
        }
        writer.close();
    });

    return new NextResponse(readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
