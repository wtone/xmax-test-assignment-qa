/**
 * API 监控中间件
 * @module middlewares/api-monitor
 */

import logger from '../../utils/logger.js'

/**
 * API 访问监控中间件
 * 记录 API 访问情况和性能指标
 */
export const apiMonitor = () => {
    return async (ctx, next) => {
        const startTime = Date.now()

        try {
            await next()
        } finally {
            const duration = Date.now() - startTime

            // 记录 API 访问日志
            logger.info('API access', {
                path: ctx.path,
                method: ctx.method,
                status: ctx.status,
                duration,
                userType: ctx.headers['x-user-type'],
                userId: ctx.headers['x-user-id'],
            })

            // 记录慢请求
            if (duration > 1000) {
                logger.warn('Slow API request', {
                    path: ctx.path,
                    method: ctx.method,
                    duration,
                    userId: ctx.headers['x-user-id'],
                })
            }
        }
    }
}

export default apiMonitor
