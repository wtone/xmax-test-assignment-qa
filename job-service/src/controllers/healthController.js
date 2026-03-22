/**
 * 健康检查控制器
 * @module controllers/health_controller
 */

import mongoose from 'mongoose'
import { createSuccessResponse, createErrorResponse } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'

/**
 * 检查数据库连接状态
 * @returns {Object} 数据库状态信息
 */
const checkDatabaseHealth = () => {
    const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
    }

    const state = mongoose.connection.readyState
    return {
        status: state === 1 ? 'healthy' : 'unhealthy',
        state: states[state] || 'unknown',
        message: state === 1 ? 'MongoDB连接正常' : 'MongoDB连接异常',
    }
}

/**
 * 检查Redis连接状态
 * @param {Object} redis - Redis客户端
 * @returns {Object} Redis状态信息
 */
const checkRedisHealth = async redis => {
    try {
        if (!redis) {
            return {
                status: 'unhealthy',
                message: 'Redis客户端未初始化',
            }
        }

        // 测试Redis连接
        await redis.ping()

        return {
            status: 'healthy',
            message: 'Redis连接正常',
        }
    } catch (error) {
        return {
            status: 'unhealthy',
            message: `Redis连接异常: ${error.message}`,
        }
    }
}

/**
 * 计算服务运行时间
 * @returns {string} 格式化的运行时间
 */
const getUptime = () => {
    const uptime = process.uptime()
    const days = Math.floor(uptime / 86400)
    const hours = Math.floor((uptime % 86400) / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)
    const seconds = Math.floor(uptime % 60)

    const parts = []
    if (days > 0) parts.push(`${days}天`)
    if (hours > 0) parts.push(`${hours}小时`)
    if (minutes > 0) parts.push(`${minutes}分钟`)
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`)

    return parts.join('')
}

/**
 * 获取内存使用情况
 * @returns {Object} 内存使用信息
 */
const getMemoryUsage = () => {
    const usage = process.memoryUsage()
    const formatBytes = bytes => {
        return (bytes / 1024 / 1024).toFixed(2) + ' MB'
    }

    return {
        rss: formatBytes(usage.rss),
        heapTotal: formatBytes(usage.heapTotal),
        heapUsed: formatBytes(usage.heapUsed),
        external: formatBytes(usage.external),
        arrayBuffers: formatBytes(usage.arrayBuffers),
    }
}

/**
 * 健康检查
 * @param {Object} ctx - Koa 上下文
 */
export const healthCheck = async ctx => {
    try {
        const startTime = Date.now()

        // 检查各个组件的健康状态
        const dbHealth = checkDatabaseHealth()
        const redisHealth = await checkRedisHealth(ctx.app.context.redis)

        // 计算响应时间
        const responseTime = Date.now() - startTime

        // 判断整体健康状态
        const isHealthy = dbHealth.status === 'healthy' && redisHealth.status === 'healthy'
        const overallStatus = isHealthy ? 'healthy' : 'unhealthy'

        const healthData = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            service: {
                name: 'xmax-job-service',
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                uptime: getUptime(),
                memory: getMemoryUsage(),
            },
            checks: {
                database: dbHealth,
                redis: redisHealth,
            },
            metrics: {
                responseTimeMs: responseTime,
                pid: process.pid,
                nodeVersion: process.version,
            },
        }

        // 设置响应状态码
        ctx.status = isHealthy ? 200 : 503

        if (isHealthy) {
            ctx.body = createSuccessResponse(healthData, '服务运行正常')
        } else {
            ctx.body = createErrorResponse(ERROR_CODES.INTERNAL_ERROR, '服务组件存在异常', healthData)
        }
    } catch (error) {
        ctx.status = 503
        ctx.body = createErrorResponse(ERROR_CODES.INTERNAL_ERROR, `健康检查失败: ${error.message}`)
    }
}

/**
 * 简单健康检查（用于负载均衡器）
 * @param {Object} ctx - Koa 上下文
 */
export const simpleHealthCheck = async ctx => {
    try {
        // 只检查数据库连接
        const dbState = mongoose.connection.readyState
        const isHealthy = dbState === 1

        ctx.status = isHealthy ? 200 : 503
        ctx.body = {
            status: isHealthy ? 'UP' : 'DOWN',
            timestamp: new Date().toISOString(),
        }
    } catch (error) {
        ctx.status = 503
        ctx.body = {
            status: 'DOWN',
            timestamp: new Date().toISOString(),
            error: error.message,
        }
    }
}

/**
 * 就绪检查（用于K8s readiness probe）
 * @param {Object} ctx - Koa 上下文
 */
export const readinessCheck = async ctx => {
    try {
        // 检查所有依赖是否就绪
        const dbReady = mongoose.connection.readyState === 1
        const redisReady = ctx.app.context.redis ? true : false

        const isReady = dbReady && redisReady

        ctx.status = isReady ? 200 : 503
        ctx.body = {
            ready: isReady,
            checks: {
                database: dbReady,
                redis: redisReady,
            },
        }
    } catch (error) {
        ctx.status = 503
        ctx.body = {
            ready: false,
            error: error.message,
        }
    }
}

/**
 * 存活检查（用于K8s liveness probe）
 * @param {Object} ctx - Koa 上下文
 */
export const livenessCheck = async ctx => {
    // 简单的存活检查，如果服务能响应就认为是存活的
    ctx.status = 200
    ctx.body = {
        alive: true,
        timestamp: new Date().toISOString(),
    }
}

export default {
    healthCheck,
    simpleHealthCheck,
    readinessCheck,
    livenessCheck,
}
