import { RedisManager } from '@/lib/redis-utils'

const redis = new RedisManager()

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const taskID = body.taskID
        const log = body.log
        console.log('At POST handler taskID:', taskID + ' and log:', log)
        if (!taskID || !log) {
            return new Response('Missing task ID or log', { status: 400 })
        }
      
        redis.addLog(taskID, log)
        return new Response(
            JSON.stringify({ message: 'Logs are stored successfully' }),
            {
                status: 200,
            }
        )
    } catch (error) {
        console.error('Error fetching logs:', error)
        return new Response('Internal server error', { status: 500 })
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) {
            return new Response('Missing request ID', { status: 400 })
        }
        const logs = await redis.getLogs(id)
        if (!logs) {
            return new Response('No logs found', { status: 404 })
        }
        console.log('Logs from GET handler : ' + logs)
        return new Response(JSON.stringify({ logs: logs }), { status: 200 })
    } catch (error) {
        return new Response('Internal server error', { status: 500 })
    }
}
