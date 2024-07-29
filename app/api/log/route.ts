import { NextApiRequest, NextApiResponse } from 'next';
import { PassThrough } from 'stream';

interface Client {
    id: string;
    res: PassThrough;
}

let clients: Client[] = [];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET' && req.headers.accept === 'text/event-stream') {
        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Create a stream for SSE
        const clientId = Date.now().toString();
        const stream = new PassThrough();

        // Add client to the list
        clients.push({ id: clientId, res: stream });

        // Send initial event to confirm connection
        stream.write(`data: Connected\n\n`);

        // Pipe the stream to the response
        stream.pipe(res);

        // Remove client when the connection is closed
        req.on('close', () => {
            clients = clients.filter(client => client.id !== clientId);
            stream.end();
        });

        // Prevent Next.js from closing the response
        res.on('close', () => {
            res.end();
        });

    } else {
        res.status(404).json({ message: 'Not Found' });
    }
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
