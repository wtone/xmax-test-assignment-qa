import Redis from 'ioredis'
import { log } from './logger.js'

const logger = log(import.meta.url)

const REDIS_HOST = process.env.REDIS_HOST || 'localhost'
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379')
const REDIS_DB = parseInt(process.env.REDIS_DB || '0')
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || ''

// Redis连接配置
const config = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: REDIS_DB,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: false,
}

// 如果有密码则添加
if (REDIS_PASSWORD) {
    config.password = REDIS_PASSWORD
}

// 创建Redis实例
const redis = new Redis(config)

redis.on('connect', () => {
    logger.info(`🔗 Redis connecting to ${REDIS_HOST}:${REDIS_PORT}`)
})

redis.on('ready', () => {
    logger.info(`✅ Redis connected: ${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}`)
})

redis.on('error', err => {
    logger.error(`❌ Redis error: ${err.message}`)
})

redis.on('close', () => {
    logger.warn('⚠️  Redis connection closed')
})

redis.on('reconnecting', () => {
    logger.info('🔄 Redis reconnecting...')
})

// 优雅关闭
process.on('SIGINT', async () => {
    await redis.quit()
    logger.info('Redis connection closed due to app termination')
})

export default redis
