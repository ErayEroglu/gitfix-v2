import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

interface Client {
  id: string;
  send: (message: string) => void;
}

let clients: Client[] = [];

export async function GET(request: Request) {
  const clientId = uuidv4();

  // Define the stream
  const stream = new ReadableStream({
    start(controller) {
      // Function to send a message
      const sendMessage = (message: string) => {
        controller.enqueue(new TextEncoder().encode(`data: ${message}\n\n`));
      };

      // Register the client
      clients.push({ id: clientId, send: sendMessage });

      // Send initial message
      sendMessage('Connection established. Logs will be streamed.');

      // Cleanup when stream is closed or client disconnects
      request.signal.addEventListener('abort', () => {
        clients = clients.filter(client => client.id !== clientId);
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

// Function to broadcast a message to all connected clients
export function broadcastMessage(message: string) {
  clients.forEach(client => {
    try {
      client.send(message);
    } catch (error) {
      console.error(`Error sending message to client ${client.id}:`, error);
    }
  });
}
