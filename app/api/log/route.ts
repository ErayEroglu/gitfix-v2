import { NextResponse } from 'next/server';
import { PassThrough } from 'stream';

interface Client {
    id: string;
    res: PassThrough;
}

let clients: Client[] = [];

export async function GET(request: Request) {
    // Define the stream
    const stream = new ReadableStream({
        start(controller) {
            // Function to send a message
            const sendMessage = (message: string) => {
                controller.enqueue(`data: ${message}\n\n`);
            };

            // Example: Sending initial message
            sendMessage('Connection established. Logs will be streamed.');

            // Example: Simulating logs being sent every 2 seconds
            const interval = setInterval(() => {
                const logMessage = `Log message at ${new Date().toISOString()}`;
                sendMessage(logMessage);
            }, 2000);

            // Cleanup when stream is closed or client disconnects
            request.signal.addEventListener('abort', () => {
                clearInterval(interval);
                controller.close();
            });
        },
    });

    // Return the response with appropriate headers for SSE
    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

export function sendMessageToClients(message: string): void {
    clients.forEach(client => {
        try {
            client.res.write(`data: ${message}\n\n`);
        } catch (error) {
            console.error(`Error sending message to client ${client.id}:`, error);
        }
    });
}
