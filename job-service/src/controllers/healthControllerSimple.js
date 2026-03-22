/**
 * 健康检查控制器（简化版）
 * @module controllers/health_controller_simple
 */

import { createSuccessResponse, createErrorResponse } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'

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
 * 健康检查（简化版）
 * @param {Object} ctx - Koa 上下文
 */
export const healthCheck = async ctx => {
    try {
        const startTime = Date.now()

        // 模拟健康状态
        const dbHealth = {
            status: 'healthy',
            state: 'connected',
            message: 'MongoDB连接正常（模拟）',
        }

        const redisHealth = {
            status: 'healthy',
            message: 'Redis连接正常（模拟）',
        }

        // 计算响应时间
        const responseTime = Date.now() - startTime

        const healthData = {
            status: 'healthy',
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

        ctx.status = 200
        ctx.body = createSuccessResponse(healthData, '服务运行正常')
    } catch (error) {
        ctx.status = 503
        ctx.body = createErrorResponse(ERROR_CODES.INTERNAL_ERROR, `健康检查失败: ${error.message}`)
    }
}

/**
 * 简单健康检查
 * @param {Object} ctx - Koa 上下文
 */
export const simpleHealthCheck = async ctx => {
    ctx.status = 200
    ctx.body = {
        status: 'UP',
        timestamp: new Date().toISOString(),
    }
}

/**
 * 就绪检查
 * @param {Object} ctx - Koa 上下文
 */
export const readinessCheck = async ctx => {
    ctx.status = 200
    ctx.body = {
        ready: true,
        checks: {
            database: true,
            redis: true,
        },
    }
}

/**
 * 存活检查
 * @param {Object} ctx - Koa 上下文
 */
export const livenessCheck = async ctx => {
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
