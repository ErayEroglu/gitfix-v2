import { WritableStreamDefaultWriter } from 'stream/web'

export const clients: WritableStreamDefaultWriter<any>[] = []

export function registerClient(client: WritableStreamDefaultWriter<any>) {
    clients.push(client)
}

export function broadcastMessage(message: string) {
    clients.forEach((client) => {
        try {
            client.write(`data: ${message}\n\n`)
        } catch (error) {
            console.error(`Error sending message:`, error)
        }
    })
}
