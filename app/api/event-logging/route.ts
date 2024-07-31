import { NextResponse } from 'next/server';

let clients: any[] = [];

export async function GET(request: Request) {
    const stream = new ReadableStream({
        start(controller) {
            clients.push(controller);

            controller.enqueue(`data: Connection established\n\n`);

            request.signal.addEventListener('abort', () => {
                const index = clients.indexOf(controller);
                if (index > -1) {
                    clients.splice(index, 1);
                }
                controller.close();
            });
        },
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

export const runtime = 'edge';

export function broadcastMessage(message: string) {
    clients.forEach((controller) => {
        try {
            controller.enqueue(`data: ${message}\n\n`);
        } catch (error) {
            console.error('Error broadcasting message:', error);
        }
    });
}
