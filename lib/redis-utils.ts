import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

/**
 * Adds a file path to the Redis set.
 */
export async function addFixedFile(filePath: string): Promise<void> {
    await redis.sadd('fixed_files', filePath)
}

/**
 * Checks if a file path is already in the Redis set.
 */
export async function isFileFixed(filePath: string): Promise<boolean> {
    const result = await redis.sismember('fixed_files', filePath)
    return result === 1
}

/**
 * Gets all fixed file paths from the Redis set.
 */
export async function getAllFixedFiles(): Promise<string[]> {
    const result = await redis.smembers('fixed_files')
    return result
}

export async function storeItem(key: string, value: string): Promise<void> {
    await redis.set(key, value)
}

export async function getItem(key: string): Promise<string | null> {
    const value = await redis.get(key)
    return value as string
}

export async function clearDatabase(): Promise<void> {
    await redis.flushall()
}
