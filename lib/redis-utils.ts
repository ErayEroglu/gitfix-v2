import { Redis } from '@upstash/redis';

export class RedisManager {
    private redis: Redis;

    constructor() {
        this.redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL as string,
            token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
        });
    }

    /**
     * Adds a file path to the Redis set.
     */
    public async addFixedFile(filePath: string): Promise<void> {
        await this.redis.sadd('fixed_files', filePath);
    }

    /**
     * Checks if a file path is already in the Redis set.
     */
    public async isFileFixed(filePath: string): Promise<boolean> {
        const result = await this.redis.sismember('fixed_files', filePath);
        return result === 1;
    }

    /**
     * Gets all fixed file paths from the Redis set.
     */
    public async getAllFixedFiles(): Promise<string[]> {
        const result = await this.redis.smembers('fixed_files');
        return result;
    }

    /**
     * Stores an item in Redis with a specified key and value.
     */
    public async storeItem(key: string, value: string): Promise<void> {
        await this.redis.set(key, value);
    }

    /**
     * Retrieves an item from Redis by key.
     */
    public async getItem(key: string): Promise<string | null> {
        const value = await this.redis.get(key);
        return value as string;
    }

    /**
     * Clears the entire Redis database.
     */
    public async clearDatabase(): Promise<void> {
        await this.redis.flushall();
    }

    /**
     * Adds a log entry for a specific task ID.
     */
    public async addLog(taskID: string, logMessage: string): Promise<void> {
        try {
            await this.redis.lpush(taskID, logMessage); // Add the log entry to the taskID list
        } catch (error) {
            console.error('Error adding log:', error);
        }
    }

    /**
     * Clears all log entries for a specific task ID.
     */
    public async clearAllLogs(taskID: string): Promise<void> {
        try {
            await this.redis.del(taskID); // Delete the key and its associated logs
        } catch (error) {
            console.error('Error clearing logs:', error);
        }
    }
    public async getLogs(taskID: string): Promise<string[]> {
        try {
            const logs = await this.redis.lrange(taskID, 0, -1); // Get all logs
            return logs;
        } catch (error) {
            console.error('Error retrieving logs:', error);
            return [];
        }
    }

    /**
     * Deletes logs for a specific task ID.
     */
    public async deleteLogs(taskID: string): Promise<void> {
        try {
            await this.redis.del(taskID); // Delete the key and its associated logs
        } catch (error) {
            console.error('Error deleting logs:', error);
        }
    }
}
