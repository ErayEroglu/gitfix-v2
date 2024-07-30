import { NextResponse } from 'next/server';

interface Client {
  id: string;
  controller: ReadableStreamDefaultController;
}

let clients: Client[] = [];

export async function GET(request: Request) {
  return new NextResponse(new ReadableStream({
    start(controller) {
      const clientId = Date.now().toString();
      clients.push({ id: clientId, controller });

      // Function to send a message to this client
      const sendMessage = (message: string) => {
        try {
          controller.enqueue(`data: ${message}\n\n`);
        } catch (error) {
          console.error(`Error sending message to client ${clientId}:`, error);
          // Remove client on error
          clients = clients.filter(client => client.id !== clientId);
        }
      };

      // Send an initial message to establish connection
      sendMessage('Connection established');

      // Cleanup when the client disconnects
      request.signal.addEventListener('abort', () => {
        clients = clients.filter(client => client.id !== clientId);
        controller.close();
      });
    }
  }), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Function to broadcast messages to all connected clients
export function broadcastMessage(message: string) {
  clients.forEach(client => {
    try {
      client.controller.enqueue(`data: ${message}\n\n`);
    } catch (error) {
      console.error(`Error sending message to client ${client.id}:`, error);
      // Remove client on error
      clients = clients.filter(c => c.id !== client.id);
    }
  });
}
