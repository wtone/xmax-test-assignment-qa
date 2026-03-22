/**
 * Redis 连接工具
 * @module utils/redis
 */

import Redis from 'ioredis'
import dotenv from 'dotenv'

dotenv.config()

let redis = null

/**
 * 连接 Redis
 * @returns {Promise<Redis>}
 */
export async function connectRedis() {
    try {
        redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_DB) || 0,
            keyPrefix: process.env.REDIS_PREFIX || 'job:',
            retryStrategy: times => {
                const delay = Math.min(times * 50, 2000)
                return delay
            },
            maxRetriesPerRequest: 3,
        })

        // 测试连接
        await redis.ping()
        console.log('✅ Redis connected successfully')

        // 监听事件
        redis.on('error', err => {
            console.error('❌ Redis connection error:', err)
        })

        redis.on('connect', () => {
            console.log('✅ Redis connected')
        })

        redis.on('reconnecting', () => {
            console.warn('⚠️  Redis reconnecting...')
        })

        return redis
    } catch (error) {
        console.error('❌ Failed to connect to Redis:', error.message)
        // Redis 连接失败不应该导致服务停止
        console.warn('⚠️  Service will continue without Redis cache')
        return null
    }
}

/**
 * 获取 Redis 实例
 * @returns {Redis}
 */
export function getRedis() {
    return redis
}

/**
 * 关闭 Redis 连接
 * @returns {Promise<void>}
 */
export async function closeRedis() {
    if (redis) {
        try {
            await redis.quit()
            console.log('👋 Redis connection closed')
        } catch (error) {
            console.error('❌ Error closing Redis connection:', error)
        }
    }
}

export default connectRedis
